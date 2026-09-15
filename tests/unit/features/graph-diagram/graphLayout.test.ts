import { describe, expect, it } from "vitest";
import {
  GRAPH_NODE_HEIGHT,
  GRAPH_NODE_WIDTH,
  MIN_NODE_GAP,
  arrangementFor,
  autoLayoutPositions,
  blockersBehind,
  blueprintEdgePath,
  canConnect,
  dependentsAhead,
  edgeSides,
  chainFor,
  chainPositions,
  compactTitlePx,
  edgeRefusal,
  entryPointIds,
  separateOverlaps,
  withFallbackPositions,
  type GraphRuleNode,
} from "../../../../src/features/graph-diagram/graphLayout.ts";

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

describe("separateOverlaps", () => {
  /** How far apart two cards have to be on an axis before they stop covering each other. */
  const clearX = GRAPH_NODE_WIDTH;
  const clearY = GRAPH_NODE_HEIGHT;

  function overlaps(positions: ReturnType<typeof separateOverlaps>, a: string, b: string) {
    return (
      Math.abs(positions[a].x - positions[b].x) < clearX &&
      Math.abs(positions[a].y - positions[b].y) < clearY
    );
  }

  it("leaves positions that already clear each other exactly where they are", () => {
    const nodes = [node("a", [], 0, 0), node("b", [], 400, 0)];
    const before = withFallbackPositions(nodes);

    expect(separateOverlaps(nodes, before)).toEqual(before);
  });

  it("pushes apart the geometry the seeded blueprint actually stores", () => {
    // Two of the seeded phases sit 226 apart on x with 2 between them on y, against a card 248
    // wide: the seed was laid out for a narrower card, so it draws them on top of each other.
    const nodes = [node("meetings", [], 0, 0), node("industry", [], 226, 2)];

    const positions = separateOverlaps(nodes, withFallbackPositions(nodes));

    expect(overlaps(positions, "meetings", "industry")).toBe(false);
    expect(Math.abs(positions.industry.x - positions.meetings.x)).toBeGreaterThanOrEqual(
      GRAPH_NODE_WIDTH,
    );
  });

  it("separates a whole pile, not just the first pair it meets", () => {
    const nodes = [
      node("a", [], 0, 0),
      node("b", [], 20, 10),
      node("c", [], 40, 20),
      node("d", [], 60, 30),
    ];

    const positions = separateOverlaps(nodes, withFallbackPositions(nodes));

    for (const [left, right] of [
      ["a", "b"],
      ["a", "c"],
      ["a", "d"],
      ["b", "c"],
      ["b", "d"],
      ["c", "d"],
    ]) {
      expect(overlaps(positions, left, right)).toBe(false);
    }
  });

  it("parts two cards stacked at the same point rather than leaving them stacked", () => {
    const nodes = [node("a", [], 120, 120), node("b", [], 120, 120)];

    const positions = separateOverlaps(nodes, withFallbackPositions(nodes));

    expect(overlaps(positions, "a", "b")).toBe(false);
  });

  it("draws the same graph the same way every time", () => {
    const nodes = [node("a", [], 0, 0), node("b", [], 226, 2), node("c", [], 100, 40)];
    const first = separateOverlaps(nodes, withFallbackPositions(nodes));
    const second = separateOverlaps(nodes, withFallbackPositions(nodes));

    expect(second).toEqual(first);
  });

  it("is a nudge, not a re-layout: cards stay near where the author put them", () => {
    const nodes = [node("a", [], 0, 0), node("b", [], 226, 2)];

    const positions = separateOverlaps(nodes, withFallbackPositions(nodes));

    // Neither card moves further than the distance the pair was short of a clear gap.
    const shortfall = GRAPH_NODE_WIDTH + MIN_NODE_GAP - 226;
    expect(Math.abs(positions.a.x)).toBeLessThanOrEqual(shortfall);
    expect(Math.abs(positions.b.x - 226)).toBeLessThanOrEqual(shortfall);
  });

  it("ignores a node with nowhere to be", () => {
    const nodes = [node("a", [], 0, 0), { id: "gone", blockerIds: [], graphX: null, graphY: null }];

    const positions = separateOverlaps(nodes, { a: { x: 0, y: 0 } });

    expect(positions.gone).toBeUndefined();
    expect(positions.a).toEqual({ x: 0, y: 0 });
  });
});

/** The sides two cards side by side use: out of the right, into the left. */
const ACROSS = { source: "right", target: "left" } as const;

