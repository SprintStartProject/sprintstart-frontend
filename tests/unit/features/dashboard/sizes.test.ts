import { describe, it, expect } from "vitest";
import {
  DASHBOARD_GRID_CLASS,
  dashboardCellClass,
} from "../../../../src/features/dashboard/layout/sizes";

/** Pixel height of a span, given the track size and the gaps between the rows it covers. */
function heightOf(rowSpan: number, trackPx = 32, gapPx = 20): number {
  return rowSpan * trackPx + (rowSpan - 1) * gapPx;
}

function rowSpanOf(className: string): number {
  const match = /row-span-(\d+)/.exec(className);
  if (!match) throw new Error(`no row span in "${className}"`);

  return Number(match[1]);
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
    expect(DASHBOARD_GRID_CLASS).toContain("auto-rows-[2rem]");
    expect(DASHBOARD_GRID_CLASS).toContain("gap-5");
  });

  it("keeps small and medium at the height a 8.5rem track gave them", () => {
    // Two 8.5rem rows plus the gap between them.
    const before = 2 * 136 + 20;

    expect(heightOf(rowSpanOf(dashboardCellClass("small", false)))).toBe(before);
    expect(heightOf(rowSpanOf(dashboardCellClass("medium", false)))).toBe(before);
  });

  it("keeps both wide forms at the heights they had", () => {
    expect(heightOf(rowSpanOf(dashboardCellClass("wide", false)))).toBe(136);
    expect(heightOf(rowSpanOf(dashboardCellClass("wide", true)))).toBe(2 * 136 + 20);
  });

  it("gives a single-line wide card a shorter band", () => {
    const short = heightOf(rowSpanOf(dashboardCellClass("wide", false, true)));

    expect(short).toBe(84);
    expect(short).toBeLessThan(heightOf(rowSpanOf(dashboardCellClass("wide", false))));
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
