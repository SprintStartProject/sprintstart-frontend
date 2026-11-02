import { useMemo, useState } from "react";
import {
  GRAPH_NODE_HEIGHT,
  GRAPH_NODE_WIDTH,
  chainPositions,
  entryPointIds,
} from "../../graph-diagram/graphLayout.ts";
import {
  layeredLayout,
  resolveLayout,
  type GraphPoint,
  type LayoutOptions,
} from "../../onboarding/graph/layout.ts";
import type { BlueprintGraphCanvasNode } from "../components/blueprintGraphCanvasTypes.ts";

/** The box a Blueprint card is drawn in, and the box the layout reserves for it. */
export const NODE_SIZE = { width: GRAPH_NODE_WIDTH, height: GRAPH_NODE_HEIGHT };

/**
 * How far apart the automatic layout puts them.
 *
 * Wider than the card and half again as tall, for the same reason the journey graph's numbers are:
 * the gap is where the arrows go, and an arrow that has to squeeze between two cards is an arrow
 * that reads as touching both.
 */
const BLUEPRINT_LAYOUT: LayoutOptions = { columnGap: 300, rowGap: 190, maxPerRow: 4 };

/**
 * Where every node is drawn, and what is only proposed.
 *
 * Stored positions when every node has one, and a layered layout otherwise -- all or nothing, and
 * the same rule the journey graph follows: mixing stored coordinates with computed ones puts two
 * coordinate systems on one canvas, and a computed row at the origin lands straight on top of the
 * hand-placed cards. A stored layout whose cards would overlap at this card size is laid out again
 * as well -- the seeded blueprint's coordinates are one.
 */
export function useGraphPositions(nodes: BlueprintGraphCanvasNode[]) {
  const layout = useMemo(() => resolveLayout(nodes, BLUEPRINT_LAYOUT, NODE_SIZE), [nodes]);

  /**
   * Moves shown before the server has them; dropped when fresh coordinates arrive.
   *
   * Keyed on what the nodes say, not on the identity of the array. The page hands this a freshly
   * sorted copy on every render, so an identity check threw away the optimistic position of a card
   * whose save was still in flight whenever anything else on the page changed -- typing in the "Add
   * phase" modal did it on every keystroke.
   */
  const [overrides, setOverrides] = useState<Record<string, GraphPoint>>({});
  const positionsKey = nodes
    .map((node) => `${node.id}:${node.graphX ?? ""}:${node.graphY ?? ""}`)
    .join("|");
  const [lastPositionsKey, setLastPositionsKey] = useState(positionsKey);
  if (lastPositionsKey !== positionsKey) {
    setLastPositionsKey(positionsKey);
    setOverrides({});
  }

  /**
   * A proposed arrangement, held on the canvas and not yet saved.
   *
   * "Tidy up" moves every card at once and is the only thing in this editor with no way back, so it
   * shows its result and asks. Until it is accepted, this is what the canvas draws and what a drag
   * edits -- so an author can lay the graph out, nudge two cards, and still throw all of it away.
   */
  const [preview, setPreview] = useState<Record<string, GraphPoint> | null>(null);
  /** Bumped whenever every card has moved, so the view is framed around the new arrangement. */
  const [arrangement, setArrangement] = useState(0);

  const positions = useMemo(() => {
    const merged = new Map(layout.positions);
    Object.entries(preview ?? overrides).forEach(([id, point]) => merged.set(id, point));
    return merged;
  }, [layout, overrides, preview]);

  const fitSubject = useMemo(() => nodes.map((node) => node.id).join(","), [nodes]);
  const entryPoints = useMemo(() => entryPointIds(nodes), [nodes]);
  const chainPositionById = useMemo(() => chainPositions(nodes), [nodes]);

  return {
    positions,
    overrides,
    setOverrides,
    preview,
    setPreview,
    arrangement,
    setArrangement,
    /** What the view is framed around: a different set of nodes is a different picture. */
    fitSubject,
    entryPoints,
    chainPositionById,
    /** Every node laid out again by prerequisite, without saving any of it. */
    layeredFor: (all: BlueprintGraphCanvasNode[]) =>
      Object.fromEntries(layeredLayout(all, BLUEPRINT_LAYOUT)),
  };
}
