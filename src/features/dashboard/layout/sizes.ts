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
 * Four columns on a roomy board, two on a narrower one, one on a phone. The three sizes are worth
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
  "grid grid-cols-1 gap-5 @min-[36rem]/dashboard:auto-rows-[2rem] @min-[36rem]/dashboard:grid-cols-2 @min-[60rem]/dashboard:grid-cols-4";

/**
 * The element the grid measures itself against, wrapped around {@link DASHBOARD_GRID_CLASS}.
 *
 * **The column count follows the board, not the screen.** It used to switch on `sm` and `lg`,
 * which only say how wide the *window* is. The board is that minus a sidebar and two page
 * gutters, so at 1280px the four "desktop" columns were 151px each — a quarter-row card had
 * about 100px for its content, and titles, links and figures ran out of it. A named container
 * query asks the question that matters: is there room for two columns, or for four?
 *
 * Named so a widget's own `@container` further down cannot answer for it by accident.
 */
export const DASHBOARD_CONTAINER_CLASS = "@container/dashboard";

/**
 * The narrowest board, in px, that gets two columns and four — the same numbers as the
 * container variants in {@link DASHBOARD_GRID_CLASS}. 36rem is two ~278px columns; 60rem is four
 * of ~225px, the least a quarter-row card needs to show a title beside its action.
 */
export const DASHBOARD_TWO_COLUMN_MIN_PX = 576;
export const DASHBOARD_FOUR_COLUMN_MIN_PX = 960;

/**
 * The cell on a single-column board: at least the full 292px, and taller if the card needs it.
 *
 * Fixed heights exist to keep a *row* level — a card's height must not depend on its
 * neighbours. A single column has no neighbours, so there the fixed height bought nothing and
 * cost the bottom of every card whose narrow form stacks taller than 292px (team insights'
 * two halves one above the other ran ~95px past the edge on a phone). From two columns up the
 * board goes back to the 2rem track and the fixed spans below.
 *
 */
const PHONE_CELL = "col-span-1 min-h-[18.25rem] @min-[36rem]/dashboard:min-h-0";

/**
 * Column and row spans per size.
 *
 * Every class is written out whole rather than built from parts at runtime, because Tailwind
 * scans source text — `PHONE_CELL` is interpolated, but only as a complete class list.
 * Every size collapses to a single column on a phone, so a layout built on a desktop still
 * reads top to bottom on a small screen.
 *
 * **On a single-column board every card is at least the full-height cell**, whatever the reduced
 * band its wide form gets on a wider screen. The bands are shallow because they are wide: 136px is a comfortable
 * strip across four columns and a clipped box in one. Paired with
 * {@link dashboardRenderSize}, which stops the wide *content* being rendered into that one
 * column in the first place.
 */
const SIZE_CLASSES: Record<DashboardWidgetSize, string> = {
  small: `${PHONE_CELL} @min-[36rem]/dashboard:row-span-6`,
  medium: `${PHONE_CELL} @min-[36rem]/dashboard:col-span-2 @min-[36rem]/dashboard:row-span-6`,
  wide: `${PHONE_CELL} @min-[36rem]/dashboard:col-span-2 @min-[36rem]/dashboard:row-span-3 @min-[60rem]/dashboard:col-span-4`,
};

/**
 * A wide card with as much height as a `medium`.
 *
 * Only `wide` gets the choice, and only because it owns its row outright: nothing sits
 * beside it to be pushed around, so its height cannot make the board lopsided.
 */
const TALL_WIDE_CLASS = `${PHONE_CELL} @min-[36rem]/dashboard:col-span-2 @min-[36rem]/dashboard:row-span-6 @min-[60rem]/dashboard:col-span-4`;

/**
 * A wide card whose content is a single line.
 *
 * The default band is right for a card that fills it. `skills` does not: at full width it is
 * one row of pills, so more than half the band was empty and the default dashboard paid for
 * that emptiness with a scrollbar. Only on a four-column board: 84px is one line of pills across
 * four columns, but across two the same pills wrap onto a second and third line and ran out of
 * the band — so there it keeps the ordinary 136px band, and a single column the full cell.
 */
const SHORT_WIDE_CLASS = `${PHONE_CELL} @min-[36rem]/dashboard:col-span-2 @min-[36rem]/dashboard:row-span-3 @min-[60rem]/dashboard:col-span-4 @min-[60rem]/dashboard:row-span-2`;

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
 * The board runs as a single column when it is narrow, so the three sizes stop meaning three widths:
 * a card given `wide` and a card given `small` are both exactly the width of the page. Handing
 * the placed size to `render` there is what produced the reported breakage — a `wide` form
 * laid out for a four-column band, squeezed into a phone-width column and cut off by the
 * fixed-height cell.
 *
 * The answer is the widget's own smallest form: `sizes` is ordered smallest first, and the
 * compact form is the one written for a narrow column. A widget that offers no small form
 * (`ask-chat`, `team-insights`) falls back to its narrowest anyway, because that is what
 * `sizes[0]` is. The placed size is untouched — it is still what the user picked, and it is
 * what the board goes back to once it has two columns again.
 */
export function dashboardRenderSize(
  definition: Pick<DashboardWidgetDefinition, "sizes">,
  size: DashboardWidgetSize,
  isSingleColumn: boolean,
): DashboardWidgetSize {
  if (!isSingleColumn) return size;

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
