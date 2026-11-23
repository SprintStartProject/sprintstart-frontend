import { useMemo, useState } from "react";

import type { FileRisk } from "../../../services/offboardingTypes";
import { buildTree, defaultExpanded, fileKey, visibleRows } from "../fileTree";
import { FileDetails } from "./FileDetails";
import { TreeRowItem } from "./TreeRowItem";

/**
 * The files at risk as a tree of the folders of the repository, so where a file sits is what you
 * read. Folders show how many files below them nobody will know, and open and close; selecting a
 * file shows it below, with links that open it at its source. It shows what the list shows.
 */
export function FileTree({ files }: { files: FileRisk[] }) {
  const roots = useMemo(() => buildTree(files), [files]);
  const [expanded, setExpanded] = useState<Set<string>>(() => defaultExpanded(roots));
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const rows = useMemo(() => visibleRows(roots, expanded), [roots, expanded]);
  const selected = files.find((file) => fileKey(file) === selectedKey);

  const toggle = (key: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  const select = (key: string) => setSelectedKey((current) => (current === key ? null : key));

  return (
    <div className="space-y-3">
      <ul
        aria-label="Files at risk by folder"
        className="max-h-[34rem] overflow-auto rounded-xl border border-app-border py-1"
      >
        {rows.map((row) => (
          <TreeRowItem
            key={row.node.key}
            row={row}
            expanded={expanded.has(row.node.key)}
            selected={row.node.key === selectedKey}
            onToggle={() => toggle(row.node.key)}
            onSelect={() => select(row.node.key)}
          />
        ))}
      </ul>
      {selected && <FileDetails file={selected} />}
    </div>
  );
}
