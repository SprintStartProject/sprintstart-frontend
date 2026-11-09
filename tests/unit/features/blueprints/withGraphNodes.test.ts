import { describe, expect, it } from "vitest";
import { withGraphNodes } from "../../../../src/features/blueprints/withGraphNodes.ts";
import type {
  BlueprintGraphNode,
  BlueprintPath,
} from "../../../../src/features/blueprints/types.ts";

function pathOf(...phaseIds: string[]): BlueprintPath {
  return {
    id: "p",
    blueprintPhases: phaseIds.map((id, position) => ({
      id,
      position,
      revision: 1,
      graphX: null,
      graphY: null,
      blockerIds: [],
    })),
  } as unknown as BlueprintPath;
}

function graphNode(
  id: string,
  revision: number,
  graphX: number,
  graphY: number,
  blockerIds: string[],
): BlueprintGraphNode {
  return { id, revision, title: id, graphX, graphY, blockerIds };
}

describe("withGraphNodes", () => {
  it("fills a phase's revision, coordinates and blockers from its graph node", () => {
    const nodes = [graphNode("a", 9, 10, 20, ["b"])];

    const merged = withGraphNodes(pathOf("a"), nodes);

    expect(merged.blueprintPhases[0]).toMatchObject({
      id: "a",
      revision: 9,
      graphX: 10,
      graphY: 20,
      blockerIds: ["b"],
    });
  });

  it("leaves a phase the graph does not know untouched", () => {
    const path = pathOf("a", "b");
    const nodes = [graphNode("a", 2, 1, 1, [])];

    const merged = withGraphNodes(path, nodes);

    expect(merged.blueprintPhases[1]).toBe(path.blueprintPhases[1]);
    expect(merged.id).toBe("p");
  });
});
