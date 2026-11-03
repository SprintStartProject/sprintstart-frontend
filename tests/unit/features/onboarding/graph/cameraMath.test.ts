import { describe, expect, it } from "vitest";
import {
  clampZoom,
  easeInOut,
  fitViewport,
  flightFrame,
  graphBounds,
  MAX_ZOOM,
  MIN_ZOOM,
  minimapLayout,
  revealShift,
  snapPoint,
  toWorldPoint,
  viewCenter,
  viewportIntoNode,
  wheelScale,
  zoomedAround,
} from "../../../../../src/features/onboarding/graph/cameraMath";

const NODE = { width: 200, height: 80 };

describe("clampZoom", () => {
  it("keeps a zoom inside the limits", () => {
    expect(clampZoom(1)).toBe(1);
    expect(clampZoom(0.01)).toBe(MIN_ZOOM);
    expect(clampZoom(10)).toBe(MAX_ZOOM);
  });
});

describe("easeInOut", () => {
  it("starts at 0, ends at 1 and is half done halfway", () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(0.5)).toBeCloseTo(0.5, 10);
  });

  it("is slower than linear at the start and faster at the end", () => {
    expect(easeInOut(0.25)).toBeLessThan(0.25);
    expect(easeInOut(0.75)).toBeGreaterThan(0.75);
  });
});

describe("snapPoint", () => {
  it("rounds to the grid", () => {
    expect(snapPoint({ x: 14, y: 16 })).toEqual({ x: 10, y: 20 });
    expect(snapPoint({ x: -14, y: 5 })).toEqual({ x: -10, y: 10 });
  });
});

describe("graphBounds", () => {
  it("is null for an empty graph", () => {
    expect(graphBounds([], NODE)).toBeNull();
  });

  it("wraps every node, cards included", () => {
    const bounds = graphBounds(
      [
        { x: 0, y: 0 },
        { x: 500, y: 300 },
      ],
      NODE,
    );
    expect(bounds).toEqual({ minX: -100, maxX: 600, minY: -40, maxY: 340 });
  });
});

describe("fitViewport", () => {
  const bounds = { minX: 0, maxX: 656, minY: 0, maxY: 356 };

  it("fits the whole graph in the middle of the canvas", () => {
    const view = fitViewport(bounds, { width: 800, height: 500 });
    expect(view.zoom).toBeCloseTo(1, 10);
    expect(view.x).toBeCloseTo(800 / 2 - 328, 10);
    expect(view.y).toBeCloseTo(500 / 2 - 178, 10);
  });

  it("never zooms in past 100 %", () => {
    expect(
      fitViewport({ minX: 0, maxX: 10, minY: 0, maxY: 10 }, { width: 800, height: 600 }).zoom,
    ).toBe(1);
  });

  it("zooms out to fit what is larger than the canvas", () => {
    const view = fitViewport(
      { minX: 0, maxX: 2000, minY: 0, maxY: 100 },
      { width: 1144, height: 600 },
    );
    expect(view.zoom).toBeCloseTo(0.5, 10);
  });

  it("is limited by the height when that is the tighter side", () => {
    const view = fitViewport(
      { minX: 0, maxX: 100, minY: 0, maxY: 1000 },
      { width: 800, height: 644 },
    );
    expect(view.zoom).toBeCloseTo(0.5, 10);
  });

  it("opens on the focus node when the whole graph would be too small to read", () => {
    const view = fitViewport(
      { minX: 0, maxX: 6000, minY: 0, maxY: 100 },
      { width: 1000, height: 600 },
      { x: 1000, y: 200 },
    );
    expect(view).toEqual({ zoom: 0.8, x: 500 - 800, y: 200 - 160 });
  });

  it("ignores the focus while the whole graph is still readable", () => {
    const withFocus = fitViewport(bounds, { width: 800, height: 500 }, { x: 10, y: 10 });
    expect(withFocus).toEqual(fitViewport(bounds, { width: 800, height: 500 }));
  });
});

describe("viewportIntoNode", () => {
  it("makes the node fill the canvas, a little short of the edges", () => {
    const view = viewportIntoNode({ x: 100, y: 50 }, { width: 1000, height: 400 }, NODE);
    expect(view.zoom).toBeCloseTo(5 * 0.92, 10);
    expect(view.x).toBeCloseTo(500 - 100 * view.zoom, 10);
    expect(view.y).toBeCloseTo(200 - 50 * view.zoom, 10);
  });

  it("is limited by the tighter side", () => {
    const view = viewportIntoNode({ x: 0, y: 0 }, { width: 200, height: 800 }, NODE);
    expect(view.zoom).toBeCloseTo(0.92, 10);
  });
});

describe("viewCenter", () => {
  it("is the world point under the middle of the canvas", () => {
    expect(viewCenter({ x: 100, y: 50, zoom: 2 }, { width: 800, height: 400 })).toEqual({
      x: 150,
      y: 75,
    });
  });
});

