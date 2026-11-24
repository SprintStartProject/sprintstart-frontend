import { describe, expect, it } from "vitest";
import {
  emphasisOf,
  layoutEdges,
  relatedTo,
  type EmphasisFocus,
} from "../../../../../src/features/onboarding/graph/canvasEdges";
import type { LayoutNode } from "../../../../../src/features/onboarding/graph/layout";

const NODE = { width: 200, height: 80 };

function chain(): LayoutNode[] {
  return [
    { id: "a", blockerIds: [] },
    { id: "b", blockerIds: ["a"] },
    { id: "c", blockerIds: ["b"] },
    { id: "z", blockerIds: [] },
  ];
}

const places = new Map([
  ["a", { x: 0, y: 0 }],
  ["b", { x: 0, y: 200 }],
  ["c", { x: 0, y: 400 }],
  ["z", { x: 500, y: 0 }],
]);

const calm: EmphasisFocus = { sourceId: null, related: null, spotlightId: null };

describe("relatedTo", () => {
  it("is nothing without a source", () => {
    expect(relatedTo(chain(), null)).toBeNull();
  });

  it("is everything the source waits on and everything it unlocks", () => {
    expect([...relatedTo(chain(), "b")!].sort()).toEqual(["a", "c"]);
  });
});

describe("emphasisOf", () => {
  it("does not emphasise anything when nothing is lit", () => {
    expect(emphasisOf("a", calm)).toBe("none");
  });

  it("puts the source in focus, its run in related and the rest in dimmed", () => {
    const focus = { ...calm, sourceId: "b", related: new Set(["a", "c"]) };
    expect(emphasisOf("b", focus)).toBe("focus");
    expect(emphasisOf("a", focus)).toBe("related");
    expect(emphasisOf("z", focus)).toBe("dimmed");
  });

  it("lets a spotlit node take over from everything else", () => {
    const focus = { sourceId: "b", related: new Set(["a"]), spotlightId: "z" };
    expect(emphasisOf("z", focus)).toBe("focus");
    expect(emphasisOf("a", focus)).toBe("dimmed");
  });

  it("does not emphasise when there is a source but nothing related was worked out", () => {
    expect(emphasisOf("a", { ...calm, sourceId: "b" })).toBe("none");
  });
});

describe("layoutEdges", () => {
  const base = {
    nodes: chain(),
    positionOf: (id: string) => places.get(id),
    nodeSize: NODE,
    routes: new Map(),
    focus: calm,
  };

  it("makes one edge per blocker, from the blocker to the node", () => {
    const edges = layoutEdges(base);
    expect(edges.map((edge) => `${edge.blockerId}->${edge.nodeId}`)).toEqual(["a->b", "b->c"]);
    expect(edges[0]).toMatchObject({ axis: "down", from: { x: 0, y: 40 }, to: { x: 0, y: 160 } });
  });

  it("calls an edge waiting unless the owner says otherwise", () => {
    expect(layoutEdges(base)[0].tone).toBe("waiting");
    const edges = layoutEdges({
      ...base,
      edgeTone: (blocker) => (blocker.id === "a" ? "done" : "active"),
    });
    expect(edges.map((edge) => edge.tone)).toEqual(["done", "active"]);
  });

  it("skips a blocker that is not in the graph, not drawn, or the node itself", () => {
    const nodes = [
      { id: "a", blockerIds: ["a", "missing", "far"] },
      { id: "far", blockerIds: [] },
    ];
    const positionOf = (id: string) => (id === "far" ? undefined : places.get(id));
    expect(layoutEdges({ ...base, nodes, positionOf })).toEqual([]);
  });

  it("skips an edge whose node is not drawn", () => {
    const positionOf = (id: string) => (id === "b" ? undefined : places.get(id));
    expect(layoutEdges({ ...base, positionOf }).map((edge) => edge.nodeId)).toEqual([]);
  });

  it("gives a dropping edge the waypoints routed for it, and a sideways one none", () => {
    const route = [{ x: 9, y: 9 }];
    const routes = new Map([["a->b", route]]);
    expect(layoutEdges({ ...base, routes })[0].waypoints).toEqual(route);
    expect(layoutEdges({ ...base })[0].waypoints).toEqual([]);
    const nodes = [
      { id: "a", blockerIds: [] },
      { id: "z", blockerIds: ["a"] },
    ];
    const aside = layoutEdges({ ...base, nodes, routes: new Map([["a->z", route]]) });
    expect(aside[0].axis).toBe("across");
    expect(aside[0].waypoints).toEqual([]);
  });

  it("marks the edges of the lit run, and only those", () => {
    const focus = { sourceId: "b", related: relatedTo(chain(), "b"), spotlightId: null };
    const nodes = [...chain(), { id: "y", blockerIds: ["z"] }];
    const withY = new Map(places).set("y", { x: 500, y: 200 });
    const edges = layoutEdges({ ...base, nodes, positionOf: (id) => withY.get(id), focus });
    expect(edges.map((edge) => [edge.blockerId, edge.inChain])).toEqual([
      ["a", true],
      ["b", true],
      ["z", false],
    ]);
  });

  it("marks nothing lit without a source", () => {
    expect(layoutEdges(base).every((edge) => !edge.inChain)).toBe(true);
  });

  it("does not light an edge that has only one end in the run", () => {
    const focus = { sourceId: "a", related: new Set(["b"]), spotlightId: null };
    const edges = layoutEdges({ ...base, focus });
    expect(edges.map((edge) => edge.inChain)).toEqual([true, false]);
  });
});
