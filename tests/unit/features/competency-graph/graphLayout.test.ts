import { describe, it, expect } from "vitest";
import { layoutPath, type GraphShape } from "../../../../src/features/competency-graph/layout";

const shape: GraphShape = {
  nodes: [{ key: "a" }, { key: "b" }, { key: "c" }],
  edges: [
    { from: "a", to: "b" },
    { from: "b", to: "c" },
  ],
};

describe("layoutPath", () => {
  it("places every node to the right of what points at it", () => {
    const positions = layoutPath(shape);

    expect(positions.size).toBe(3);
    expect(positions.get("a")!.x).toBeLessThan(positions.get("b")!.x);
    expect(positions.get("b")!.x).toBeLessThan(positions.get("c")!.x);
  });

  it("ignores edges pointing outside the node set", () => {
    const positions = layoutPath({
      ...shape,
      edges: [...shape.edges, { from: "ghost", to: "a" }],
    });

    expect(positions.has("ghost")).toBe(false);
    expect(positions.size).toBe(3);
  });
});
