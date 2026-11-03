import type { JourneyEdgeTone, JourneyNodeEmphasis } from "./canvasTypes";
import { edgeEnds, type EdgeEnds } from "./edgeGeometry";
import {
  collectDownstream,
  collectUpstream,
  edgeKey,
  type GraphPoint,
  type LayoutNode,
} from "./layout";

/** An edge as the canvas draws it. */
export type CanvasEdge = EdgeEnds & {
  blockerId: string;
  nodeId: string;
  waypoints: readonly GraphPoint[];
  tone: JourneyEdgeTone;
  /** Whether both ends are part of the run lit up by the node being pointed at. */
  inChain: boolean;
};

/** Which node the canvas is lighting up the surroundings of, and everything it is lit up with. */
export type EmphasisFocus = {
  sourceId: string | null;
  /** What the source waits on and what it unlocks, or null when nothing is lit. */
  related: ReadonlySet<string> | null;
  spotlightId: string | null;
};

/** Everything the source node waits on and everything it unlocks. */
export function relatedTo(nodes: readonly LayoutNode[], sourceId: string | null) {
  if (!sourceId) return null;
  return new Set([...collectUpstream(nodes, sourceId), ...collectDownstream(nodes, sourceId)]);
}

/** How a node is drawn against the one being pointed at, or against the spotlit one. */
export function emphasisOf(id: string, focus: EmphasisFocus): JourneyNodeEmphasis {
  if (focus.spotlightId) return id === focus.spotlightId ? "focus" : "dimmed";
  if (!focus.sourceId || !focus.related) return "none";
  if (id === focus.sourceId) return "focus";
  return focus.related.has(id) ? "related" : "dimmed";
}

/** Whether a node is the source itself or one of the nodes lit up with it. */
const isLit = (id: string, focus: EmphasisFocus) =>
  id === focus.sourceId || (focus.related?.has(id) ?? false);

/** Waypoints are only ever produced for an edge that spans rows, which is the "down" case. */
const waypointsOf = (ends: EdgeEnds, route: GraphPoint[] | undefined) =>
  ends.axis === "down" ? (route ?? []) : [];

/** Whether both ends of an edge are in the run lit up by the node being pointed at. */
const inLitRun = (blockerId: string, nodeId: string, focus: EmphasisFocus) =>
  !!focus.sourceId && isLit(blockerId, focus) && isLit(nodeId, focus);

export type EdgeLayoutInput<TNode extends LayoutNode> = {
  nodes: readonly TNode[];
  positionOf: (id: string) => GraphPoint | undefined;
  nodeSize: { width: number; height: number };
  routes: ReadonlyMap<string, GraphPoint[]>;
  edgeTone?: (blocker: TNode, node: TNode) => JourneyEdgeTone;
  focus: EmphasisFocus;
};

/** The edge from one blocker to the node waiting on it, or null when either end is not drawn. */
function edgeBetween<TNode extends LayoutNode>(
  blocker: TNode | undefined,
  node: TNode,
  input: EdgeLayoutInput<TNode>,
): CanvasEdge | null {
  const { positionOf, nodeSize, edgeTone, focus } = input;
  const blockerPosition = blocker && blocker.id !== node.id ? positionOf(blocker.id) : undefined;
  const nodePosition = positionOf(node.id);
  if (!blocker || !blockerPosition || !nodePosition) return null;
  const ends = edgeEnds(blockerPosition, nodePosition, nodeSize);
  return {
    ...ends,
    blockerId: blocker.id,
    nodeId: node.id,
    waypoints: waypointsOf(ends, input.routes.get(edgeKey(blocker.id, node.id))),
    tone: edgeTone?.(blocker, node) ?? "waiting",
    inChain: inLitRun(blocker.id, node.id, focus),
  };
}

/**
 * Every edge between two nodes that are both drawn, with its ends, its tone and whether it belongs
 * to the lit run.
 */
export function layoutEdges<TNode extends LayoutNode>(input: EdgeLayoutInput<TNode>): CanvasEdge[] {
  const byId = new Map(input.nodes.map((node) => [node.id, node]));
  return input.nodes.flatMap((node) =>
    node.blockerIds
      .map((blockerId) => edgeBetween(byId.get(blockerId), node, input))
      .filter((edge): edge is CanvasEdge => edge !== null),
  );
}
