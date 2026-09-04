import { useMemo } from "react";
import { forceCollide, forceLink, forceSimulation, forceY } from "d3-force";
import { NODE_HEIGHT, NODE_WIDTH, layoutPath, type GraphShape, type NodePosition } from "./layout";

/**
 * Above this many nodes the relaxation is skipped and dagre's positions are used
 * as-is. The value here is spacing, never legibility, so it is not worth a
 * noticeable pause on a large graph.
 */
const MAX_SIMULATED_NODES = 400;

/**
 * Fixed number of steps. The simulation is run to completion synchronously
 * rather than animated, so this is a one-off cost (single-digit milliseconds at
 * this scale) and the result is identical on every render.
 */
const RELAXATION_STEPS = 150;

/** Weak: links may nudge a node within its column, never reorder the columns. */
const ROW_STRENGTH = 0.08;
const LINK_STRENGTH = 0.05;

type SimNode = {
  id: string;
  x: number;
  y: number;
  /** Pinned: d3 honours fx absolutely, which is what guarantees the dagre tiers. */
  fx: number;
  homeY: number;
};

type SimLink = { source: string; target: string };

export type ForceLayout = {
  /** Position per competency key, in React Flow's top-left coordinates. */
  positions: Map<string, NodePosition>;
};

/**
 * Relaxes the dagre layout so cards don't sit on top of each other and linked
 * competencies drift towards each other vertically.
 *
 * Dagre still owns the structure: every node's x is *pinned* to its dagre
 * column, so the left-to-right "prerequisites flow into what they unlock"
 * reading and the tier order are guaranteed, not merely encouraged. Only y
 * moves, under collision and weak link springs.
 *
 * The simulation is stepped to completion synchronously and its result memoized.
 * It is deliberately not animated: an earlier version ticked a live
 * simulation into React state, which re-rendered the whole graph ~60 times a
 * second while settling (seconds before anything appeared) and ran without end
 * during a drag. Physics you can watch is not worth a graph you cannot use.
 *
 * @param path The graph to lay out; a change in its shape recomputes the layout.
 * @param enabled False for reduced motion. The relaxation involves no motion, so
 * this only exists to keep the reduced-motion path byte-identical to plain dagre.
 */
export function useForceLayout(path: GraphShape, enabled: boolean): ForceLayout {
  const seeded = useMemo(() => layoutPath(path), [path]);

  const positions = useMemo(() => {
    if (!enabled || path.nodes.length > MAX_SIMULATED_NODES) return seeded;

    // d3 works from node centres; dagre positions were already converted to
    // top-left corners for React Flow, so convert back on the way in and out.
    const simNodes: SimNode[] = path.nodes.map((node) => {
      const seed = seeded.get(node.key) ?? { x: 0, y: 0 };
      const centreY = seed.y + NODE_HEIGHT / 2;
      return {
        id: node.key,
        x: seed.x + NODE_WIDTH / 2,
        fx: seed.x + NODE_WIDTH / 2,
        y: centreY,
        homeY: centreY,
      };
    });
    const ids = new Set(simNodes.map((node) => node.id));
    const links: SimLink[] = path.edges
      .filter((edge) => ids.has(edge.from) && ids.has(edge.to))
      .map((edge) => ({ source: edge.from, target: edge.to }));

    const simulation = forceSimulation(simNodes)
      .force("row", forceY<SimNode>((node) => node.homeY).strength(ROW_STRENGTH))
      .force(
        "collide",
        // The cards are wide rectangles; a radius from the diagonal would
        // push them much further apart vertically than they need.
        forceCollide<SimNode>(NODE_HEIGHT * 0.75).strength(0.9),
      )
      .force(
        "link",
        forceLink<SimNode, SimLink>(links)
          .id((node) => node.id)
          .distance(NODE_WIDTH)
          .strength(LINK_STRENGTH),
      )
      .stop();

    simulation.tick(RELAXATION_STEPS);

    const relaxed = new Map<string, NodePosition>();
    for (const node of simNodes) {
      relaxed.set(node.id, {
        x: node.x - NODE_WIDTH / 2,
        y: node.y - NODE_HEIGHT / 2,
      });
    }
    return relaxed;
  }, [path, seeded, enabled]);

  return { positions };
}