describe("edgeSides", () => {
  it("sends an edge out of the side its target lies on", () => {
    expect(edgeSides({ x: 0, y: 0 }, { x: 400, y: 0 })).toEqual({
      source: "right",
      target: "left",
    });
    expect(edgeSides({ x: 400, y: 0 }, { x: 0, y: 0 })).toEqual({
      source: "left",
      target: "right",
    });
  });

  it("reaches a card below through the bottom rather than around the side", () => {
    expect(edgeSides({ x: 0, y: 0 }, { x: 0, y: 300 })).toEqual({
      source: "bottom",
      target: "top",
    });
    expect(edgeSides({ x: 0, y: 300 }, { x: 0, y: 0 })).toEqual({
      source: "top",
      target: "bottom",
    });
  });

  it("judges the axis against the card's shape, not in bare pixels", () => {
    // 200 to the right and 200 down are the same number and not the same displacement: the card is
    // 248 wide and 168 tall, so 200 down clears it and 200 across does not.
    expect(edgeSides({ x: 0, y: 0 }, { x: 200, y: 200 }).source).toBe("bottom");
    expect(edgeSides({ x: 0, y: 0 }, { x: 400, y: 200 }).source).toBe("right");
  });

  it("gives the same pair of cards the same sides every time", () => {
    expect(edgeSides({ x: 12, y: 30 }, { x: 350, y: 96 })).toEqual(
      edgeSides({ x: 12, y: 30 }, { x: 350, y: 96 }),
    );
  });
});

describe("blueprintEdgePath", () => {
  /** The four control values of a cubic `M sx,sy C c1x,c1y c2x,c2y tx,ty`. */
  function parse(path: string) {
    const numbers = path.match(/-?\d+(\.\d+)?/g)!.map(Number);
    expect(numbers).toHaveLength(8);
    const [sx, sy, c1x, c1y, c2x, c2y, tx, ty] = numbers;
    return { sx, sy, c1x, c1y, c2x, c2y, tx, ty };
  }

  it("draws one cubic curve, from the source handle to the target handle", () => {
    const path = blueprintEdgePath({ x: 0, y: 0 }, { x: 400, y: 120 }, ACROSS);
    const { sx, sy, tx, ty } = parse(path);

    expect(path.startsWith("M 0,0 C ")).toBe(true);
    expect([sx, sy]).toEqual([0, 0]);
    expect([tx, ty]).toEqual([400, 120]);
  });

  it("leaves each handle horizontally, which is the direction the handle faces", () => {
    const { sx, c1x, c2x, tx } = parse(
      blueprintEdgePath({ x: 0, y: 0 }, { x: 400, y: 120 }, ACROSS),
    );

    expect(c1x).toBeGreaterThan(sx);
    expect(c2x).toBeLessThan(tx);
  });

  it("reaches further the further it has to go, so a long edge sweeps", () => {
    const short = parse(blueprintEdgePath({ x: 0, y: 0 }, { x: 260, y: 120 }, ACROSS));
    const long = parse(blueprintEdgePath({ x: 0, y: 0 }, { x: 700, y: 120 }, ACROSS));

    expect(long.c1x - long.sx).toBeGreaterThan(short.c1x - short.sx);
  });

  it("stops reaching before a very long edge loops off the canvas", () => {
    const { sx, c1x } = parse(blueprintEdgePath({ x: 0, y: 0 }, { x: 4000, y: 0 }, ACROSS));

    expect(c1x - sx).toBeLessThanOrEqual(260);
  });

  it("bows an edge between two handles at the same height, rather than drawing a dash", () => {
    // Nothing tilts a curve between two points on one line, so without this the seeded blueprint's
    // rows are straight horizontal strokes — several of them parallel and hard to tell apart.
    const { sy, c1y, c2y, ty } = parse(blueprintEdgePath({ x: 0, y: 0 }, { x: 320, y: 0 }, ACROSS));

    expect(c1y).toBeGreaterThan(sy);
    expect(c2y).toBeGreaterThan(ty);
    expect(c1y).toBe(c2y);
  });

  it("does not bow an edge that already has a direction to curve in", () => {
    const { sy, c1y, ty, c2y } = parse(
      blueprintEdgePath({ x: 0, y: 0 }, { x: 320, y: 200 }, ACROSS),
    );

    expect(c1y).toBe(sy);
    expect(c2y).toBe(ty);
  });

  it("swings a backwards edge wide, so the exception is visible as one", () => {
    const { sx, c1x, tx, c2x } = parse(
      blueprintEdgePath({ x: 600, y: 0 }, { x: 0, y: 40 }, ACROSS),
    );

    expect(c1x).toBeGreaterThan(sx);
    expect(c2x).toBeLessThan(tx);
  });

  it("leaves a vertical handle vertically, rather than cutting across the card's corner", () => {
    const down = { source: "bottom", target: "top" } as const;
    const { sx, sy, c1x, c1y, tx, ty, c2x, c2y } = parse(
      blueprintEdgePath({ x: 0, y: 0 }, { x: 0, y: 400 }, down),
    );

    expect(c1y).toBeGreaterThan(sy);
    expect(c2y).toBeLessThan(ty);
    // The bow on a vertical run is sideways, which is the only direction left for it.
    expect(c1x).toBeGreaterThan(sx);
    expect(c2x).toBeGreaterThan(tx);
  });

  it("draws the same edge the same way every time", () => {
    const first = blueprintEdgePath({ x: 12, y: 30 }, { x: 350, y: 96 }, ACROSS);
    const second = blueprintEdgePath({ x: 12, y: 30 }, { x: 350, y: 96 }, ACROSS);

    expect(second).toBe(first);
  });
});

