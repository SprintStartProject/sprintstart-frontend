import { describe, it, expect } from "vitest";
import {
  buildTree,
  defaultExpanded,
  fileKey,
  folderKeys,
  visibleRows,
  type FolderNode,
} from "../../../../src/features/offboarding/fileTree";
import type { FileRisk } from "../../../../src/services/offboardingTypes";

function file(repository: string, path: string, score: number, level: FileRisk["level"]): FileRisk {
  return {
    repository,
    path,
    level,
    score,
    departingShare: 1,
    sourceBreakdown: { commits: 1 },
    recentActivity: 0.5,
    fragmentation: 0,
    remainingKnowers: [],
    lastChangedAt: "2026-11-01T00:00:00Z",
  };
}

const APP = "github:acme/app";
const WEB = "github:acme/web";

const FILES = [
  file(APP, "src/main/kotlin/ingestion/service/A.kt", 0.9, "ORPHANED"),
  file(APP, "src/main/kotlin/ingestion/service/B.kt", 0.4, "HOARDED"),
  file(APP, "src/main/kotlin/offboarding/C.kt", 0.7, "ORPHANED"),
  file(APP, "build.gradle.kts", 0.3, "HOARDED"),
  file(WEB, "src/features/board/D.ts", 0.5, "ORPHANED"),
];

function names(nodes: { name: string }[]): string[] {
  return nodes.map((node) => node.name);
}

function folder(node: FolderNode["children"][number] | undefined): FolderNode {
  if (node?.kind !== "folder") throw new Error("expected a folder");
  return node;
}

describe("buildTree", () => {
  const roots = buildTree(FILES);

  it("makes one root per repository, the one with most files nobody will know first", () => {
    expect(names(roots)).toEqual(["acme/app", "acme/web"]);
  });

  it("counts the files below a folder and how they were left", () => {
    const app = roots[0];

    expect([app.files, app.orphaned, app.hoarded]).toEqual([4, 2, 2]);
    expect([roots[1].files, roots[1].orphaned, roots[1].hoarded]).toEqual([1, 1, 0]);
  });

  it("shows a chain of directories with nothing else in them as one line", () => {
    const kotlin = folder(roots[0].children[0]);

    expect(kotlin.name).toBe("src/main/kotlin");
    expect(names(kotlin.children)).toEqual(["ingestion/service", "offboarding"]);
    expect(folder(roots[1].children[0]).name).toBe("src/features/board");
  });

  it("keeps the name of a repository, whatever lies below it", () => {
    const single = buildTree([file(APP, "only/one/A.kt", 0.5, "ORPHANED")]);

    expect(names(single)).toEqual(["acme/app"]);
    expect(names(single[0].children)).toEqual(["only/one"]);
  });

  it("puts folders before files, folders with more files nobody will know first", () => {
    const kotlin = folder(roots[0].children[0]);
    const lowFirst = buildTree([
      file(APP, "a/x/One.kt", 0.5, "HOARDED"),
      file(APP, "b/x/Two.kt", 0.5, "ORPHANED"),
      file(APP, "c/Three.kt", 0.5, "ORPHANED"),
      file(APP, "c/Four.kt", 0.5, "ORPHANED"),
    ]);

    expect(names(roots[0].children)).toEqual(["src/main/kotlin", "build.gradle.kts"]);
    expect(names(kotlin.children)).toEqual(["ingestion/service", "offboarding"]);
    expect(names(lowFirst[0].children)).toEqual(["c", "b/x", "a/x"]);
  });

  it("breaks a tie between folders by name", () => {
    const tied = buildTree([
      file(APP, "b/x/B.kt", 0.5, "ORPHANED"),
      file(APP, "a/x/A.kt", 0.5, "ORPHANED"),
    ]);

    expect(names(tied[0].children)).toEqual(["a/x", "b/x"]);
  });

  it("lists files nobody will know first, then by score, then by name", () => {
    const tree = buildTree([
      file(APP, "d/b.kt", 0.5, "HOARDED"),
      file(APP, "d/c.kt", 0.2, "ORPHANED"),
      file(APP, "d/a.kt", 0.5, "HOARDED"),
      file(APP, "d/e.kt", 0.9, "ORPHANED"),
    ]);

    expect(names(folder(tree[0].children[0]).children)).toEqual(["e.kt", "c.kt", "a.kt", "b.kt"]);
  });

  it("gives a file its own key and the name it has in its folder", () => {
    const first = folder(folder(roots[0].children[0]).children[0]).children[0];

    expect(first.kind).toBe("file");
    expect(first.name).toBe("A.kt");
    expect(first.key).toBe(`${APP}:src/main/kotlin/ingestion/service/A.kt`);
  });

  it("tells the same path in two repositories apart", () => {
    expect(fileKey(FILES[0])).not.toBe(fileKey(file(WEB, FILES[0].path, 0.5, "ORPHANED")));
  });

  it("names a Bitbucket repository by its workspace and name too", () => {
    expect(names(buildTree([file("bitbucket:team/app", "a/B.kt", 0.5, "ORPHANED")]))).toEqual([
      "team/app",
    ]);
  });

  it("builds nothing from no files", () => {
    expect(buildTree([])).toEqual([]);
  });
});

