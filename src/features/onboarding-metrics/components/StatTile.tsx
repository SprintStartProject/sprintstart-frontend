import type { ReactNode } from "react";

/**
 * The colour an aggregate's icon carries. Follows meaning, never decoration:
 * `brand` for the neutral north-star numbers, `warning` for a number that is a
 * call to act (a growing review queue), `neutral` for a plain fact.
 */
export type StatTileAccent = "brand" | "warning" | "success" | "neutral";

type StatTileProps = {
  label: string;
  value: ReactNode;
  hint?: string;
  /** A small lucide icon, shown tinted in the top-right corner. */
  icon?: ReactNode;
  accent?: StatTileAccent;
};

/** Icon tint per accent — mirrors the Data Ingestion overview tiles. */
const accentIconClasses: Record<StatTileAccent, string> = {
  brand: "text-app-brand-text",
  warning: "text-app-warning-solid",
  success: "text-app-success-text",
  neutral: "text-app-text-muted",
};

/**
 * One aggregate number in the metrics readout, styled to match the Data
 * Ingestion overview tiles: label and a tinted line icon on top, the number
 * below, a quiet hint underneath. A dash for `value` reads as "not reached yet"
 * — the callers pass "—" rather than 0 for an unmet milestone.
 */
export function StatTile({ label, value, hint, icon, accent = "neutral" }: StatTileProps) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-app-border bg-app-surface p-4 transition-colors hover:border-app-brand-border-strong sm:p-[18px]">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 text-[12.5px] font-medium text-app-text-muted">{label}</span>
        {icon && (
          <span aria-hidden="true" className={`shrink-0 ${accentIconClasses[accent]}`}>
            {icon}
          </span>
        )}
      </div>
      {/* Value and hint sit at the bottom edge so they line up across tiles whose
          labels wrap to different heights. */}
      <p className="mt-auto pt-2.5 text-2xl font-bold tracking-tight text-app-text tabular-nums sm:text-3xl">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-app-text-subtle">{hint}</p>}
    </div>
  );
}
