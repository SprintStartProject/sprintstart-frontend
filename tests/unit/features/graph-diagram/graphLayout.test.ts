import { describe, expect, it } from "vitest";
import {
  GRAPH_NODE_HEIGHT,
  GRAPH_NODE_WIDTH,
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
  keyboardNeighbour,
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
    // Past this a long phase name stops being shortened and starts being a word and a half, which
    // says less than a small line that fits.
    expect(compactTitlePx(0.05)).toBe(40);
  });

  it("is still readable at the zoom the seeded blueprint is read at", () => {
    // Sixteen phases spread over 1663 x 1412px fit a canvas at about a third. 13 canvas pixels
    // there are 4.3 on screen; this has to land near the size the app calls small text.
    expect(compactTitlePx(1 / 3) * (1 / 3)).toBeGreaterThan(11);
  });

  it("never shrinks below the normal size", () => {
    expect(compactTitlePx(2)).toBe(13);
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
    // The same number of pixels is not the same displacement on the two axes, because the card is
    // wider than it is tall. Written against the box rather than against the numbers it happened to
    // have: this rule is about the proportions, and the proportions have changed twice.
    const across = { x: GRAPH_NODE_WIDTH * 2, y: GRAPH_NODE_HEIGHT };
    const down = { x: GRAPH_NODE_WIDTH, y: GRAPH_NODE_HEIGHT * 2 };

    expect(edgeSides({ x: 0, y: 0 }, across).source).toBe("right");
    expect(edgeSides({ x: 0, y: 0 }, down).source).toBe("bottom");
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

  it("lays a graph with no arrows at all into a block rather than a tower", () => {
    // "As wide as the chains above" is one column when there are no chains, which is how a
    // blueprint nobody has drawn an arrow in got tidied into a single tall stack.
    const positions = autoLayoutPositions(["a", "b", "c", "d", "e", "f"].map((id) => node(id)));
    const columns = new Set(Object.values(positions).map((point) => point.x));
    const rows = new Set(Object.values(positions).map((point) => point.y));

    expect(columns.size).toBeGreaterThan(1);
    expect(rows.size).toBeGreaterThan(1);
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

describe("keyboardNeighbour", () => {
  const nodes = [node("start"), node("next", ["start"]), node("other", ["start"]), node("loose")];
  const positions = {
    start: { x: 0, y: 0 },
    next: { x: 400, y: 0 },
    other: { x: 400, y: 300 },
    loose: { x: 0, y: 600 },
  };

  it("follows the arrow rather than the geometry, which is what onward means here", () => {
    expect(keyboardNeighbour(nodes, positions, "start", "right")).toBe("next");
    expect(keyboardNeighbour(nodes, positions, "next", "left")).toBe("start");
  });

  it("prefers the node dead ahead when two are linked", () => {
    // Both `next` and `other` wait on `start`; `next` is on the same line.
    expect(keyboardNeighbour(nodes, positions, "start", "right")).toBe("next");
  });

  it("falls back to what is on screen when there is no arrow that way", () => {
    // `loose` waits on nothing and nothing waits on it — a key that did nothing here would teach
    // somebody the canvas is broken.
    expect(keyboardNeighbour(nodes, positions, "loose", "right")).toBe("other");
    expect(keyboardNeighbour(nodes, positions, "loose", "up")).toBe("start");
  });

  it("moves up and down by where things are, because the model has nothing vertical in it", () => {
    expect(keyboardNeighbour(nodes, positions, "next", "down")).toBe("other");
    expect(keyboardNeighbour(nodes, positions, "other", "up")).toBe("next");
  });

  it("says there is nowhere to go rather than wrapping around", () => {
    expect(keyboardNeighbour(nodes, positions, "start", "up")).toBeNull();
    expect(keyboardNeighbour([node("only")], { only: { x: 0, y: 0 } }, "only", "right")).toBeNull();
  });

  it("answers the same way every time", () => {
    for (const direction of ["left", "right", "up", "down"] as const) {
      expect(keyboardNeighbour(nodes, positions, "start", direction)).toBe(
        keyboardNeighbour(nodes, positions, "start", direction),
      );
    }
  });

  it("ignores a node that is not on the canvas", () => {
    expect(keyboardNeighbour(nodes, { start: { x: 0, y: 0 } }, "start", "right")).toBeNull();
  });
});
