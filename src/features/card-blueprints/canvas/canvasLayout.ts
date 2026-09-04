import dagre from "dagre";

import { BOARD_STAGES, type BoardStage } from "../../board/layout/boardStructure";
import type { CardBlueprint } from "../types";

/**
 * The geometry of the blueprint canvas: where a card sits, which band it sits in, and what that
 * position is allowed to mean.
 *
 * The list on this page answers *what have I written*; it never answered *what does this set look
 * like as a process*. A PM writing "read the runbook, then get deploy access, then ship something
 * small" was writing a chain and reading a column, and the only place the chain became visible was
 * a hire's board — which is far too late to notice that two cards on day one both wait on a third
 * nobody scheduled.
 *
 * So the canvas is the other half of the same data: the same blueprints, drawn where the PM put
 * them, with the "comes after" links as edges you can draw and cut by hand.
 *
 * **Position carries meaning on one axis only.** Vertically the canvas is divided into one band per
 * stage, and the band a card is dropped in *is* its stage — that is the whole reason to drag a card
 * rather than open a form. Horizontally it means nothing at all: it is the PM's own arrangement,
 * kept so the picture they built is the picture they come back to.
 *
 * **A stored y is relative to its own band, never to the canvas.** Bands grow downwards as cards
 * are added to them, so an absolute y would quietly change which band a card belonged to whenever
 * the band above it grew. Relative coordinates make that impossible: a card is in the band it is
 * stored under, and the band's top is derived at draw time.
 */

/**
 * The card box, fixed, because dagre needs the size before React Flow has measured anything and
 * because a band's height is computed from the boxes in it.
 */
export const NODE_WIDTH = 264;
export const NODE_HEIGHT = 148;

/** Room at the top of a band for its own label, so a card never sits under the heading. */
export const LANE_PAD_TOP = 56;
export const LANE_PAD_BOTTOM = 32;
export const LANE_PAD_X = 32;

/** Between two bands. Wide enough that the gutter reads as a separator and not as a margin. */
export const LANE_GAP = 28;

/** An empty band is still a drop target, so it has to be visibly a band. */
export const LANE_MIN_HEIGHT = LANE_PAD_TOP + NODE_HEIGHT + LANE_PAD_BOTTOM;
export const LANE_MIN_WIDTH = 1160;

/** The grid a card falls into when nobody has placed it yet. */
export const COLUMN_STEP = NODE_WIDTH + 72;
export const ROW_STEP = NODE_HEIGHT + 32;
const COLUMNS_PER_ROW = 4;

export type CanvasPosition = { x: number; y: number };

/** Where every blueprint sits, by blueprint id. The y of each is relative to its own band. */
export type CanvasPositions = Record<string, CanvasPosition>;

/** One stage's band, in canvas coordinates. */
export type Lane = {
  stage: BoardStage;
  /** Absolute y of the band's top edge. */
  top: number;
  height: number;
  width: number;
};

/** What a lane needs to know about one card: which band, and how far down it. */
export type LanePlacement = { stage: BoardStage; position: CanvasPosition };

/**
 * The bands, stacked in stage order, sized to hold what is in them.
 *
 * Every band is drawn the same width — they are stacked rows of one canvas, and two bands of
 * different widths would read as two canvases.
 */
export function buildLanes(placements: readonly LanePlacement[]): Lane[] {
  const width = Math.max(
    LANE_MIN_WIDTH,
    ...placements.map((placement) => placement.position.x + NODE_WIDTH + LANE_PAD_X),
  );

  const lanes: Lane[] = [];
  let top = 0;

  for (const stage of BOARD_STAGES) {
    const inLane = placements.filter((placement) => placement.stage === stage);
    const height = Math.max(
      LANE_MIN_HEIGHT,
      ...inLane.map((placement) => placement.position.y + NODE_HEIGHT + LANE_PAD_BOTTOM),
    );

    lanes.push({ stage, top, height, width });
    top += height + LANE_GAP;
  }

  return lanes;
}

/** The band a stage is drawn in. Falls back to the first band, which always exists. */
export function laneFor(lanes: readonly Lane[], stage: BoardStage): Lane {
  return lanes.find((lane) => lane.stage === stage) ?? lanes[0];
}

/** A stored position, in canvas coordinates, for drawing. */
export function toAbsolute(
  position: CanvasPosition,
  stage: BoardStage,
  lanes: readonly Lane[],
): CanvasPosition {
  return { x: position.x, y: laneFor(lanes, stage).top + position.y };
}

/**
 * The stage a card dropped here belongs to: the band its middle lands in.
 *
 * By the card's middle rather than its top edge, because a card dragged so that it straddles the
 * gutter is being put where most of it is — judging by the top edge would file a card in the band
 * above while three quarters of it sits in the one below.
 *
 * A drop past the last band lands in the last band rather than nowhere: the canvas is finite, the
 * stages are not a coordinate system, and refusing the drop would leave the card where it was with
 * no explanation.
 */
export function stageForAbsoluteY(y: number, lanes: readonly Lane[]): BoardStage {
  const middle = y + NODE_HEIGHT / 2;

  let best = lanes[0];
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const lane of lanes) {
    // Zero inside the band, and the distance to its nearer edge outside it.
    const distance = Math.max(lane.top - middle, middle - (lane.top + lane.height), 0);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = lane;
    }
  }

  return best.stage;
}

/**
 * A dropped position, stored: relative to its band, and never above the band's own heading.
 *
 * Only the top and left are clamped. A band grows downwards and rightwards to hold whatever is in
 * it, so there is no bottom or right edge to be pushed back from — and a drag that snapped back
 * because the band had not grown yet would feel like the canvas refusing the move.
 */
