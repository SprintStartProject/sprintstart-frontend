// ============================================================
// features/dashboard/layout/sizes.ts
// ============================================================
// The invisible grid: how each named size maps onto columns and
// rows, and what to call it in the size picker.
// ============================================================

import type { DashboardWidgetSize } from "./types";

/**
 * The grid the widgets are laid on.
 *
 * Four columns on a desktop, two on a tablet, one on a phone — and rows that are at least
 * `7rem` but grow with their content. A fixed row height would be tidier, but it clips a
 * card whose content ran long, and a dashboard the user assembled themselves is exactly
 * where that happens.
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
  large: "col-span-1 row-span-3 sm:col-span-2",
  wide: "col-span-1 row-span-1 sm:col-span-2 lg:col-span-4",
  full: "col-span-1 row-span-3 sm:col-span-2 lg:col-span-4",
};

/** Names shown on the size control, in the order the sizes grow. */
export const DASHBOARD_SIZE_LABELS: Record<DashboardWidgetSize, string> = {
  small: "Small",
  medium: "Medium",
  large: "Large",
  wide: "Wide",
  full: "Full width",
};

/** Every size, smallest first — the order the size control cycles through. */
export const DASHBOARD_SIZES: readonly DashboardWidgetSize[] = [
  "small",
  "medium",
  "large",
  "wide",
  "full",
];

export function isDashboardWidgetSize(value: unknown): value is DashboardWidgetSize {
  return typeof value === "string" && DASHBOARD_SIZES.includes(value as DashboardWidgetSize);
}
