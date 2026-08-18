// ============================================================
// features/dashboard/layout/sizes.ts
// ============================================================
// The grid: three sizes that tile a four-column row exactly,
// however they are ordered.
// ============================================================

import type { DashboardWidgetSize } from "./types";

/**
 * The grid the widgets are laid on.
 *
 * Four columns on a desktop, two on a tablet, one on a phone. The three sizes are worth
 * 4, 2 and 1 column, so a row fills exactly — one wide, two mediums, a medium and two
 * smalls, or four smalls — in any order the user drops them in. That is the whole reason
 * there are three sizes and not five: with a `large` in the mix, a row could only be
 * filled some of the time, and the leftover gaps are what made the grid look broken.
 *
 * Rows are at least `7rem` and grow with their content. A hard row height would tile more
 * strictly, but it clips a card whose content ran long — and a dashboard the user
 * assembled themselves is exactly where that happens.
 */
export const DASHBOARD_GRID_CLASS =
  "grid grid-cols-1 gap-5 auto-rows-[minmax(7rem,auto)] sm:grid-cols-2 lg:grid-cols-4";

/**
 * Column and row spans per size.
 *
 * Written out as whole class strings rather than composed at runtime, because Tailwind
 * scans source text — a template literal would leave the classes out of the stylesheet.
 * Every size collapses to a single column on a phone, so a layout built on a desktop still
 * reads top to bottom on a small screen.
 */
export const DASHBOARD_SIZE_CLASSES: Record<DashboardWidgetSize, string> = {
  small: "col-span-1 row-span-2",
  medium: "col-span-1 row-span-2 sm:col-span-2",
  wide: "col-span-1 row-span-1 sm:col-span-2 lg:col-span-4",
};

/** Names shown on the size control, in the order the sizes grow. */
export const DASHBOARD_SIZE_LABELS: Record<DashboardWidgetSize, string> = {
  small: "Small",
  medium: "Medium",
  wide: "Wide",
};

/** Every size, smallest first. */
export const DASHBOARD_SIZES: readonly DashboardWidgetSize[] = ["small", "medium", "wide"];

export function isDashboardWidgetSize(value: unknown): value is DashboardWidgetSize {
  return typeof value === "string" && DASHBOARD_SIZES.includes(value as DashboardWidgetSize);
}
