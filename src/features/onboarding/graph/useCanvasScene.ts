import { useCallback, useMemo } from "react";
import {
  emphasisOf,
  layoutEdges,
  relatedTo,
  type CanvasEdge,
  type EmphasisFocus,
} from "./canvasEdges";
import type { JourneyEdgeTone, JourneyNodeEmphasis } from "./canvasTypes";
import { routeEdges, type GraphPoint, type LayoutNode } from "./layout";

type SceneInput<TNode extends LayoutNode> = {
  nodes: readonly TNode[];
  positions: ReadonlyMap<string, GraphPoint>;
  nodeSize: { width: number; height: number };
  edgeTone?: (blocker: TNode, node: TNode) => JourneyEdgeTone;
  /** The node being dragged, drawn where the pointer has taken it. */
  dragOverride: { id: string; position: GraphPoint } | null;
  hoveredId: string | null;
  selectedId: string | null;
  spotlightId: string | null;
  selectedEdge: { blockerId: string; nodeId: string } | null;
};

/**
 * What is on the canvas right now: where each node is drawn, which edges join them and what is lit
 * up against what -- the pointed-at or selected node's whole run, or the one spotlit node.
 */
export function useCanvasScene<TNode extends LayoutNode>(input: SceneInput<TNode>) {
  const { nodes, positions, nodeSize, edgeTone, dragOverride, spotlightId } = input;
  const positionOf = useCallback(
    (id: string): GraphPoint | undefined =>
      dragOverride?.id === id ? dragOverride.position : positions.get(id),
    [dragOverride, positions],
  );

  const sourceId = dragOverride ? null : (input.hoveredId ?? input.selectedId);
  const related = useMemo(() => relatedTo(nodes, sourceId), [nodes, sourceId]);
  const focus: EmphasisFocus = { sourceId, related, spotlightId };

  const effectivePositions = useMemo(() => {
    if (!dragOverride) return positions;
    return new Map(positions).set(dragOverride.id, dragOverride.position);
  }, [dragOverride, positions]);
  const routes = useMemo(
    () => routeEdges(nodes, effectivePositions, nodeSize),
    [effectivePositions, nodeSize, nodes],
  );
  const edges: CanvasEdge[] = layoutEdges({ nodes, positionOf, nodeSize, routes, edgeTone, focus });

  const picked = input.selectedEdge;
  const drawnEdge = picked
    ? edges.find((edge) => edge.blockerId === picked.blockerId && edge.nodeId === picked.nodeId)
    : undefined;

  return {
    positionOf,
    edges,
    drawnEdge,
    /** Whether the edges outside the lit run are faded. */
    fadeOthers: !!sourceId,
    emphasisOf: (id: string): JourneyNodeEmphasis => emphasisOf(id, focus),
  };
}
