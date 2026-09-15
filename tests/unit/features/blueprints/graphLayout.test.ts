import { describe, expect, it } from "vitest";
import {
  GRAPH_NODE_HEIGHT,
  GRAPH_NODE_WIDTH,
  autoLayoutPositions,
  canConnect,
  chainFor,
  chainPositions,
  compactTitlePx,
  edgeRefusal,
  entryPointIds,
  withFallbackPositions,
  type GraphRuleNode,
} from "../../../../src/features/blueprints/components/graphLayout";

/** A placed node, since most of these rules only apply to what is actually drawn. */
function node(id: string, blockerIds: string[] = [], x = 0, y = 0): GraphRuleNode {
  return { id, blockerIds, graphX: x, graphY: y };
}

describe("edgeRefusal", () => {
  it("refuses a node waiting for itself", () => {
    expect(edgeRefusal([node("a")], "a", "a")).toBe("self");
  });

  it("refuses an edge that already exists", () => {
    const nodes = [node("a"), node("b", ["a"])];

    expect(edgeRefusal(nodes, "b", "a")).toBe("duplicate");
  });

  it("refuses the edge that would close a two-node ring", () => {
    const nodes = [node("a"), node("b", ["a"])];

    // a already comes before b, so making b come before a leaves neither able to start.
    expect(edgeRefusal(nodes, "a", "b")).toBe("cycle");
  });

  it("refuses a ring that closes through three nodes", () => {
    const nodes = [node("a"), node("b", ["a"]), node("c", ["b"])];

    expect(edgeRefusal(nodes, "a", "c")).toBe("cycle");
  });

  it("allows a second path to the same node", () => {
    // a → b, a → c, and now b → d and c → d. A diamond is not a ring.
    const nodes = [node("a"), node("b", ["a"]), node("c", ["a"]), node("d", ["b"])];

    expect(edgeRefusal(nodes, "d", "c")).toBeNull();
    expect(canConnect(nodes, "d", "c")).toBe(true);
  });

  it("terminates on a ring that somehow got stored", () => {
    const nodes = [node("a", ["b"]), node("b", ["a"]), node("c")];

    expect(edgeRefusal(nodes, "c", "a")).toBeNull();
  });
});

describe("entryPointIds", () => {
  it("names the nodes nothing has to happen before", () => {
    const nodes = [node("a"), node("b", ["a"]), node("c")];

    expect(entryPointIds(nodes)).toEqual(new Set(["a", "c"]));
  });

  it("counts a node whose only blocker is not on the canvas", () => {
    // The edge is invisible either way, so calling this a starting point is the honest reading.
    const nodes = [node("b", ["gone"])];

    expect(entryPointIds(nodes)).toEqual(new Set(["b"]));
  });

  it("finds nothing in a graph that is all ring", () => {
    const nodes = [node("a", ["b"]), node("b", ["a"])];

    expect(entryPointIds(nodes)).toEqual(new Set());
  });
});

describe("chainFor", () => {
  it("lights what a node waits on and what waits on it, in both directions", () => {
    const nodes = [node("a"), node("b", ["a"]), node("c", ["b"]), node("unrelated")];

    expect(chainFor(nodes, "b")).toEqual(new Set(["a", "b", "c"]));
  });

  it("leaves a sibling branch out", () => {
    const nodes = [node("root"), node("left", ["root"]), node("right", ["root"])];

    expect(chainFor(nodes, "left")).toEqual(new Set(["root", "left"]));
  });

  it("terminates on a ring", () => {
    const nodes = [node("a", ["b"]), node("b", ["a"])];

    expect(chainFor(nodes, "a")).toEqual(new Set(["a", "b"]));
  });
});

describe("withFallbackPositions", () => {
  it("keeps a stored position untouched", () => {
    const positions = withFallbackPositions([node("a", [], 120, -40)]);

    expect(positions.a).toEqual({ x: 120, y: -40 });
  });

  it("places a node that was never dragged", () => {
    const positions = withFallbackPositions([
      { id: "a", blockerIds: [], graphX: null, graphY: null },
    ]);

    expect(positions.a).toEqual({ x: 0, y: 0 });
  });

  it("does not stack unplaced nodes on one another", () => {
    const unplaced = Array.from({ length: 6 }, (_, index) => ({
      id: `n${index}`,
      blockerIds: [],
      graphX: null,
      graphY: null,
    }));

    const positions = withFallbackPositions(unplaced);
    const distinct = new Set(Object.values(positions).map((point) => `${point.x}:${point.y}`));

    expect(distinct.size).toBe(6);
  });

  it("does not drop an unplaced node onto an occupied cell", () => {
    const positions = withFallbackPositions([
      node("placed", [], 0, 0),
      { id: "loose", blockerIds: [], graphX: null, graphY: null },
    ]);

    expect(positions.loose).not.toEqual(positions.placed);
  });

  it("gives the same answer twice", () => {
    const nodes = [
      { id: "a", blockerIds: [], graphX: null, graphY: null },
      { id: "b", blockerIds: [], graphX: null, graphY: null },
    ];

    expect(withFallbackPositions(nodes)).toEqual(withFallbackPositions(nodes));
  });
});

