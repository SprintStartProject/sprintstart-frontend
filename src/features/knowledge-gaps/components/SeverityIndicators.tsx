// Presentational severity components shared by the knowledge-gaps widget and
// pages. Styling constants live in ../severity.

import type { KnowledgeGap, KnowledgeGapSeverity } from "../types";
import { SEVERITIES, SEVERITY_STYLES } from "../severity";

/** Thin vertical severity indicator shown at the left edge of a gap row. */
export function SeverityBar({ severity }: { severity: KnowledgeGapSeverity }) {
  const { bar } = SEVERITY_STYLES[severity];
  return (
    <div className="w-1 shrink-0 self-stretch rounded-full bg-app-border">
      <div className={`w-full rounded-full ${bar}`} style={{ height: "100%" }} />
    </div>
  );
}

/**
 * Stacked bar + legend summarizing how the project's components are spread
 * across the severity ramp, including the covered ones. Renders nothing when
 * there is nothing to summarize. `className` lets the caller control the
 * surrounding margin.
 */
export function SeveritySummaryBar({
  gaps,
  className = "",
}: {
  gaps: KnowledgeGap[];
  className?: string;
}) {
  const total = gaps.length;
  if (total === 0) return null;

  // Derived from SEVERITIES rather than spelled out, so a step added to the
  // ramp cannot be silently left out of the summary.
  const counts = Object.fromEntries(
    SEVERITIES.map((s) => [s, gaps.filter((g) => g.severity === s).length]),
  ) as Record<KnowledgeGapSeverity, number>;

  return (
    <div className={className}>
      {/* Stacked bar */}
      <div className="mb-2 flex h-2 gap-0.5 overflow-hidden rounded-full">
        {SEVERITIES.map((s) =>
          counts[s] > 0 ? (
            <div
              key={s}
              className={`${SEVERITY_STYLES[s].bar} rounded-full`}
              style={{ width: `${(counts[s] / total) * 100}%` }}
            />
          ) : null,
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3">
        {SEVERITIES.map((s) =>
          counts[s] > 0 ? (
            <span key={s} className="flex items-center gap-1 text-xs text-app-text-muted">
              <span className={`inline-block h-2 w-2 rounded-full ${SEVERITY_STYLES[s].bar}`} />
              {counts[s]} {SEVERITY_STYLES[s].label}
            </span>
          ) : null,
        )}
        <span className="ml-auto text-xs text-app-text-muted">{total} total</span>
      </div>
    </div>
  );
}
