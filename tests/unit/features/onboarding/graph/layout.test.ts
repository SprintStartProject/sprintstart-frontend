import { describe, expect, it } from "vitest";
import {
  collectDownstream,
  collectUpstream,
  computeRanks,
  edgeKey,
  layeredLayout,
  orderByGraph,
  resolveLayout,
  routeEdges,
  wouldCreateCycle,
} from "../../../../../src/features/onboarding/graph/layout";

const node = (id: string, blockerIds: string[] = [], graphX?: number, graphY?: number) => ({
  id,
  blockerIds,
  graphX: graphX ?? null,
  graphY: graphY ?? null,
});

describe("onboarding graph layout", () => {
  it("puts every node one row below the deepest thing it waits on", () => {
    const ranks = computeRanks([node("a"), node("b", ["a"]), node("c", ["a", "b"]), node("d")]);

    expect(Object.fromEntries(ranks)).toEqual({ a: 0, b: 1, c: 2, d: 0 });
  });

  it("survives a cycle instead of recursing forever", () => {
    expect(() => computeRanks([node("a", ["b"]), node("b", ["a"])])).not.toThrow();
  });

  it("ignores blockers that are not part of the graph", () => {
    expect(computeRanks([node("a", ["filtered-out"])]).get("a")).toBe(0);
  });

  it("lays out top to bottom and centres each row", () => {
    const positions = layeredLayout([node("a"), node("b", ["a"]), node("c", ["a"])], {
      columnGap: 100,
      rowGap: 50,
    });

    expect(positions.get("a")).toEqual({ x: 0, y: -25 });
    expect(positions.get("b")!.y).toBe(25);
    expect(positions.get("b")!.x).toBe(-positions.get("c")!.x);
  });

  it("wraps a row wider than maxPerRow onto a second line", () => {
    const children = ["b", "c", "d", "e", "f"].map((id) => node(id, ["a"]));
    const positions = layeredLayout([node("a"), ...children], {
      columnGap: 100,
      rowGap: 50,
      maxPerRow: 3,
    });

    const lines = new Set(children.map((child) => positions.get(child.id)!.y));
    expect(lines.size).toBe(2);
  });

  it("uses a stored layout only when every node has one and no cards overlap", () => {
    const stored = [node("a", [], 0, 0), node("b", ["a"], 0, 300)];
    expect(resolveLayout(stored, undefined, { width: 200, height: 80 }).isAutomatic).toBe(false);

    const partial = [node("a", [], 0, 0), node("b", ["a"])];
    expect(resolveLayout(partial).isAutomatic).toBe(true);

    const crowded = [node("a", [], 0, 0), node("b", [], 50, 0)];
    expect(resolveLayout(crowded, undefined, { width: 200, height: 80 }).isAutomatic).toBe(true);
  });

  it("orders nodes the way the graph reads", () => {
    const ordered = orderByGraph([node("late", ["early"]), node("early")]);

    expect(ordered.map((item) => item.id)).toEqual(["early", "late"]);
  });

  it("traces what a node needs and what it unlocks", () => {
    const nodes = [node("a"), node("b", ["a"]), node("c", ["b"]), node("x")];

    expect([...collectUpstream(nodes, "c")].sort()).toEqual(["a", "b"]);
    expect([...collectDownstream(nodes, "a")].sort()).toEqual(["b", "c"]);
  });

  it("recognises an edge that would close a loop", () => {
    const nodes = [node("a"), node("b", ["a"]), node("c", ["b"])];

    expect(wouldCreateCycle(nodes, "a", "c")).toBe(true);
    expect(wouldCreateCycle(nodes, "c", "a")).toBe(false);
    expect(wouldCreateCycle(nodes, "a", "a")).toBe(true);
  });
});

describe("routeEdges", () => {
  const footprint = { width: 200, height: 80 };

  it("takes an edge that skips a row around the card in its way", () => {
    const nodes = [
      { id: "top", blockerIds: [] },
      { id: "middle", blockerIds: ["top"] },
      { id: "bottom", blockerIds: ["top", "middle"] },
    ];
    const positions = new Map([
      ["top", { x: 0, y: 0 }],
      ["middle", { x: 0, y: 150 }],
      ["bottom", { x: 0, y: 300 }],
    ]);

    const routes = routeEdges(nodes, positions, footprint);

    const waypoints = routes.get(edgeKey("top", "bottom"));
    expect(waypoints).toHaveLength(1);
    expect(Math.abs(waypoints![0].x)).toBeGreaterThan(footprint.width / 2);
    expect(waypoints![0].y).toBe(150);
    // Neighbouring rows need no detour.
    expect(routes.has(edgeKey("top", "middle"))).toBe(false);
  });

  it("adds no waypoint where nothing is in the way, so the curve stays one sweep", () => {
    const nodes = [
      { id: "a", blockerIds: [] },
      { id: "far", blockerIds: [] },
      { id: "b", blockerIds: ["a"] },
    ];
    const positions = new Map([
      ["a", { x: 0, y: 0 }],
      ["far", { x: 900, y: 150 }],
      ["b", { x: 0, y: 300 }],
    ]);

    expect(routeEdges(nodes, positions, footprint).has(edgeKey("a", "b"))).toBe(false);
  });

  it("treats cards a few pixels apart in height as one row", () => {
    const nodes = [
      { id: "top", blockerIds: [] },
      { id: "left", blockerIds: [] },
      { id: "right", blockerIds: [] },
      { id: "bottom", blockerIds: ["top"] },
    ];
    const positions = new Map([
      ["top", { x: 0, y: 0 }],
      ["left", { x: -10, y: 148 }],
      ["right", { x: 400, y: 153 }],
      ["bottom", { x: 0, y: 300 }],
    ]);

    expect(routeEdges(nodes, positions, footprint).get(edgeKey("top", "bottom"))).toHaveLength(1);
  });
});
