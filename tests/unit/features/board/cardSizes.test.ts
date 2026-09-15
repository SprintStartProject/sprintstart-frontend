import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_SIZE,
  GRID_COLUMNS,
  isDefault,
  readCardSizes,
  sizeFromDrag,
  sizeOf,
  WIDTH_SPAN,
  writeCardSizes,
} from "../../../../src/features/board/layout/cardSizes";

describe("the size a hire pulled a card to", () => {
  beforeEach(() => window.localStorage.clear());

  it("round-trips a size", () => {
    writeCardSizes("b1", { c1: { width: "narrow" } });

    expect(readCardSizes("b1").c1).toEqual({ width: "narrow" });
  });

  it("defaults a card nobody has touched", () => {
    expect(sizeOf({}, "c1")).toEqual(DEFAULT_SIZE);
    expect(sizeOf(undefined, "c1")).toEqual(DEFAULT_SIZE);
  });

  it("drops an entry that says nothing happened", () => {
    // Storage holds decisions. A row per card saying "unchanged" is not one, and it is what would
    // slowly turn a preference into a copy of the board.
    writeCardSizes("b1", { c1: DEFAULT_SIZE, c2: { width: "wide" } });

    expect(Object.keys(readCardSizes("b1"))).toEqual(["c2"]);
    expect(isDefault(DEFAULT_SIZE)).toBe(true);
  });

  it("reads rubbish in storage as the default rather than falling over", () => {
    window.localStorage.setItem("sprintstart:board-card-sizes:b2", "{not json");
    expect(readCardSizes("b2")).toEqual({});

    window.localStorage.setItem(
      "sprintstart:board-card-sizes:b3",
      JSON.stringify({ version: 1, sizes: { c1: { width: "enormous" } } }),
    );

    // Every field falls back on its own, and the entry then says nothing and is dropped.
    expect(readCardSizes("b3")).toEqual({});
  });
});

describe("reading a drag as a size", () => {
  const normal = DEFAULT_SIZE;

  it("steps one width per threshold rather than jumping to the end", () => {
    // The widths are a ramp, and a gesture over a ramp has to be able to stop in the middle of it.
    expect(sizeFromDrag(normal, 60).width).toBe("wide");
    expect(sizeFromDrag({ width: "narrow" }, 60).width).toBe("normal");
    expect(sizeFromDrag({ width: "narrow" }, 200).width).toBe("wide");
  });

  it("goes narrower, which is the whole point of the third width", () => {
    expect(sizeFromDrag(normal, -60).width).toBe("narrow");
    expect(sizeFromDrag(normal, -400).width).toBe("narrow");
  });

  it("does nothing until the drag is really meant", () => {
    expect(sizeFromDrag(normal, 10)).toEqual(DEFAULT_SIZE);
  });

  it("goes back the way it came", () => {
    expect(sizeFromDrag({ width: "wide" }, -60)).toEqual(DEFAULT_SIZE);
  });
});

describe("the widths as spans on the grid", () => {
  it("is one, two or four of four", () => {
    expect(WIDTH_SPAN.narrow).toBe(1);
    expect(WIDTH_SPAN.normal).toBe(2);
    expect(WIDTH_SPAN.wide).toBe(GRID_COLUMNS);
  });

  it("keeps a narrow card a real card by making normal an even number of columns", () => {
    // Narrow is half of normal, and wide is everything. Both need normal to divide the grid.
    expect(WIDTH_SPAN.normal % WIDTH_SPAN.narrow).toBe(0);
    expect(GRID_COLUMNS % WIDTH_SPAN.normal).toBe(0);
  });
});