export function toRelative(
  absolute: CanvasPosition,
  stage: BoardStage,
  lanes: readonly Lane[],
): CanvasPosition {
  return {
    x: Math.max(LANE_PAD_X, Math.round(absolute.x)),
    y: Math.max(LANE_PAD_TOP, Math.round(absolute.y - laneFor(lanes, stage).top)),
  };
}

/** The grid cell a position sits in, so a fallback placement can avoid it. */
function cellKey(position: CanvasPosition): string {
  const column = Math.round((position.x - LANE_PAD_X) / COLUMN_STEP);
  const row = Math.round((position.y - LANE_PAD_TOP) / ROW_STEP);

  return `${column}:${row}`;
}

function cellPosition(index: number): CanvasPosition {
  return {
    x: LANE_PAD_X + (index % COLUMNS_PER_ROW) * COLUMN_STEP,
    y: LANE_PAD_TOP + Math.floor(index / COLUMNS_PER_ROW) * ROW_STEP,
  };
}

/**
 * Every blueprint given a position: the stored one where there is one, the first free cell of its
 * band's grid where there is not.
 *
 * A blueprint written in the list view, or one created before this canvas existed, has never been
 * placed — and a canvas that dropped those on the origin would pile them on top of each other and
 * on top of whatever the PM had already arranged there. Free cells are found per band, in the PM's
 * own blueprint order, so opening the canvas twice puts the same card in the same place.
 */
export function withFallbackPositions(
  blueprints: readonly CardBlueprint[],
  stored: CanvasPositions,
): CanvasPositions {
  const resolved: CanvasPositions = {};

  for (const stage of BOARD_STAGES) {
    const inLane = blueprints.filter((blueprint) => blueprint.stage === stage);
    const taken = new Set(
      inLane
        .map((blueprint) => stored[blueprint.id])
        .filter((position): position is CanvasPosition => position !== undefined)
        .map(cellKey),
    );

    let next = 0;
    for (const blueprint of inLane) {
      const position = stored[blueprint.id];
      if (position) {
        resolved[blueprint.id] = position;
        continue;
      }

      while (taken.has(cellKey(cellPosition(next)))) next += 1;
      const free = cellPosition(next);
      taken.add(cellKey(free));
      resolved[blueprint.id] = free;
    }
  }

  return resolved;
}

/**
 * Everything laid out from scratch: chains left to right, each band packed from its own top-left.
 *
 * The button behind this is an escape hatch, not a mode. A canvas somebody has been dragging on for
 * a month is worth more than any layout an algorithm can produce, which is why nothing calls this
 * automatically — but a canvas that has drifted into a knot needs one click to become readable
 * again, and untangling forty cards by hand is not that.
 *
 * Each band is laid out on its own: a chain that crosses stages is not a sequence the band can
 * draw, and dagre laying out both bands together would rank cards by their links and ignore the one
 * thing the vertical axis here actually means.
 */
export function autoLayoutPositions(blueprints: readonly CardBlueprint[]): CanvasPositions {
  const positions: CanvasPositions = {};

  for (const stage of BOARD_STAGES) {
    const inLane = blueprints.filter((blueprint) => blueprint.stage === stage);
    if (inLane.length === 0) continue;

    const ids = new Set(inLane.map((blueprint) => blueprint.id));
    const graph = new dagre.graphlib.Graph();
    graph.setGraph({ rankdir: "LR", ranksep: 72, nodesep: 32, marginx: 0, marginy: 0 });
    graph.setDefaultEdgeLabel(() => ({}));

    for (const blueprint of inLane) {
      graph.setNode(blueprint.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
    }
    for (const blueprint of inLane) {
      // A link to a card in the other band stays a link; it just isn't this band's to lay out.
      if (blueprint.afterId && ids.has(blueprint.afterId)) {
        graph.setEdge(blueprint.afterId, blueprint.id);
      }
    }

    dagre.layout(graph);

    const laidOut = inLane.map((blueprint) => {
      const node = graph.node(blueprint.id) as { x?: number; y?: number } | undefined;

      // Dagre centres its nodes; React Flow places them by the top-left corner.
      return {
        id: blueprint.id,
        x: (node?.x ?? NODE_WIDTH / 2) - NODE_WIDTH / 2,
        y: (node?.y ?? NODE_HEIGHT / 2) - NODE_HEIGHT / 2,
      };
    });

    const offsetX = LANE_PAD_X - Math.min(...laidOut.map((node) => node.x));
    const offsetY = LANE_PAD_TOP - Math.min(...laidOut.map((node) => node.y));

    for (const node of laidOut) {
      positions[node.id] = { x: Math.round(node.x + offsetX), y: Math.round(node.y + offsetY) };
    }
  }

  return positions;
}

/**
 * Whether making `afterId` the predecessor of `id` would close a loop.
 *
 * A blueprint has one predecessor, so a loop is a ring of cards each waiting on the next — nothing
 * in it can ever be first, and every card it touches is blocked forever on a hire's board. The
 * dropdown in the editor cannot produce one without help; a canvas where any two handles can be
 * joined produces one the first time somebody drags an edge backwards along a chain they have
 * already built.
 *
 * Walks the chain rather than trusting its length, and counts its own steps: a ring that somehow
 * got stored would otherwise hang the render it was called from.
 */
export function wouldCycle(
  blueprints: readonly CardBlueprint[],
  id: string,
  afterId: string,
): boolean {
  if (id === afterId) return true;

  const byId = new Map(blueprints.map((blueprint) => [blueprint.id, blueprint]));
  const seen = new Set<string>([afterId]);

  let current = byId.get(afterId)?.afterId ?? null;
  while (current !== null) {
    if (current === id) return true;
    if (seen.has(current)) return false;
    seen.add(current);
    current = byId.get(current)?.afterId ?? null;
  }

  return false;
}
