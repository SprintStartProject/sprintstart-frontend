// Presentational severity components shared by the knowledge-gaps widget and
// pages. Styling constants live in ../severity.

import type { KnowledgeGap, KnowledgeGapSeverity } from "../types";
import { SEVERITIES, SEVERITY_STYLES } from "../severity";

/**
 * The severity as a chip.
 *
 * The feature's own pill rather than `ui/Badge`: severity is a four-step ramp on its own
 * scale, not a point on the app's status ladder, so no Badge variant carries the right colour.
 * Mapping the steps onto the nearest status roles would put this pill and the `SeverityBar`
 * beside it in two different reds for one and the same gap.
 */
export function SeverityPill({
  severity,
  className = "",
}: {
  severity: KnowledgeGapSeverity;
  className?: string;
}) {
  const { badge, label } = SEVERITY_STYLES[severity];

  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${badge} ${className}`}>
      {label}
    </span>
  );
}

/**
 * What a component is missing, or already has, as chips.
 *
 * The document types are the actionable half of a gap — "runbook" says what to write, where
 * "high severity" only says how much it matters — so the surfaces that have the room spell
 * them all out and the tighter ones cap the list with a `+n`.
 */
export function GapTypeChips({
  types,
  limit,
  tone = "missing",
  className = "",
}: {
  types: readonly string[];
  /** How many to spell out before the rest collapse into `+n`. Omitted shows every one. */
  limit?: number;
  /** `present` is the green counterpart used for what the component already has. */
  tone?: "missing" | "present";
  className?: string;
}) {
  const visible = limit === undefined ? types : types.slice(0, limit);
  const hidden = types.length - visible.length;

  const chip =
    tone === "present"
      ? "rounded border border-app-success-border bg-app-success-bg px-1.5 py-0.5 text-[11px] text-app-success-text"
      : "rounded border border-app-border bg-app-surface-muted px-1.5 py-0.5 text-[11px] text-app-text-muted";

  if (types.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {visible.map((type) => (
        <span key={type} className={chip}>
          {type}
        </span>
      ))}

      {hidden > 0 && <span className={chip}>+{hidden}</span>}
    </div>
  );
}

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
