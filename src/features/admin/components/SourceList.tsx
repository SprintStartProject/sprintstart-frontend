import { FileText } from "lucide-react";
import type { ProjectSource } from "../types";
import {
  deriveSourceStatus,
  getBackendSourceStatusLabel,
  getSourceStatusFromBackend,
  SOURCE_META,
} from "../../data-ingestion/data";
import { SourceStatusChip } from "../../data-ingestion/components/SourceStatusChip";
import { SourceSyncBadge } from "../../data-ingestion/components/SourceSyncBadge";
import { SourceTypeBadge } from "../../data-ingestion/components/SourceTypeBadge";
import type { SourceSystem } from "../../data-ingestion/types";

type SourceListProps = {
  sources: ProjectSource[];
  onOpenSourceDetails?: (sourceId: string) => void;
};

/** Resolves a project source's raw type string to the shared source metadata. */
function getMeta(type: string) {
  const normalized = type.toUpperCase();

  if (normalized in SOURCE_META) {
    return SOURCE_META[normalized as SourceSystem];
  }

  return null;
}

export function SourceList({ sources, onOpenSourceDetails }: SourceListProps) {
  if (sources.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-app-border bg-app-surface-muted px-4 py-6 text-center">
        <FileText className="mx-auto mb-2 h-5 w-5 text-app-text-disabled" />
        <p className="text-sm text-app-text-muted">No sources connected yet.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {sources.map((source) => {
        const meta = getMeta(source.type);
        const Icon = meta?.icon ?? FileText;

        // The admin view only has the project source's backend status, so both
        // badges are derived from it — the same helpers the Data Ingestion page
        // uses, so the two screens describe a source identically.
        const statusView = deriveSourceStatus({
          backendStatus: source.status,
          hasErrors: false,
          hasNeverSynced: false,
        });
        const syncLabel = getBackendSourceStatusLabel(source.status);

        const content = (
          <>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-app-border bg-app-surface">
                <Icon className="h-5 w-5 text-app-text-muted" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-semibold leading-5 text-app-text">
                  {source.name}
                </p>

                <div className="mt-2">
                  <SourceTypeBadge type={meta?.type ?? source.type} size="sm" />
                </div>
              </div>
            </div>

            <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
              <SourceStatusChip status={statusView} size="sm" />

              {syncLabel !== statusView.label && (
                <SourceSyncBadge
                  label={syncLabel}
                  status={getSourceStatusFromBackend(source.status)}
                  size="sm"
                />
              )}
            </div>
          </>
        );

        if (onOpenSourceDetails) {
          return (
            <button
              key={source.id}
              type="button"
              onClick={() => onOpenSourceDetails(source.id)}
              className="flex min-h-36 flex-col rounded-2xl border border-app-border bg-app-surface-muted p-4 text-left transition hover:border-app-border-strong hover:bg-app-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-app-brand-glow"
              aria-label={`Open ingestion details for ${source.name}`}
            >
              {content}
            </button>
          );
        }

        return (
          <div
            key={source.id}
            className="flex min-h-36 flex-col rounded-2xl border border-app-border bg-app-surface-muted p-4 transition hover:border-app-border-strong hover:bg-app-surface-hover"
          >
            {content}
          </div>
        );
      })}
    </div>
  );
}
