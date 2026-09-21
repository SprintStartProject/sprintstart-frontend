import { describe, expect, it } from "vitest";
import { pathShape, shapeWord } from "../../../../src/features/blueprints/pathShape.ts";
import type { GraphRuleNode } from "../../../../src/features/graph-diagram/graphLayout.ts";

function node(id: string, blockerIds: string[] = []): GraphRuleNode {
  return { id, blockerIds, graphX: null, graphY: null };
}

describe("pathShape", () => {
  it("has nothing to draw for a blueprint with no phases", () => {
    expect(pathShape([])).toBeNull();
  });

  it("draws a blob for every phase and an arrow for every prerequisite", () => {
    const shape = pathShape([node("a"), node("b", ["a"]), node("c", ["b"])]);

    expect(shape?.nodes).toHaveLength(3);
    expect(shape?.edges).toHaveLength(2);
  });

  it("marks where the thing begins, which is the only label this size can carry", () => {
    const shape = pathShape([node("a"), node("b", ["a"])]);

    expect(shape?.nodes.find((item) => item.id === "a")?.entry).toBe(true);
    expect(shape?.nodes.find((item) => item.id === "b")?.entry).toBe(false);
  });

  it("gives every blob room inside the box, so nothing is drawn half off the edge", () => {
    const shape = pathShape([node("a"), node("b", ["a"])]);
    const [minX, minY, width, height] = (shape as { viewBox: string }).viewBox
      .split(" ")
      .map(Number);

    for (const item of shape?.nodes ?? []) {
      expect(item.x - shape!.radius).toBeGreaterThanOrEqual(minX);
      expect(item.y - shape!.radius).toBeGreaterThanOrEqual(minY);
      expect(item.x + shape!.radius).toBeLessThanOrEqual(minX + width);
      expect(item.y + shape!.radius).toBeLessThanOrEqual(minY + height);
    }
  });

  it("ignores an arrow to a phase that is not in the blueprint", () => {
    expect(pathShape([node("only", ["elsewhere"])])?.edges).toHaveLength(0);
  });

  it("draws the same blueprint the same way every time", () => {
    const nodes = [node("a"), node("b", ["a"]), node("c", ["a"])];

    expect(pathShape(nodes)).toEqual(pathShape(nodes));
  });

  it("is laid out rather than read from the stored arrangement", () => {
    // Two blueprints with the same structure are the same shape, whatever their authors dragged
    // their cards into — at this size an arrangement is noise on top of the structure.
    const laidOut = pathShape([node("a"), node("b", ["a"])]);
    const dragged = pathShape([
      { id: "a", blockerIds: [], graphX: 900, graphY: 40 },
      { id: "b", blockerIds: ["a"], graphX: 20, graphY: 700 },
    ]);

    expect(dragged).toEqual(laidOut);
  });
});

describe("shapeWord", () => {
  it("says a queue is a queue", () => {
    expect(shapeWord([node("a"), node("b", ["a"]), node("c", ["b"])])).toBe(
      "One run, start to finish",
    );
  });

  it("flags a choice, which is the distinction worth making", () => {
    expect(shapeWord([node("a"), node("b", ["a"]), node("c", ["a"])])).toBe(
      "Branches — more than one way through",
    );
  });

  it("counts runs that never meet", () => {
    expect(shapeWord([node("a"), node("b", ["a"]), node("x"), node("y", ["x"])])).toBe(
      "2 separate runs",
    );
  });

  it("says plainly when nothing sequences anything", () => {
    expect(shapeWord([node("a"), node("b"), node("c")])).toBe("No order between any of them");
  });

  it("says an empty blueprint is empty", () => {
    expect(shapeWord([])).toBe("Nothing in it yet");
  });
});
