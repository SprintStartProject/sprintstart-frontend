import type { BlueprintGraphCanvasNode } from "./components/blueprintGraphCanvasTypes.ts";
import type { NodeStep } from "./components/BlueprintNodeCover.tsx";

/**
 * Where forward and back go from the opened node.
 *
 * The arrows follow the arrows: back is something this node waits for, forward is something it opens
 * up. That is the order a blueprint actually has, and the one somebody reading it is walking.
 *
 * Where a node has neither -- most of them, on a blueprint nobody has connected yet -- the step falls
 * back to the author's own order, which is the order the nodes were handed to the canvas. A control
 * that does nothing on most of a graph teaches people it is broken; one that says which of the two it
 * just did is honest about the difference. That is what the relation labels are for.
 */
export function neighbourSteps(
  nodes: BlueprintGraphCanvasNode[],
  openNode: BlueprintGraphCanvasNode | null,
): { previous: NodeStep | null; next: NodeStep | null } {
  if (!openNode) return { previous: null, next: null };
  const index = nodes.findIndex((node) => node.id === openNode.id);
  const waitsFor = nodes.filter((node) => openNode.blockerIds.includes(node.id));
  const opens = nodes.filter((node) => node.blockerIds.includes(openNode.id));

  // The last prerequisite the author wrote and the first thing it opens: the nearest neighbour on
  // each side, by the only order there is to be near in.
  const previous = waitsFor.length
    ? { node: waitsFor[waitsFor.length - 1], relation: "Waits for" }
    : index > 0
      ? { node: nodes[index - 1], relation: "Previous" }
      : null;
  const next = opens.length
    ? { node: opens[0], relation: "Opens" }
    : index >= 0 && index < nodes.length - 1
      ? { node: nodes[index + 1], relation: "Next" }
      : null;
  return { previous, next };
}
