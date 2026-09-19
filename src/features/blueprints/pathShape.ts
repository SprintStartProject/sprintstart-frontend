import {
  GRAPH_NODE_HEIGHT,
  GRAPH_NODE_WIDTH,
  autoLayoutPositions,
  blueprintEdgePath,
  edgeSides,
  entryPointIds,
  type GraphPoint,
  type GraphRuleNode,
} from "../graph-diagram/graphLayout.ts";

/** One blueprint's graph, small enough to sit on a card and still say what shape it is. */
export type PathShape = {
  /** The box the drawing occupies, in graph units — the SVG scales it down to whatever it gets. */
  viewBox: string;
  nodes: { id: string; x: number; y: number; entry: boolean }[];
  /** The `d` of each arrow, in the same units. */
  edges: string[];
  /** How big a node blob should be drawn, in graph units. */
  radius: number;
};

/**
 * A blueprint's own shape, drawn small.
 *
 * A row of counts — "16 phases, 42 steps" — answers how *much* there is and nothing about what
 * kind of thing it is. Sixteen phases in one straight line and sixteen in four branches are the
 * same two numbers and completely different blueprints to be handed: one is a queue, the other is
 * a set of choices, and which one you are looking at decides whether the number is alarming. That
 * is a question about shape, and shape is a picture.
 *
 * So the card carries the graph itself, at about a thumbnail's size: not to be read node by node —
 * nothing is labelled and nothing is meant to be — but to be recognised. A long thin trail, a wide
 * fan, a knot. Two blueprints can be told apart by it across a page, which is the only job.
 *
 * **Laid out, not read from the stored coordinates.** What a picture this size can carry is the
 * structure, and an author's arrangement at this scale is noise on top of it — a graph nobody has
 * tidied would show as a grid of unrelated dots and say nothing true about its shape.
 *
 * Drawn in graph units and scaled by the SVG's own viewBox, so a sixteen-phase blueprint and a
 * three-phase one are drawn by exactly the same rules and simply end up at different sizes on the
 * card. That is the honest reading: a bigger graph gets smaller dots, which is what a bigger graph
 * looks like.
 */
export function pathShape(nodes: readonly GraphRuleNode[]): PathShape | null {
  if (nodes.length === 0) return null;

  const positions = autoLayoutPositions(nodes);
  const placed = nodes.filter((node) => positions[node.id] !== undefined);
  if (placed.length === 0) return null;

  const entries = entryPointIds(placed);
  const centres = new Map<string, GraphPoint>(
    placed.map((node) => [
      node.id,
      {
        x: positions[node.id].x + GRAPH_NODE_WIDTH / 2,
        y: positions[node.id].y + GRAPH_NODE_HEIGHT / 2,
      },
    ]),
  );

  const radius = GRAPH_NODE_HEIGHT * 0.34;
  const drawn = new Set(placed.map((node) => node.id));

  const edges = placed.flatMap((node) =>
    node.blockerIds
      .filter((blockerId) => drawn.has(blockerId))
      .map((blockerId) => {
        const from = centres.get(blockerId) as GraphPoint;
        const to = centres.get(node.id) as GraphPoint;
        const sides = edgeSides(from, to);
        // Anchored on the blob rather than on a card's edge: at this size the card is not drawn, so
        // an arrow leaving where its border would have been leaves from nothing.
        return blueprintEdgePath(
          anchor(from, sides.source, radius),
          anchor(to, sides.target, radius),
          sides,
        );
      }),
  );

  const xs = [...centres.values()].map((point) => point.x);
  const ys = [...centres.values()].map((point) => point.y);
  const pad = radius * 2;
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  const width = Math.max(...xs) + pad - minX;
  const height = Math.max(...ys) + pad - minY;

  return {
    viewBox: `${round(minX)} ${round(minY)} ${round(width)} ${round(height)}`,
    nodes: placed.map((node) => ({
      id: node.id,
      x: round((centres.get(node.id) as GraphPoint).x),
      y: round((centres.get(node.id) as GraphPoint).y),
      entry: entries.has(node.id),
    })),
    edges,
    radius: round(radius),
  };
}

/** The point on a blob's rim that faces the given side. */
function anchor(centre: GraphPoint, side: "left" | "right" | "top" | "bottom", radius: number) {
  switch (side) {
    case "left":
      return { x: centre.x - radius, y: centre.y };
    case "right":
      return { x: centre.x + radius, y: centre.y };
    case "top":
      return { x: centre.x, y: centre.y - radius };
    default:
      return { x: centre.x, y: centre.y + radius };
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * What the shape is, in one word, for the people who cannot see it.
 *
 * The picture is decorative for a sighted reader scanning a page and is the only carrier of this
 * fact for everybody else, so the fact gets said out loud too. Deliberately three coarse words
 * rather than a number: "a queue or a set of choices" is the distinction worth making, and a
 * branching factor to two decimal places is not.
 */
export function shapeWord(nodes: readonly GraphRuleNode[]): string {
  if (nodes.length === 0) return "Nothing in it yet";

  const drawn = new Set(nodes.map((node) => node.id));
  const linked = nodes.filter(
    (node) =>
      node.blockerIds.some((id) => drawn.has(id)) ||
      nodes.some((other) => other.blockerIds.includes(node.id)),
  );

  if (linked.length === 0) return "No order between any of them";

  const entries = entryPointIds(nodes).size;
  // One way in and no node opening more than one other is a queue; anything else is a choice
  // somewhere, and a choice is the thing worth flagging.
  const fansOut = nodes.some(
    (node) => nodes.filter((other) => other.blockerIds.includes(node.id)).length > 1,
  );

  if (entries === 1 && !fansOut) return "One run, start to finish";
  if (entries > 1 && !fansOut) return `${entries} separate runs`;
  return "Branches — more than one way through";
}
