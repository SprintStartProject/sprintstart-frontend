import { ChevronRight, Folder, FolderOpen } from "lucide-react";

import type { FileRisk } from "../../../services/offboardingTypes";
import type { FileNode, FolderNode, TreeRow } from "../fileTree";
import { percent } from "../format";
import { LEVELS } from "../levels";
import { SourceLinkIcon } from "./SourceLinks";

type RowProps = {
  row: TreeRow;
  expanded: boolean;
  selected: boolean;
  onToggle: () => void;
  onSelect: () => void;
};

const BUTTON =
  "focus-ring-inset flex h-8 min-w-0 flex-1 items-center gap-2 pr-3 text-left text-sm hover:bg-app-brand-soft";

function indentOf(depth: number): number {
  return 8 + depth * 18;
}

/** The status as a shape as well as a colour: filled for a file nobody will know, a ring for one person. */
function StatusDot({ level }: { level: FileRisk["level"] }) {
  const style = level === "ORPHANED" ? "bg-app-danger-solid" : "border-2 border-app-warning-solid";
  return <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${style}`} aria-hidden />;
}

function FolderCounts({ folder }: { folder: FolderNode }) {
  return (
    <span
      className="ml-auto flex items-center gap-3 text-xs text-app-text-muted tabular-nums"
      aria-hidden
    >
      {folder.orphaned > 0 && (
        <span className="inline-flex items-center gap-1">
          <StatusDot level="ORPHANED" />
          {folder.orphaned}
        </span>
      )}
      {folder.hoarded > 0 && (
        <span className="inline-flex items-center gap-1">
          <StatusDot level="HOARDED" />
          {folder.hoarded}
        </span>
      )}
    </span>
  );
}

function folderLabel(folder: FolderNode): string {
  const parts = [`${folder.files} ${folder.files === 1 ? "file" : "files"} at risk`];
  if (folder.orphaned > 0) parts.push(`${folder.orphaned} nobody left`);
  if (folder.hoarded > 0) parts.push(`${folder.hoarded} one person left`);
  return `${folder.name}, ${parts.join(", ")}`;
}

function FolderIcon({ expanded }: { expanded: boolean }) {
  const className = "h-4 w-4 shrink-0 text-app-text-subtle";
  return expanded ? (
    <FolderOpen className={className} aria-hidden />
  ) : (
    <Folder className={className} aria-hidden />
  );
}

function FolderRow({ row, folder, expanded, onToggle }: RowProps & { folder: FolderNode }) {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-label={folderLabel(folder)}
      onClick={onToggle}
      style={{ paddingLeft: indentOf(row.depth) }}
      className={BUTTON}
    >
      <ChevronRight
        className={`h-3.5 w-3.5 shrink-0 text-app-text-subtle transition-transform ${expanded ? "rotate-90" : ""}`}
        aria-hidden
      />
      <FolderIcon expanded={expanded} />
      <span className="min-w-0 truncate text-app-text" title={folder.name}>
        {folder.name}
      </span>
      <FolderCounts folder={folder} />
    </button>
  );
}

function FileRow({ row, entry, selected, onSelect }: RowProps & { entry: FileNode }) {
  const { file, name } = entry;
  return (
    <>
      <button
        type="button"
        aria-pressed={selected}
        aria-label={`${file.path}, ${LEVELS[file.level].label}, risk ${percent(file.score)}`}
        title={file.path}
        onClick={onSelect}
        style={{ paddingLeft: indentOf(row.depth) + 20 }}
        className={`${BUTTON} ${selected ? "bg-app-brand-soft" : ""}`}
      >
        <StatusDot level={file.level} />
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-app-text">{name}</span>
        <span className="text-xs text-app-text-muted tabular-nums">{percent(file.score)}</span>
      </button>
      <SourceLinkIcon file={file} />
    </>
  );
}

/** One line of the file tree: a folder that opens and closes, or a file that can be selected. */
export function TreeRowItem(props: RowProps) {
  const { node } = props.row;
  return (
    <li className="flex items-center pr-2">
      {node.kind === "folder" ? (
        <FolderRow {...props} folder={node} />
      ) : (
        <FileRow {...props} entry={node} />
      )}
    </li>
  );
}
