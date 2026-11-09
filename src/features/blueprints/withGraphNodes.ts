import type { BlueprintGraphNode, BlueprintPath } from "./types.ts";

/**
 * A loaded path with its phases' graph coordinates and prerequisite edges filled in.
 *
 * Phases keep whatever the nested DTO said about everything else; only the three fields that
 * response cannot carry come from the graph.
 */
export function withGraphNodes(path: BlueprintPath, nodes: BlueprintGraphNode[]): BlueprintPath {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));

  return {
    ...path,
    blueprintPhases: path.blueprintPhases.map((phase) => {
      const node = nodesById.get(phase.id);
      return node
        ? {
            ...phase,
            revision: node.revision,
            graphX: node.graphX,
            graphY: node.graphY,
            blockerIds: node.blockerIds,
          }
        : phase;
    }),
  };
}
