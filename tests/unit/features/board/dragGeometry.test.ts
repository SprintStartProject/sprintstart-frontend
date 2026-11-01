import { afterEach, describe, expect, it, vi } from "vitest";
import {
  centerOf,
  contains,
  inMiddle,
  MIDDLE_HOLD_REACH,
  toViewport,
} from "../../../../src/features/board/layout/dragGeometry";

function box(left: number, top: number, width: number, height: number): HTMLElement {
  const element = document.createElement("div");
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  });

  return element;
}

afterEach(() => vi.restoreAllMocks());

describe("centerOf", () => {
  it("is the middle of the box", () => {
    expect(centerOf(box(100, 40, 200, 60))).toEqual({ x: 200, y: 70 });
  });
});

describe("contains", () => {
  const element = () => box(100, 100, 100, 50);

  it("includes the inside and every edge", () => {
    expect(contains(element(), 150, 125)).toBe(true);
    expect(contains(element(), 100, 100)).toBe(true);
    expect(contains(element(), 200, 150)).toBe(true);
  });

  it("excludes a point past any side", () => {
    expect(contains(element(), 99, 125)).toBe(false);
    expect(contains(element(), 201, 125)).toBe(false);
    expect(contains(element(), 150, 99)).toBe(false);
    expect(contains(element(), 150, 151)).toBe(false);
  });
});

describe("inMiddle", () => {
  const element = () => box(0, 0, 100, 100);

  it("is the quarter either way around the centre by default", () => {
    expect(inMiddle(element(), 50, 50)).toBe(true);
    expect(inMiddle(element(), 75, 25)).toBe(true);
    expect(inMiddle(element(), 76, 50)).toBe(false);
    expect(inMiddle(element(), 50, 24)).toBe(false);
  });

  it("needs both directions to be close", () => {
    expect(inMiddle(element(), 75, 76)).toBe(false);
  });

  it("reaches further with a larger reach", () => {
    expect(inMiddle(element(), 90, 50, MIDDLE_HOLD_REACH)).toBe(true);
    expect(inMiddle(element(), 91, 50, MIDDLE_HOLD_REACH)).toBe(false);
  });
});

describe("toViewport", () => {
  it("takes the page's scroll off a page point", () => {
    vi.spyOn(window, "scrollX", "get").mockReturnValue(30);
    vi.spyOn(window, "scrollY", "get").mockReturnValue(500);

    expect(toViewport({ x: 100, y: 700 })).toEqual({ x: 70, y: 200 });
  });

  it("leaves a point alone on an unscrolled page", () => {
    expect(toViewport({ x: 12, y: 34 })).toEqual({ x: 12, y: 34 });
  });
});
