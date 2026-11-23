import { useState } from "react";
import { FileWarning, FolderTree, List } from "lucide-react";

import { EmptyState } from "../../../components/ui/EmptyState";
import { SegmentedTabs, type SegmentedTabOption } from "../../../components/ui/SegmentedTabs";
import type { RiskMap } from "../../../services/offboardingTypes";
import { PmCard, PmCardHeader } from "../../pm-area";
import { FileTree } from "./FileTree";
import { fileKey } from "../fileTree";
import { RiskFileRow } from "./RiskFileRow";

type View = "list" | "tree";

const VIEWS: SegmentedTabOption<View>[] = [
  { value: "list", label: "List", icon: <List className="h-3.5 w-3.5" aria-hidden /> },
  { value: "tree", label: "Tree", icon: <FolderTree className="h-3.5 w-3.5" aria-hidden /> },
];

function FileList({ map }: { map: RiskMap }) {
  return (
    <ul className="-mx-4 -mb-4 border-t border-app-border">
      {map.files.map((file) => (
        <RiskFileRow key={`${file.repository}:${file.path}`} file={file} />
      ))}
    </ul>
  );
}

/**
 * The files at risk, as the ranked list or as a tree of folders. Both show the same files; the tree
 * shows where they sit in the repository, the list shows them in order of urgency.
 */
export function FilesCard({ map }: { map: RiskMap }) {
  const [view, setView] = useState<View>("list");
  const hiddenFiles = map.summary.orphaned + map.summary.hoarded - map.files.length;
  return (
    <PmCard aria-label="Files at risk">
      <PmCardHeader
        icon={FileWarning}
        title="Files at risk"
        meta={`most urgent first · ${map.settings.name} settings`}
        action={
          <SegmentedTabs
            value={view}
            options={VIEWS}
            onChange={setView}
            layoutId="offboarding-view-pill"
            ariaLabel="How to show the files"
          />
        }
      />
      {map.files.length === 0 ? (
        <EmptyState size="sm">
          Nothing is left without its authors when these people leave.
        </EmptyState>
      ) : view === "list" ? (
        <FileList map={map} />
      ) : (
        <FileTree key={map.files.map(fileKey).join("|")} files={map.files} />
      )}
      {hiddenFiles > 0 && (
        <p className="mt-4 text-xs text-app-text-muted">
          {hiddenFiles} more files at risk are not listed.
        </p>
      )}
    </PmCard>
  );
}
