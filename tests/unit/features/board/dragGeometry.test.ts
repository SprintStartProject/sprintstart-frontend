import { afterEach, describe, expect, it, vi } from "vitest";
import {
  centerOf,
  contains,
  inMiddle,
  isHolding,
  isStillResting,
  MIDDLE_HOLD_REACH,
  restZone,
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

describe("what a dragged card rests on", () => {
  const rested = (zone: "middle" | "edge", x = 10, y = 10) => ({ id: "c1", zone, x, y });

  it("holds the middle only for the very card it was resting in the middle of", () => {
    expect(isHolding(rested("middle"), "c1")).toBe(true);
    expect(isHolding(rested("middle"), "c2")).toBe(false);
    expect(isHolding(rested("edge"), "c1")).toBe(false);
    expect(isHolding(null, "c1")).toBe(false);
  });

  it("tells the middle from the edge, and never finds a middle where nothing can be piled", () => {
    const element = box(0, 0, 100, 100);

    expect(restZone(element, { x: 50, y: 50 }, false, true)).toBe("middle");
    expect(restZone(element, { x: 50, y: 50 }, false, false)).toBe("edge");
    expect(restZone(element, { x: 5, y: 50 }, false, true)).toBe("edge");
  });

  it("reaches further into the middle once the pointer is already holding it", () => {
    const element = box(0, 0, 100, 100);

    expect(restZone(element, { x: 85, y: 50 }, false, true)).toBe("edge");
    expect(restZone(element, { x: 85, y: 50 }, true, true)).toBe("middle");
  });

  it("is still resting in the middle wherever in it the pointer moves", () => {
    expect(isStillResting(rested("middle", 0, 0), "c1", "middle", { x: 80, y: 80 })).toBe(true);
  });

  it("is still resting on an edge only while the pointer stays within a few pixels", () => {
    const edge = rested("edge", 100, 100);

    expect(isStillResting(edge, "c1", "edge", { x: 105, y: 106 })).toBe(true);
    expect(isStillResting(edge, "c1", "edge", { x: 109, y: 100 })).toBe(false);
  });

  it("is not resting on a different card, a different zone, or nothing", () => {
    expect(isStillResting(rested("edge"), "c2", "edge", { x: 10, y: 10 })).toBe(false);
    expect(isStillResting(rested("edge"), "c1", "middle", { x: 10, y: 10 })).toBe(false);
    expect(isStillResting(null, "c1", "edge", { x: 10, y: 10 })).toBe(false);
  });
});