describe("revealShift", () => {
  const size = { width: 1000, height: 600 };
  const view = { x: 0, y: 0, zoom: 1 };

  it("does not move for a node that is well inside", () => {
    expect(revealShift({ x: 500, y: 300 }, view, size, NODE)).toEqual({ dx: 0, dy: 0 });
  });

  it("moves right for a node off the left edge", () => {
    expect(revealShift({ x: 0, y: 300 }, view, size, NODE)).toEqual({ dx: 124, dy: 0 });
  });

  it("moves left for a node off the right edge", () => {
    expect(revealShift({ x: 1000, y: 300 }, view, size, NODE)).toEqual({ dx: -124, dy: 0 });
  });

  it("moves down for a node above the top and up for one below the bottom", () => {
    expect(revealShift({ x: 500, y: 0 }, view, size, NODE)).toEqual({ dx: 0, dy: 64 });
    expect(revealShift({ x: 500, y: 600 }, view, size, NODE)).toEqual({ dx: 0, dy: -64 });
  });

  it("measures the margin at the zoom the view is on", () => {
    expect(revealShift({ x: 0, y: 300 }, { x: 0, y: 0, zoom: 0.5 }, size, NODE)).toEqual({
      dx: 74,
      dy: 0,
    });
  });

  it("leaves a node exactly at the margin where it is", () => {
    expect(revealShift({ x: 124, y: 300 }, view, size, NODE).dx).toBe(0);
    expect(revealShift({ x: 876, y: 300 }, view, size, NODE).dx).toBe(0);
  });
});

describe("zoomedAround", () => {
  it("holds the world point under the pointer still", () => {
    const before = { x: 30, y: 20, zoom: 1 };
    const after = zoomedAround(before, 1.5, 100, 100);
    expect(after.zoom).toBe(1.5);
    expect((100 - after.x) / after.zoom).toBeCloseTo((100 - before.x) / before.zoom, 10);
    expect((100 - after.y) / after.zoom).toBeCloseTo((100 - before.y) / before.zoom, 10);
  });

  it("stops at the zoom limits", () => {
    expect(zoomedAround({ x: 0, y: 0, zoom: 1 }, 100, 0, 0).zoom).toBe(MAX_ZOOM);
    expect(zoomedAround({ x: 0, y: 0, zoom: 1 }, 0.001, 0, 0).zoom).toBe(MIN_ZOOM);
  });
});

describe("flightFrame", () => {
  const origin = { x: 0, y: 0, zoom: 0.5 };
  const target = { x: 100, y: 200, zoom: 2 };

  it("starts at the origin and ends at the target", () => {
    expect(flightFrame(origin, target, 0)).toEqual(origin);
    const end = flightFrame(origin, target, 1);
    expect(end.x).toBe(100);
    expect(end.y).toBe(200);
    expect(end.zoom).toBeCloseTo(2, 10);
  });

  it("zooms on a log scale, so halfway is the geometric mean", () => {
    expect(flightFrame(origin, target, 0.5).zoom).toBeCloseTo(1, 10);
    expect(flightFrame(origin, target, 0.5).x).toBeCloseTo(50, 10);
  });
});

describe("wheelScale", () => {
  it("counts pixels, lines and pages", () => {
    expect(wheelScale(0, 500)).toBe(1);
    expect(wheelScale(1, 500)).toBe(16);
    expect(wheelScale(2, 500)).toBe(500);
  });
});

describe("toWorldPoint", () => {
  it("undoes the offset of the element and the view", () => {
    expect(
      toWorldPoint({ x: 300, y: 250 }, { left: 100, top: 50 }, { x: 20, y: 40, zoom: 2 }),
    ).toEqual({ x: 90, y: 80 });
  });
});

describe("minimapLayout", () => {
  it("scales the graph to fit with a margin and centres it", () => {
    const layout = minimapLayout({ minX: 0, maxX: 312, minY: 0, maxY: 80 });
    expect(layout.width).toBe(168);
    expect(layout.height).toBe(104);
    expect(layout.scale).toBeCloseTo(0.5, 10);
    expect(layout.offsetX).toBeCloseTo((168 - 156) / 2, 10);
    expect(layout.offsetY).toBeCloseTo((104 - 40) / 2, 10);
  });

  it("is limited by the height of a tall graph", () => {
    const layout = minimapLayout({ minX: 0, maxX: 10, minY: 0, maxY: 920 });
    expect(layout.scale).toBeCloseTo(0.1, 10);
  });

  it("allows for the bounds not starting at the origin", () => {
    const layout = minimapLayout({ minX: 100, maxX: 412, minY: 50, maxY: 130 });
    expect(layout.offsetX).toBeCloseTo((168 - 156) / 2 - 50, 10);
    expect(layout.offsetY).toBeCloseTo((104 - 40) / 2 - 25, 10);
  });
});
