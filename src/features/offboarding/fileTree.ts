import type { FileRisk } from "../../services/offboardingTypes";

/** A file at risk, as a leaf of the tree. */
export interface FileNode {
  kind: "file";
  key: string;
  name: string;
  file: FileRisk;
}

/** A repository or a directory, with how many files at risk lie below it. */
export interface FolderNode {
  kind: "folder";
  key: string;
  /** A chain of directories with nothing else in them is one name, such as `src/main/kotlin`. */
  name: string;
  children: TreeNode[];
  files: number;
  orphaned: number;
  hoarded: number;
}

export type TreeNode = FileNode | FolderNode;

/** One line of the tree as drawn: the node, how deep it is and which folder it is in. */
export interface TreeRow {
  node: TreeNode;
  depth: number;
  parentKey: string | null;
}

/** The identity of a file in the ranking: a path is only unique within its repository. */
export function fileKey(file: FileRisk): string {
  return `${file.repository}:${file.path}`;
}

function repositoryName(repository: string): string {
  return repository.replace(/^github:|^bitbucket:/, "");
}

type Draft = { name: string; key: string; folders: Map<string, Draft>; files: FileNode[] };

function draftOf(name: string, key: string): Draft {
  return { name, key, folders: new Map(), files: [] };
}

function insert(root: Draft, file: FileRisk): void {
  const parts = file.path.split("/");
  let at = root;
  parts.slice(0, -1).forEach((directory) => {
    const existing = at.folders.get(directory);
    const next = existing ?? draftOf(directory, `${at.key}/${directory}`);
    at.folders.set(directory, next);
    at = next;
  });
  at.files.push({ kind: "file", key: fileKey(file), name: parts[parts.length - 1], file });
}

const LEVEL_ORDER = { ORPHANED: 0, HOARDED: 1 } as const;

function fileOrder(first: FileNode, second: FileNode): number {
  return (
    LEVEL_ORDER[first.file.level] - LEVEL_ORDER[second.file.level] ||
    second.file.score - first.file.score ||
    first.name.localeCompare(second.name)
  );
}

function folderOrder(first: FolderNode, second: FolderNode): number {
  return (
    second.orphaned - first.orphaned ||
    second.hoarded - first.hoarded ||
    first.name.localeCompare(second.name)
  );
}

function countOf(children: TreeNode[], level: FileRisk["level"]): number {
  return children.reduce((sum, child) => {
    if (child.kind === "file") return sum + Number(child.file.level === level);
    return sum + (level === "ORPHANED" ? child.orphaned : child.hoarded);
  }, 0);
}

function finish(draft: Draft, mergeChains: boolean): FolderNode {
  const folders = [...draft.folders.values()].map((child) => finish(child, true)).sort(folderOrder);
  const children: TreeNode[] = [...folders, ...[...draft.files].sort(fileOrder)];
  const node: FolderNode = {
    kind: "folder",
    key: draft.key,
    name: draft.name,
    children,
    files: children.reduce((sum, child) => sum + (child.kind === "file" ? 1 : child.files), 0),
    orphaned: countOf(children, "ORPHANED"),
    hoarded: countOf(children, "HOARDED"),
  };
  const [only] = children;
  return mergeChains && children.length === 1 && only.kind === "folder"
    ? { ...only, name: `${node.name}/${only.name}` }
    : node;
}

/**
 * The files at risk as a tree: one root per repository, then its directories, then the files. A
 * directory with nothing in it but one directory is shown with it as one line. Folders with the most
 * files nobody will know come first, files nobody will know before the rest.
 */
export function buildTree(files: FileRisk[]): FolderNode[] {
  const roots = new Map<string, Draft>();
  files.forEach((file) => {
    const root =
      roots.get(file.repository) ??
      draftOf(repositoryName(file.repository), `repo:${file.repository}`);
    roots.set(file.repository, root);
    insert(root, file);
  });
  return [...roots.values()].map((root) => finish(root, false)).sort(folderOrder);
}

/** The lines that are showing: every folder's children only while the folder is open. */
export function visibleRows(roots: FolderNode[], expanded: ReadonlySet<string>): TreeRow[] {
  const rows: TreeRow[] = [];
  const walk = (nodes: TreeNode[], depth: number, parentKey: string | null) => {
    nodes.forEach((node) => {
      rows.push({ node, depth, parentKey });
      if (node.kind === "folder" && expanded.has(node.key))
        walk(node.children, depth + 1, node.key);
    });
  };
  walk(roots, 0, null);
  return rows;
}

/** The key of every folder in the tree. */
export function folderKeys(roots: FolderNode[]): string[] {
  const keys: string[] = [];
  const walk = (nodes: TreeNode[]) =>
    nodes.forEach((node) => {
      if (node.kind === "folder") {
        keys.push(node.key);
        walk(node.children);
      }
    });
  walk(roots);
  return keys;
}

/** Above this many files only the repositories start open, so a long ranking is not one long wall. */
const OPEN_ALL_UP_TO = 60;

/** Which folders are open when the tree first shows. */
export function defaultExpanded(roots: FolderNode[]): Set<string> {
  const total = roots.reduce((sum, root) => sum + root.files, 0);
  return new Set(total <= OPEN_ALL_UP_TO ? folderKeys(roots) : roots.map((root) => root.key));
}
