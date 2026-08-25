import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useForceLayout } from "../../../../src/features/competency-graph/useForceLayout";
import {
  layoutPath,
  NODE_HEIGHT,
  type GraphShape,
} from "../../../../src/features/competency-graph/layout";

const path: GraphShape = {
  nodes: [{ key: "a" }, { key: "b" }, { key: "c" }],
  edges: [
    { from: "a", to: "b" },
    { from: "b", to: "c" },
  ],
};

/** Several nodes dagre stacks into one column, which is where overlap comes from. */
const crowded: GraphShape = {
  nodes: [{ key: "root" }, { key: "x1" }, { key: "x2" }, { key: "x3" }],
  edges: [
    { from: "root", to: "x1" },
    { from: "root", to: "x2" },
    { from: "root", to: "x3" },
  ],
};

describe("useForceLayout", () => {
  it("returns dagre positions untouched when disabled", () => {
    const { result } = renderHook(() => useForceLayout(path, false));

    expect(result.current.positions).toEqual(layoutPath(path));
  });

  it("keeps every node in its dagre column", () => {
    const { result } = renderHook(() => useForceLayout(path, true));
    const seeded = layoutPath(path);

    // x is pinned, not merely pulled: the tier order is a guarantee, since it
    // is what makes "prerequisites flow into what they unlock" readable.
    for (const key of ["a", "b", "c"]) {
      expect(result.current.positions.get(key)!.x).toBe(seeded.get(key)!.x);
    }
  });

  it("leaves no two nodes overlapping", () => {
    const { result } = renderHook(() => useForceLayout(crowded, true));
    const placed = [...result.current.positions.values()];

    for (const [i, a] of placed.entries()) {
      for (const b of placed.slice(i + 1)) {
        const overlaps = Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < NODE_HEIGHT;
        expect(overlaps).toBe(false);
      }
    }
  });

  it("is deterministic, so a re-render never moves the graph", () => {
    const { result: first } = renderHook(() => useForceLayout(path, true));
    const { result: second } = renderHook(() => useForceLayout(path, true));

    expect(first.current.positions).toEqual(second.current.positions);
  });

  it("places every node exactly once", () => {
    const { result } = renderHook(() => useForceLayout(crowded, true));

    expect(result.current.positions.size).toBe(crowded.nodes.length);
    for (const position of result.current.positions.values()) {
      expect(Number.isFinite(position.x)).toBe(true);
      expect(Number.isFinite(position.y)).toBe(true);
    }
  });
});
