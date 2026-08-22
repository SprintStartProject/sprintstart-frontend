import type { LucideIcon } from "lucide-react";

export type WidgetMetric = {
  label: string;
  /** `null` renders a dash — the figure could not be read, which is not the same as zero. */
  value: number | null;
  /** The line under the number: what it is measured against, or what is wrong with it. */
  hint: string;
  /** Unit shown right after the value, e.g. "%". Omitted for plain counts. */
  suffix?: string;
  /** Reserved for a number somebody has to act on; never the only sign that something is off. */
  needsAttention?: boolean;
};

/**
 * The figure rows the overview widgets are made of.
 *
 * Shared so the team, project and people cards read as one family rather than three
 * dashboards that happen to sit next to each other. Text stays in the text tokens whatever
 * the state; only the icon chip carries colour, so a flagged row never costs its value the
 * contrast.
 */
export function WidgetMetrics({
  icon: Icon,
  metrics,
}: {
  icon: LucideIcon;
  metrics: WidgetMetric[];
}) {
  return (
    <ul className="flex flex-1 flex-col justify-center gap-3">
      {metrics.map((metric) => (
        <li key={metric.label} className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
              metric.needsAttention
                ? "bg-app-warning-bg text-app-warning-text"
                : "bg-app-brand-soft text-app-brand-text"
            }`}
          >
            <Icon className="h-4 w-4" />
          </span>

          <div className="min-w-0">
            <p className="text-xs font-medium text-app-text-muted">{metric.label}</p>
            <p className="text-xl leading-tight font-semibold text-app-text tabular-nums">
              {metric.value ?? "—"}
              {metric.value !== null && metric.suffix ? (
                <span className="text-sm font-medium text-app-text-muted">{metric.suffix}</span>
              ) : null}
            </p>
            <p className="mt-0.5 truncate text-xs text-app-text-muted">{metric.hint}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
