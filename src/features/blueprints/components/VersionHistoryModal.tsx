import { Loader2, Minus } from "lucide-react";
import { Badge } from "../../../components/ui/Badge.tsx";
import { Button } from "../../../components/ui/Button.tsx";
import { Modal } from "../../../components/ui/Modal.tsx";
import { versionWord } from "../pathLifecycle.ts";
import type { BlueprintPath } from "../types.ts";
import type { LifecycleActions } from "../useLifecycleActions.ts";
import type { VersionHistory } from "../useVersionHistory.ts";

const STATUS_BADGE = { ACTIVE: "success", ARCHIVED: "neutral", DRAFT: "warning" } as const;

interface VersionRowProps {
  version: BlueprintPath;
  isDeleting: boolean;
  onOpen: (version: BlueprintPath) => void;
  onDeleteDraft: (version: BlueprintPath) => void;
}

function VersionRow({ version, isDeleting, onOpen, onDeleteDraft }: VersionRowProps) {
  return (
    <article className="flex items-center gap-2 rounded-xl border border-app-border bg-app-surface p-1">
      <Button
        variant="ghost"
        fullWidth
        className="h-auto min-w-0 flex-1 justify-between px-3 py-2 text-left"
        onClick={() => onOpen(version)}
      >
        <span className="min-w-0">
          <span className="block font-semibold">Version {version.version}</span>
          <span className="mt-1 block truncate text-xs text-app-text-muted">
            {version.description || "No description"}
          </span>
        </span>
        <Badge variant={STATUS_BADGE[version.status]}>{versionWord(version.status)}</Badge>
      </Button>
      {version.status === "DRAFT" ? (
        <Button
          aria-label={`Delete draft version ${version.version}`}
          iconOnly
          variant="dangerGhost"
          loading={isDeleting}
          onClick={() => onDeleteDraft(version)}
        >
          <Minus className="h-4 w-4" strokeWidth={2.5} />
        </Button>
      ) : null}
    </article>
  );
}

interface VersionHistoryModalProps {
  history: VersionHistory;
  lifecycle: LifecycleActions;
  onOpenVersion: (version: BlueprintPath) => void;
}

/** Lists every version of the blueprint, to inspect, restore or (for drafts) delete. */
export function VersionHistoryModal({
  history,
  lifecycle,
  onOpenVersion,
}: VersionHistoryModalProps) {
  return (
    <Modal
      isOpen={history.isOpen}
      title="Version history"
      description="Select a version to inspect or restore it."
      onClose={history.close}
      size="lg"
    >
      {history.isLoading ? (
        <div className="flex items-center gap-3 py-8 text-app-text-muted">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading versions…
        </div>
      ) : (
        <div className="space-y-2">
          {history.versions.map((version) => (
            <VersionRow
              key={version.id}
              version={version}
              isDeleting={lifecycle.isBusy && lifecycle.pending?.version.id === version.id}
              onOpen={onOpenVersion}
              onDeleteDraft={(draft) =>
                lifecycle.request({ action: "delete-draft", version: draft })
              }
            />
          ))}
        </div>
      )}
    </Modal>
  );
}