describe("visibleRows", () => {
  const roots = buildTree(FILES);

  it("shows only the repositories while all folders are closed", () => {
    const rows = visibleRows(roots, new Set());

    expect(rows.map((row) => row.node.key)).toEqual(roots.map((root) => root.key));
    expect(rows.every((row) => row.depth === 0 && row.parentKey === null)).toBe(true);
  });

  it("shows the children of an open folder one level deeper, with the folder as their parent", () => {
    const rows = visibleRows(roots, new Set([roots[0].key]));

    expect(
      rows.map((row) => [row.node.kind === "folder" ? row.node.name : "file", row.depth]),
    ).toEqual([
      ["acme/app", 0],
      ["src/main/kotlin", 1],
      ["file", 1],
      ["acme/web", 0],
    ]);
    expect(rows[1].parentKey).toBe(roots[0].key);
  });

  it("shows everything when every folder is open, in the order of the tree", () => {
    const rows = visibleRows(roots, new Set(folderKeys(roots)));

    expect(rows.map((row) => row.node.name)).toEqual([
      "acme/app",
      "src/main/kotlin",
      "ingestion/service",
      "A.kt",
      "B.kt",
      "offboarding",
      "C.kt",
      "build.gradle.kts",
      "acme/web",
      "src/features/board",
      "D.ts",
    ]);
  });

  it("hides what lies below a closed folder even when the folder below is open", () => {
    const keys = folderKeys(roots).filter((key) => key !== roots[0].key);

    expect(visibleRows(roots, new Set(keys)).map((row) => row.node.name)).not.toContain("A.kt");
  });
});

describe("folderKeys", () => {
  it("lists every repository and directory but no file", () => {
    expect(folderKeys(buildTree(FILES))).toHaveLength(6);
    expect(folderKeys([])).toEqual([]);
  });
});

describe("defaultExpanded", () => {
  it("opens every folder of a short ranking", () => {
    const roots = buildTree(FILES);

    expect(defaultExpanded(roots)).toEqual(new Set(folderKeys(roots)));
  });

  it("opens every folder of a ranking of sixty files", () => {
    const sixty = Array.from({ length: 60 }, (_, index) =>
      file(APP, `d${index}/x/F${index}.kt`, 0.5, "ORPHANED"),
    );
    const roots = buildTree(sixty);

    expect(defaultExpanded(roots).size).toBe(folderKeys(roots).length);
  });

  it("opens only the repositories of a longer ranking", () => {
    const many = Array.from({ length: 61 }, (_, index) =>
      file(APP, `d${index}/x/F${index}.kt`, 0.5, "ORPHANED"),
    );
    const roots = buildTree(many);

    expect(defaultExpanded(roots)).toEqual(new Set(roots.map((root) => root.key)));
  });
});
