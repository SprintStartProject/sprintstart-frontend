// ============================================================
// features/dashboard/layout/sizes.ts
// ============================================================
// The grid: three sizes that tile a four-column row exactly,
// however they are ordered.
// ============================================================

import type { DashboardWidgetDefinition, DashboardWidgetSize } from "./types";

/**
 * The grid the widgets are laid on.
 *
 * Four columns on a desktop, two on a tablet, one on a phone. The three sizes are worth
 * 4, 2 and 1 column, so a row fills exactly — one wide, two mediums, a medium and two
 * smalls, or four smalls — in any order the user drops them in. That is the whole reason
 * there are three sizes and not five: with a `large` in the mix, a row could only be filled
 * some of the time, and the leftover gaps are what made the grid look broken.
 *
 * **Heights are fixed, never content-driven.** Letting them grow with their content was the
 * cause of a lopsided board: a card's height depended on which neighbours happened to share
 * its row, so moving anything resized things that had not moved.
 *
 * The track is `2rem` and the sizes span several of them. That is arithmetic, not a design
 * with 2rem cards: a span of `n` covers `n * 2rem` plus the `n - 1` gaps between them, so with
 * the `1.25rem` gap the three heights the board actually uses come out as
 * `6 → 292px`, `3 → 136px` and `2 → 84px`. The first two are exactly what a `8.5rem` track
 * gave before; the fine track only adds the third, which no whole number of `8.5rem` rows
 * could express.
 *
 * `small` and `medium` are always the full 292px, which is what keeps a row of mixed sizes
 * level. `wide` is 136px by default — a band across the dashboard rather than one more
 * rectangle — 292px where the widget's wide form is a real card with a header and columns of
 * its own, and 84px where its wide form is a single line and the band left it mostly empty.
 *
 * The cost is that a compact widget now has room it did not ask for. That is paid back in
 * the widgets themselves, which centre their content rather than hanging it from the top.
 */
export const DASHBOARD_GRID_CLASS =
  "grid grid-cols-1 gap-5 auto-rows-[2rem] sm:grid-cols-2 lg:grid-cols-4";

/**
 * Column and row spans per size.
 *
 * Written out as whole class strings rather than composed at runtime, because Tailwind
 * scans source text — a template literal would leave the classes out of the stylesheet.
 * Every size collapses to a single column on a phone, so a layout built on a desktop still
 * reads top to bottom on a small screen.
 *
 * **Below `sm` every card is the full-height cell**, whatever the reduced band its wide form
 * gets on a wider screen. The bands are shallow because they are wide: 136px is a comfortable
 * strip across four columns and a clipped box in one. Paired with
 * {@link dashboardRenderSize}, which stops the wide *content* being rendered into that one
 * column in the first place.
 */
const SIZE_CLASSES: Record<DashboardWidgetSize, string> = {
  small: "col-span-1 row-span-6",
  medium: "col-span-1 row-span-6 sm:col-span-2",
  wide: "col-span-1 row-span-6 sm:col-span-2 sm:row-span-3 lg:col-span-4",
};

/**
 * A wide card with as much height as a `medium`.
 *
 * Only `wide` gets the choice, and only because it owns its row outright: nothing sits
 * beside it to be pushed around, so its height cannot make the board lopsided.
 */
const TALL_WIDE_CLASS = "col-span-1 row-span-6 sm:col-span-2 lg:col-span-4";

/**
 * A wide card whose content is a single line.
 *
 * The default band is right for a card that fills it. `skills` does not: at full width it is
 * one row of pills, so more than half the band was empty and the default dashboard paid for
 * that emptiness with a scrollbar. Only from `sm` up: 84px is one line of pills across four
 * columns and about a third of what the same pills need stacked in one.
 */
const SHORT_WIDE_CLASS = "col-span-1 row-span-6 sm:col-span-2 sm:row-span-2 lg:col-span-4";

/**
 * The grid-placement classes for one placed widget.
 *
 * `isTallWhenWide` wins if a widget somehow claims both — a card asking for extra height and
 * for less of it is a mistake in the catalog, and the roomier reading of it cannot clip.
 */
export function dashboardCellClass(
  size: DashboardWidgetSize,
  isTallWhenWide: boolean,
  isShortWhenWide = false,
): string {
  if (size !== "wide") return SIZE_CLASSES[size];
  if (isTallWhenWide) return TALL_WIDE_CLASS;

  return isShortWhenWide ? SHORT_WIDE_CLASS : SIZE_CLASSES.wide;
}

/**
 * The size a widget should actually *render* at, which is not always the size it was given.
 *
 * The board runs as a single column below `sm`, so the three sizes stop meaning three widths:
 * a card given `wide` and a card given `small` are both exactly the width of the page. Handing
 * the placed size to `render` there is what produced the reported breakage — a `wide` form
 * laid out for a four-column band, squeezed into a phone-width column and cut off by the
 * fixed-height cell.
 *
 * The answer is the widget's own smallest form: `sizes` is ordered smallest first, and the
 * compact form is the one written for a narrow column. A widget that offers no small form
 * (`ask-chat`, `team-insights`) falls back to its narrowest anyway, because that is what
 * `sizes[0]` is. The placed size is untouched — it is still what the user picked, and it is
 * what the board goes back to at `sm` and above.
 */
export function dashboardRenderSize(
  definition: Pick<DashboardWidgetDefinition, "sizes">,
  size: DashboardWidgetSize,
  isNarrowViewport: boolean,
): DashboardWidgetSize {
  if (!isNarrowViewport) return size;

  return definition.sizes[0] ?? size;
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
