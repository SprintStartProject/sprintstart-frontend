import { Check } from "lucide-react";
import { StagedSourceList } from "../../StagedSourceList";
import type { DraftSource } from "../../../projectSourcesDraft";

type WizardProvisioningProps = {
  projectName: string;
  /** Members assigned to the project, manager included, for the summary line. */
  memberCount: number;
  sources: DraftSource[];
  /** Blocks retry while a connect run is in flight. */
  disabled?: boolean;
  onRetry: (sourceId: string) => void;
};

/**
 * The screen shown after the single "Create project": the project already
 * exists, and each staged source is connected here with live per-row status and
 * a retry for the ones that fail. Connecting is asynchronous on the backend, so
 * a connected row means the ingestion was accepted, not that it has finished —
 * the user can close the dialog and watch progress on the Data Ingestion page.
 */
export function WizardProvisioning({
  projectName,
  memberCount,
  sources,
  disabled = false,
  onRetry,
}: WizardProvisioningProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-app-success-solid text-white">
          <Check className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-app-text">{projectName || "Project"}</p>
          <p className="text-xs text-app-text-muted">
            Project created
            {memberCount > 0 && ` · ${memberCount} ${memberCount === 1 ? "member" : "members"}`}
          </p>
        </div>
      </div>

      <p className="text-sm leading-relaxed text-app-text-muted">
        Connecting {sources.length} {sources.length === 1 ? "source" : "sources"}. Ingestion runs in
        the background — you can close this once it is done.
      </p>

      <StagedSourceList sources={sources} disabled={disabled} onRetry={onRetry} />
    </div>
  );
}