describe("autoLayoutPositions", () => {
  it("has nothing to say about an empty graph", () => {
    expect(autoLayoutPositions([])).toEqual({});
  });

  it("puts a chain left to right", () => {
    const positions = autoLayoutPositions([node("a"), node("b", ["a"]), node("c", ["b"])]);

    expect(positions.a.x).toBeLessThan(positions.b.x);
    expect(positions.b.x).toBeLessThan(positions.c.x);
  });

  it("gives two independent branches different rows", () => {
    const positions = autoLayoutPositions([
      node("root"),
      node("left", ["root"]),
      node("right", ["root"]),
    ]);

    expect(positions.left.y).not.toBe(positions.right.y);
  });

  it("packs unsequenced nodes into a block instead of one long row", () => {
    const loose = Array.from({ length: 6 }, (_, index) => node(`n${index}`));
    const positions = autoLayoutPositions(loose);
    const rows = new Set(Object.values(positions).map((point) => point.y));

    expect(rows.size).toBeGreaterThan(1);
  });

  it("keeps unsequenced nodes clear of the chains above them", () => {
    const positions = autoLayoutPositions([node("a"), node("b", ["a"]), node("loose")]);
    const chainBottom = Math.max(positions.a.y, positions.b.y);

    expect(positions.loose.y).toBeGreaterThan(chainBottom);
  });

  it("leaves no two nodes on top of each other", () => {
    const positions = autoLayoutPositions([
      node("a"),
      node("b", ["a"]),
      node("c", ["a"]),
      node("d", ["b", "c"]),
      node("loose1"),
      node("loose2"),
    ]);

    const points = Object.values(positions);
    for (const [index, point] of points.entries()) {
      for (const other of points.slice(index + 1)) {
        const overlaps =
          Math.abs(point.x - other.x) < GRAPH_NODE_WIDTH &&
          Math.abs(point.y - other.y) < GRAPH_NODE_HEIGHT;
        expect(overlaps).toBe(false);
      }
    }
  });

  it("terminates on a ring rather than hanging the render", () => {
    const positions = autoLayoutPositions([node("a", ["b"]), node("b", ["a"])]);

    expect(Object.keys(positions).sort()).toEqual(["a", "b"]);
  });
});

describe("chainPositions", () => {
  it("numbers a chain in order", () => {
    const positions = chainPositions([node("a"), node("b", ["a"]), node("c", ["b"])]);

    expect(positions.get("a")).toEqual({ index: 1, total: 3 });
    expect(positions.get("b")).toEqual({ index: 2, total: 3 });
    expect(positions.get("c")).toEqual({ index: 3, total: 3 });
  });

  it("says nothing about a node in no chain at all", () => {
    const positions = chainPositions([node("a"), node("b", ["a"]), node("loose")]);

    expect(positions.has("loose")).toBe(false);
  });

  it("numbers two separate chains independently", () => {
    const positions = chainPositions([
      node("a"),
      node("b", ["a"]),
      node("x"),
      node("y", ["x"]),
      node("z", ["y"]),
    ]);

    expect(positions.get("b")).toEqual({ index: 2, total: 2 });
    expect(positions.get("z")).toEqual({ index: 3, total: 3 });
  });

  it("counts a branch as one chain, since its members do wait on each other", () => {
    const positions = chainPositions([
      node("root"),
      node("left", ["root"]),
      node("right", ["root"]),
    ]);

    expect(positions.get("root")).toEqual({ index: 1, total: 3 });
    expect(positions.get("left")?.total).toBe(3);
  });

  it("never puts a node before something it waits on", () => {
    const nodes = [node("c", ["b"]), node("a"), node("b", ["a"])];
    const positions = chainPositions(nodes);

    for (const item of nodes) {
      for (const blockerId of item.blockerIds) {
        expect(positions.get(item.id)!.index).toBeGreaterThan(positions.get(blockerId)!.index);
      }
    }
  });

  it("refuses to number a run that holds a ring", () => {
    const positions = chainPositions([node("a", ["b"]), node("b", ["a"]), node("free")]);

    expect(positions.size).toBe(0);
  });

  it("ignores an edge to a node that is not on the canvas", () => {
    const positions = chainPositions([node("only", ["elsewhere"])]);

    expect(positions.size).toBe(0);
  });
});

describe("compactTitlePx", () => {
  it("leaves the title alone at full zoom", () => {
    expect(compactTitlePx(1)).toBe(13);
  });

  it("grows the title as the canvas shrinks, so the screen size stays put", () => {
    // 13 canvas pixels at zoom 0.5 would be 6.5 on screen; 26 canvas pixels are 13 again.
    expect(compactTitlePx(0.5)).toBe(26);
  });

  it("stops before the title outgrows its own card", () => {
    expect(compactTitlePx(0.05)).toBe(40);
  });

  it("never shrinks below the normal size", () => {
    expect(compactTitlePx(2)).toBe(13);
  });
});
