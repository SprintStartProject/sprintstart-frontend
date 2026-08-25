import dagre from "dagre";

/**
 * The minimum a diagram has to look like to be laid out or walked.
 *
 * Structural on purpose: it was written against the competency graph and the projected path, both
 * of which are gone. What kept it is the board's diagram cards, whose nodes and edges are a
 * different thing entirely — and the geometry does not care. Typing against the intersection is
 * what let it survive its original subject.
 */
export type GraphShape = {
  nodes: readonly { key: string }[];
  edges: readonly { from: string; to: string }[];
};

/**
 * Fixed node box used both for the dagre layout and the rendered card, so the
 * computed positions and the DOM agree (React Flow measures after paint, but
 * dagre needs the size up front).
 */
export const NODE_WIDTH = 240;
export const NODE_HEIGHT = 84;

export type NodePosition = { x: number; y: number };

/**
 * Lays a diagram out as a layered DAG: every node sits to the right of the nodes
 * pointing at it, so the flow reads left-to-right.
 *
 * Dagre owns the layering because a hand-rolled topological ordering can place
 * a node before an edge it depends on once there is more than one root. Edges
 * pointing at nodes that are not in the diagram are skipped rather than
 * implicitly creating a phantom node.
 *
 * @returns Position by competency key; nodes dagre could not place (shouldn't
 * happen, but a missing entry would otherwise crash the render) fall back to the
 * origin.
 */
export function layoutPath(path: GraphShape): Map<string, NodePosition> {
  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: "LR", ranksep: 96, nodesep: 28, marginx: 24, marginy: 24 });
  graph.setDefaultEdgeLabel(() => ({}));

  const keys = new Set(path.nodes.map((node) => node.key));
  for (const node of path.nodes) {
    graph.setNode(node.key, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const edge of path.edges) {
    if (keys.has(edge.from) && keys.has(edge.to)) {
      graph.setEdge(edge.from, edge.to);
    }
  }

  dagre.layout(graph);

  const positions = new Map<string, NodePosition>();
  for (const node of path.nodes) {
    const laidOut = graph.node(node.key) as { x?: number; y?: number } | undefined;
    // Dagre centers nodes; React Flow positions them by their top-left corner.
    positions.set(node.key, {
      x: (laidOut?.x ?? NODE_WIDTH / 2) - NODE_WIDTH / 2,
      y: (laidOut?.y ?? NODE_HEIGHT / 2) - NODE_HEIGHT / 2,
    });
  }

  return positions;
}

/**
 * Every node connected to `key` by a chain of edges, in either direction:
 * everything it transitively reaches, and everything that transitively reaches
 * it. `key` itself is included.
 *
 * This is what a node is part of, which is the thing a static drawing hides --
 * with the chain lit and everything else dimmed, the picture reads as a path
 * through the system instead of a set of boxes.
 *
 * Walks iteratively and tracks visited keys, so a cycle the backend somehow let
 * through can't hang the render.
 */
export function chainFor(path: GraphShape, key: string): Set<string> {
  const forward = new Map<string, string[]>();
  const backward = new Map<string, string[]>();
  for (const edge of path.edges) {
    forward.set(edge.from, [...(forward.get(edge.from) ?? []), edge.to]);
    backward.set(edge.to, [...(backward.get(edge.to) ?? []), edge.from]);
  }

  const chain = new Set<string>([key]);
  for (const adjacency of [forward, backward]) {
    const stack = [key];
    while (stack.length > 0) {
      const current = stack.pop() as string;
      for (const next of adjacency.get(current) ?? []) {
        if (chain.has(next)) continue;
        chain.add(next);
        stack.push(next);
      }
    }
  }
  return chain;
}
