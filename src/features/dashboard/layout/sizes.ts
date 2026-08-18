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
 * there are three sizes and not five: with a `large` in the mix, a row could only be filled
 * some of the time, and the leftover gaps are what made the grid look broken.
 *
 * **Rows are a hard `8.5rem`.** Letting them grow with their content was the cause of a
 * lopsided board: a card's height depended on which neighbours happened to share its row, so
 * moving anything resized things that had not moved. `small` and `medium` are always two
 * rows, which is what keeps a row of mixed sizes level. `wide` is a single row by default —
 * a band across the dashboard rather than one more rectangle — and two where the widget's
 * wide form is a real card with a header and columns of its own.
 *
 * The cost is that a compact widget now has room it did not ask for. That is paid back in
 * the widgets themselves, which centre their content rather than hanging it from the top.
 */
export const DASHBOARD_GRID_CLASS =
  "grid grid-cols-1 gap-5 auto-rows-[8.5rem] sm:grid-cols-2 lg:grid-cols-4";

/**
 * Column and row spans per size.
 *
 * Written out as whole class strings rather than composed at runtime, because Tailwind
 * scans source text — a template literal would leave the classes out of the stylesheet.
 * Every size collapses to a single column on a phone, so a layout built on a desktop still
 * reads top to bottom on a small screen.
 */
const SIZE_CLASSES: Record<DashboardWidgetSize, string> = {
  small: "col-span-1 row-span-2",
  medium: "col-span-1 row-span-2 sm:col-span-2",
  wide: "col-span-1 row-span-1 sm:col-span-2 lg:col-span-4",
};

/**
 * A wide card that needs both rows.
 *
 * Only `wide` gets the choice, and only because it owns its row outright: nothing sits
 * beside it to be pushed around, so its height cannot make the board lopsided.
 */
const TALL_WIDE_CLASS = "col-span-1 row-span-2 sm:col-span-2 lg:col-span-4";

/** The grid-placement classes for one placed widget. */
export function dashboardCellClass(size: DashboardWidgetSize, isTallWhenWide: boolean): string {
  return size === "wide" && isTallWhenWide ? TALL_WIDE_CLASS : SIZE_CLASSES[size];
}

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
