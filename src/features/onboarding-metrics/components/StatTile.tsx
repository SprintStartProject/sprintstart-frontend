import type { ReactNode } from "react";

type StatTileProps = {
  label: string;
  value: ReactNode;
  hint?: string;
};

/**
 * One aggregate number in the metrics readout. A dash for `value` reads as "not
 * reached yet" — the callers pass "—" rather than 0 for an unmet milestone.
 */
export function StatTile({ label, value, hint }: StatTileProps) {
  return (
    <div className="rounded-2xl border border-app-border bg-app-surface p-4">
      <p className="text-xs font-medium text-app-text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-app-text">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-app-text-subtle">{hint}</p>}
    </div>
  );
}
