import { Badge } from "../../../components/ui/Badge.tsx";
import { EmptyState } from "../../../components/ui/EmptyState.tsx";
import { SOURCE_META, SOURCE_SYSTEMS } from "../data.ts";
import type { SourceSystem } from "../types.ts";

/**
 * Source-type picker used by the "Add source" wizard and the project-creation
 * wizard. Each card carries its own description so the differences between the
 * options -- the actual decision being made here -- are visible, and only the
 * GitHub connector is available today (the rest show a "Soon" badge).
 */
export function SourceTypeStep({
  selectedType,
  onSelectType,
  heading = "Source type",
  description,
}: {
  selectedType: SourceSystem;
  onSelectType: (system: SourceSystem) => void;
  /** Overrides the step heading (e.g. the wizard frames it as data ingestion). */
  heading?: string;
  /** Optional sub-line under the heading, e.g. to explain that this is optional. */
  description?: string;
}) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium text-app-text">{heading}</p>
        {description && (
          <p className="mt-1 text-sm leading-relaxed text-app-text-muted">{description}</p>
        )}

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {SOURCE_SYSTEMS.map((sourceSystem) => {
            const meta = SOURCE_META[sourceSystem];
            const Icon = meta.icon;
            const isSelected = selectedType === sourceSystem;
            const isAvailable = sourceSystem === "GITHUB";

            return (
              <button
                key={sourceSystem}
                type="button"
                onClick={() => onSelectType(sourceSystem)}
                className={`rounded-2xl border p-4 text-left transition ${
                  isSelected
                    ? "border-app-brand bg-app-brand-soft"
                    : "border-app-border bg-app-surface hover:border-app-brand-border hover:bg-app-surface-hover"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-app-bg-soft">
                    <Icon
                      size={20}
                      className={isSelected ? "text-app-brand" : "text-app-text-muted"}
                    />
                  </div>

                  {!isAvailable && (
                    <Badge variant="neutral" size="sm">
                      Soon
                    </Badge>
                  )}
                </div>

                <p className="mt-3 text-sm font-semibold text-app-text">{meta.type}</p>
                <p className="mt-1 text-xs leading-relaxed text-app-text-muted">
                  {meta.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function ComingSoonStep({ sourceSystem }: { sourceSystem: SourceSystem }) {
  const meta = SOURCE_META[sourceSystem];
  const Icon = meta.icon;

  return (
    <EmptyState
      icon={
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-app-bg-soft">
          <Icon className="h-6 w-6 text-app-text-muted" />
        </span>
      }
      title={`${meta.type} connection is coming soon`}
    >
      {meta.description} This source type isn&apos;t available to connect yet — for now you can
      connect GitHub repositories.
    </EmptyState>
  );
}