describe("autoLayoutPositions ordering", () => {
  it("hands the layout the author's own listing order, so a rank is not shuffled at random", () => {
    const listed = (ids: string[]) =>
      ids.map((id, index) => ({ ...node(id, ["root"]), position: index }));
    const nodes = [node("root"), ...listed(["a", "b", "c"])];

    const positions = autoLayoutPositions(nodes);
    const reversed = autoLayoutPositions([node("root"), ...listed(["a", "b", "c"]).reverse()]);

    // Same listing order either way, so the same arrangement — the order the array happens to be
    // in does not decide who sits on top.
    expect(reversed).toEqual(positions);
    expect(positions.a.y).toBeLessThan(positions.b.y);
    expect(positions.b.y).toBeLessThan(positions.c.y);
  });

  it("puts the unsequenced block under the chains, no wider than they are", () => {
    const nodes = [
      node("a"),
      node("b", ["a"]),
      ...["one", "two", "three", "four", "five", "six"].map((id) => node(id)),
    ];

    const positions = autoLayoutPositions(nodes);
    const chainRight = Math.max(positions.a.x, positions.b.x);
    const looseRight = Math.max(
      ...["one", "two", "three", "four", "five", "six"].map((id) => positions[id].x),
    );

    expect(looseRight).toBeLessThanOrEqual(chainRight + GRAPH_NODE_WIDTH);
    expect(positions.one.y).toBeGreaterThan(Math.max(positions.a.y, positions.b.y));
  });
});

describe("arrangementFor", () => {
  it("keeps a stored arrangement, and drops what has no coordinates into a free cell beside it", () => {
    const nodes = [node("placed", [], 500, 500), { ...node("new"), graphX: null, graphY: null }];

    const positions = arrangementFor(nodes);

    expect(positions.placed).toEqual({ x: 500, y: 500 });
    expect(positions.new).toBeDefined();
    expect(positions.new).not.toEqual(positions.placed);
  });

  it("lays a graph out properly when nothing has been arranged at all", () => {
    // The hire's read-only view of a path copied from a blueprint nobody opened the graph of: a
    // grid that knows no prerequisites is strictly worse than a layout that does.
    const nodes = ["a", "b", "c"].map((id, index) => ({
      ...node(id, index === 0 ? [] : [["a", "b"][index - 1]]),
      graphX: null,
      graphY: null,
    }));

    const positions = arrangementFor(nodes);

    expect(positions.a.x).toBeLessThan(positions.b.x);
    expect(positions.b.x).toBeLessThan(positions.c.x);
  });
});

describe("blockersBehind and dependentsAhead", () => {
  const nodes = [node("a"), node("b", ["a"]), node("c", ["b"]), node("side", ["a"])];

  it("looks all the way back, not one hop", () => {
    // The reason to split the two walks: one hop back is what a sentence on a card can already
    // say, and the hop after that is where a reader gets lost.
    expect(blockersBehind(nodes, "c")).toEqual(new Set(["b", "a"]));
  });

  it("looks all the way forward, down every branch", () => {
    expect(dependentsAhead(nodes, "a")).toEqual(new Set(["b", "c", "side"]));
  });

  it("leaves the node itself out of both, so the two halves never overlap", () => {
    expect(blockersBehind(nodes, "b").has("b")).toBe(false);
    expect(dependentsAhead(nodes, "b").has("b")).toBe(false);
  });

  it("says nothing either way about a node on its own", () => {
    expect(blockersBehind([node("lonely")], "lonely").size).toBe(0);
    expect(dependentsAhead([node("lonely")], "lonely").size).toBe(0);
  });

  it("stops on a ring rather than walking it forever", () => {
    const ring = [node("x", ["y"]), node("y", ["x"])];

    expect(blockersBehind(ring, "x")).toEqual(new Set(["y"]));
    expect(dependentsAhead(ring, "x")).toEqual(new Set(["y"]));
  });

  it("together with the node itself, they are the chain", () => {
    for (const id of ["a", "b", "c", "side"]) {
      expect(chainFor(nodes, id)).toEqual(
        new Set([id, ...blockersBehind(nodes, id), ...dependentsAhead(nodes, id)]),
      );
    }
  });
});
