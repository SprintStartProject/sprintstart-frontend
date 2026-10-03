import { IconTile } from "../../../components/ui/IconTile";
import { CONNECTOR_LIST } from "../connectors/registry.ts";
import type { SourceSystem } from "../connectors/sourceSystems.ts";

/**
 * Source-type picker used by the "Add source" wizard and the project-creation
 * wizard. Each card carries its own description so the differences between the
 * options -- the actual decision being made here -- are visible. It offers every
 * connector in the registry, each of which brings its own add-source form.
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

        {/* Two columns from `sm` up rather than one row per connector: with four
            source types a three-column grid leaves a single card stranded on the
            second row, and the cards carry a description each. */}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {CONNECTOR_LIST.map(({ meta }) => {
            const Icon = meta.icon;
            const isSelected = selectedType === meta.system;

            return (
              <button
                key={meta.system}
                type="button"
                onClick={() => onSelectType(meta.system)}
                className={`rounded-2xl border p-4 text-left transition ${
                  isSelected
                    ? "border-app-brand bg-app-brand-soft"
                    : "border-app-border bg-app-surface hover:border-app-brand-border hover:bg-app-surface-hover"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <IconTile icon={Icon} size="xl" tone={isSelected ? "brand" : "neutral"} />
                </div>

                <p className="mt-3 text-sm font-semibold text-app-text">{meta.label}</p>
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
