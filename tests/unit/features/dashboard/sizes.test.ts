import { describe, it, expect } from "vitest";
import {
  DASHBOARD_GRID_CLASS,
  dashboardCellClass,
} from "../../../../src/features/dashboard/layout/sizes";

/** Pixel height of a span, given the track size and the gaps between the rows it covers. */
function heightOf(rowSpan: number, trackPx = 32, gapPx = 20): number {
  return rowSpan * trackPx + (rowSpan - 1) * gapPx;
}

/** The span a cell has on a two-column board, the smallest that uses the fixed track. */
function rowSpanOf(className: string): number {
  const match = /@min-\[36rem\]\/dashboard:row-span-(\d+)/.exec(className);
  if (!match) throw new Error(`no row span in "${className}"`);

  return Number(match[1]);
}

/**
 * The span on a board of two columns or more, which is the same as the base one unless the cell
 * overrides it. `columns` picks the container variant: the two-column one, or the four-column
 * one where a cell sets it and the two-column one otherwise.
 */
function smRowSpanOf(className: string, columns: 2 | 4 = 4): number {
  const four = /@min-\[60rem\]\/dashboard:row-span-(\d+)/.exec(className);
  if (columns === 4 && four) return Number(four[1]);

  return rowSpanOf(className);
}

/**
 * The fine track exists for arithmetic, not for 2rem cards.
 *
 * The board used a `8.5rem` track, which could only express two heights. A card whose wide
 * form is a single line needed a third, shorter one — impossible as a whole number of 8.5rem
 * rows. Dividing the track and multiplying the spans buys that third height, and these tests
 * are what say the first two came through it unchanged.
 */
describe("dashboard grid sizes", () => {
  it("lays the board on a 2rem track", () => {
    expect(DASHBOARD_GRID_CLASS).toContain("@min-[36rem]/dashboard:auto-rows-[2rem]");
    expect(DASHBOARD_GRID_CLASS).toContain("gap-5");
  });

  it("keeps small and medium at the height a 8.5rem track gave them", () => {
    // Two 8.5rem rows plus the gap between them.
    const before = 2 * 136 + 20;

    expect(heightOf(rowSpanOf(dashboardCellClass("small", false)))).toBe(before);
    expect(heightOf(rowSpanOf(dashboardCellClass("medium", false)))).toBe(before);
  });

  it("keeps both wide forms at the heights they had", () => {
    expect(heightOf(smRowSpanOf(dashboardCellClass("wide", false)))).toBe(136);
    expect(heightOf(smRowSpanOf(dashboardCellClass("wide", true)))).toBe(2 * 136 + 20);
  });

  it("gives a single-line wide card a shorter band", () => {
    const short = heightOf(smRowSpanOf(dashboardCellClass("wide", false, true)));

    expect(short).toBe(84);
    expect(short).toBeLessThan(heightOf(smRowSpanOf(dashboardCellClass("wide", false))));
  });

  /**
   * The short band is one line of pills across four columns. Across two, the same pills wrap
   * onto more lines than 84px holds, so that board gives it the ordinary band instead.
   */
  it("keeps the ordinary band for a single-line wide card on a two-column board", () => {
    expect(heightOf(smRowSpanOf(dashboardCellClass("wide", false, true), 2))).toBe(136);
  });

  it("switches columns on the board's own width, not the window's", () => {
    expect(DASHBOARD_GRID_CLASS).toContain("@min-[36rem]/dashboard:grid-cols-2");
    expect(DASHBOARD_GRID_CLASS).toContain("@min-[60rem]/dashboard:grid-cols-4");
    expect(DASHBOARD_GRID_CLASS).not.toMatch(/(^|\s)(sm|md|lg):/);
  });

  /**
   * The shallow bands are shallow *because* they are wide. On a single-column board a band is no
   * longer a strip across four columns — it is a phone-width box, and 136px or 84px of it cut
   * the card's content off. There every cell is at least the full height, and may grow: with no
   * neighbours in its row, a fixed height only ever cost the bottom of the card.
   */
  it("gives every cell at least the full height, and room to grow, on a phone", () => {
    const cells = [
      dashboardCellClass("small", false),
      dashboardCellClass("medium", false),
      dashboardCellClass("wide", false),
      dashboardCellClass("wide", true),
      dashboardCellClass("wide", false, true),
    ];

    for (const cell of cells) {
      // 18.25rem is the 292px full cell.
      expect(cell).toMatch(/(^|\s)min-h-\[18\.25rem\](\s|$)/);
      expect(cell).toContain("@min-[36rem]/dashboard:min-h-0");
      // No base (phone) row span: the track there is `auto`, so the card sets the height.
      expect(cell).not.toMatch(/(^|\s)row-span-\d/);
    }
    expect(DASHBOARD_GRID_CLASS).not.toMatch(/(^|\s)auto-rows-/);
  });

  it("prefers the roomier height when a widget claims both", () => {
    // A catalog entry asking for extra height and for less of it is a mistake; the reading
    // that cannot clip its content wins.
    expect(dashboardCellClass("wide", true, true)).toBe(dashboardCellClass("wide", true));
  });

  it("ignores the wide-only flags at the other sizes", () => {
    expect(dashboardCellClass("small", true, true)).toBe(dashboardCellClass("small", false));
    expect(dashboardCellClass("medium", true, true)).toBe(dashboardCellClass("medium", false));
  });
});
