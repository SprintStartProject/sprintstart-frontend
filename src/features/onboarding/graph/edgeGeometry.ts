import type { GraphPoint } from "./layout";

/**
 * Which way an edge leaves its blocker and enters what waits on it.
 *
 * `"down"` is the ordinary case and the only one the layered layout ever produces: the blocker is a
 * clear row above, so the curve leaves its bottom edge and enters the other's top.
 *
 * The other two are for everything else. Nodes can be dragged, and a graph can arrive with
 * coordinates that were authored on a free canvas, so what a node waits on may sit beside it, level
 * with it, or below it. A downward curve between those ends doubles back on itself and runs
 * underneath both cards — cards are drawn over the edges — and the only thing left on screen is an
 * arrowhead floating beside a card with no line attached to it.
 *
 * `"across"` links two cards that stand side by side: out of the near edge of one, into the facing
 * edge of the other. `"around"` is for the rest — one card nearly above the other, or overlapping
 * it — where there is no room between them for a line at all, so it bulges out past one side and
 * comes back in on the same side.
 */
export type EdgeAxis = "down" | "across" | "around";

/** The two ends of an edge, how it travels and which side it swings to. */
export type EdgeEnds = {
  axis: EdgeAxis;
  /** 1 when the waiting node is to the right of its blocker (or level), -1 when to the left. */
  sideways: 1 | -1;
  from: GraphPoint;
  to: GraphPoint;
  /** The way the curve is travelling when it lands, which the arrowhead is drawn from. */
  approach: GraphPoint;
};

/** How far past a card an `"around"` edge swings before it comes back. */
const AROUND_BULGE_PX = 70;

/** The clear row two cards need between them before an edge may simply drop from one to the other. */
const ROW_CLEARANCE_PX = 24;

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * How far the control points are pushed out from each end.
 *
 * Never further than the distance being spanned. A fixed minimum is what makes a long edge leave
 * and arrive straight instead of cutting the corner — but on a *short* one it puts the control
 * point past the far end, and the curve then overshoots, dips through the card it was aiming at and
 * comes back out to meet its own arrowhead. Clamping to the span costs a long edge nothing and
 * makes a short one a plain, monotonic line.
 */
export function bendFor(span: number, minimum: number): number {
  const distance = Math.abs(span);
  return Math.min(Math.max(minimum, distance / 2), distance);
}

/**
 * The arrowhead, as two strokes of the edge's own line rather than as an SVG marker.
 *
 * A `<marker>` is a separate drawing pinned to the path's end, and it shows: it is scaled by the
 * stroke width rather than drawn at it, a dashed line ends wherever its pattern ends so the head
 * floats clear of the last dash, and any disagreement between where the path really finishes and
 * where the marker thinks it does puts a head on screen with no line under it. Two line segments
 * back from the tip cannot come apart from the line they are part of, because they are it.
 *
 * `direction` is the way the curve is travelling as it arrives, which every route here knows
 * exactly: an edge that drops in arrives straight down, one that comes in from a side arrives
 * along it.
 */
export function arrowHead(tip: GraphPoint, direction: GraphPoint, size = 9): string {
  const angle = Math.atan2(direction.y, direction.x);
  const spread = Math.PI / 7;
  const left = {
    x: tip.x - size * Math.cos(angle - spread),
    y: tip.y - size * Math.sin(angle - spread),
  };
  const right = {
    x: tip.x - size * Math.cos(angle + spread),
    y: tip.y - size * Math.sin(angle + spread),
  };
  return `M ${round(left.x)} ${round(left.y)} L ${round(tip.x)} ${round(tip.y)} L ${round(right.x)} ${round(right.y)}`;
}

/** One cubic segment of an edge between two consecutive points. */
function segmentOf(points: readonly GraphPoint[], index: number, axis: "down" | "across"): string {
  const start = points[index - 1];
  const end = points[index];
  if (axis === "across") {
    const bend = bendFor(end.x - start.x, 56);
    const direction = end.x >= start.x ? 1 : -1;
    return ` C ${start.x + bend * direction} ${start.y}, ${end.x - bend * direction} ${end.y}, ${end.x} ${end.y}`;
  }
  const first = index === 1;
  const last = index === points.length - 1;
  /** The tangent through a waypoint: along the line joining the points either side of it. */
  const throughWaypoint = (at: number) => ({
    x: (points[at + 1].x - points[at - 1].x) / 4,
    y: (points[at + 1].y - points[at - 1].y) / 4,
  });
  const bend = bendFor(end.y - start.y, first || last ? 56 : 24);
  const out = first ? { x: 0, y: bend } : throughWaypoint(index - 1);
  const into = last ? { x: 0, y: bend } : throughWaypoint(index);
  return ` C ${start.x + out.x} ${start.y + out.y}, ${end.x - into.x} ${end.y - into.y}, ${end.x} ${end.y}`;
}

/**
 * The curve from a blocker to what waits on it.
 *
 * Its ends leave and arrive straight along the axis, which is what the arrowhead is drawn from. The
 * waypoints in between are passed through along the line joining their neighbours (Catmull-Rom)
 * rather than stood upright at each one: forcing every waypoint vertical made an edge with several
 * of them wobble through a string of S-bends, most visibly while a card was being dragged.
 */
export function edgePath(
  from: GraphPoint,
  to: GraphPoint,
  route: {
    waypoints?: readonly GraphPoint[];
    axis?: EdgeAxis;
    /** Which side an `"around"` edge swings out on: 1 right, -1 left. */
    side?: number;
  } = {},
): string {
  const { waypoints = [], axis = "down", side = 1 } = route;
  if (axis === "around") {
    const out = AROUND_BULGE_PX * side;
    return (
      `M ${from.x} ${from.y}` +
      ` C ${from.x + out} ${from.y}, ${to.x + out} ${to.y}, ${to.x} ${to.y}`
    );
  }

  const points = [from, ...waypoints, to];
  let d = `M ${from.x} ${from.y}`;
  for (let index = 1; index < points.length; index += 1) {
    d += segmentOf(points, index, axis);
  }
  return d;
}

/** The point an edge's menu hangs from: the middle waypoint, or halfway between the two ends. */
export function edgeMidpoint(
  from: GraphPoint,
  to: GraphPoint,
  waypoints: readonly GraphPoint[] = [],
): GraphPoint {
  if (waypoints.length) return waypoints[Math.floor((waypoints.length - 1) / 2)];
  return { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
}

/** Which axis an edge between two card centres runs along. */
export function axisBetween(
  blocker: GraphPoint,
  node: GraphPoint,
  nodeSize: { width: number; height: number },
): EdgeAxis {
  // "down" needs a clear row between the two cards, not merely a lower centre: one card 20px under
  // another has nowhere for a line to run and no bottom edge to leave from that is not already
  // inside the other card.
  if (node.y - blocker.y > nodeSize.height + ROW_CLEARANCE_PX) return "down";
  return Math.abs(node.x - blocker.x) > nodeSize.width ? "across" : "around";
}

/** The direction an edge of this axis is travelling when it lands. */
function approachOf(axis: EdgeAxis, sideways: 1 | -1): GraphPoint {
  if (axis === "down") return { x: 0, y: 1 };
  return axis === "across" ? { x: sideways, y: 0 } : { x: -sideways, y: 0 };
}

/**
 * Where an edge starts and ends on its two cards, and how it travels between them.
 *
 * The ends are on the cards' edges, not hovering a few pixels off them: an arrow that stops short
 * leaves a gap between its head and the thing it points at, and the head then reads as an object of
 * its own rather than as the end of the line.
 */
export function edgeEnds(
  blocker: GraphPoint,
  node: GraphPoint,
  nodeSize: { width: number; height: number },
): EdgeEnds {
  const axis = axisBetween(blocker, node, nodeSize);
  const sideways = node.x - blocker.x >= 0 ? 1 : -1;
  const half = { x: (sideways * nodeSize.width) / 2, y: nodeSize.height / 2 };
  const from =
    axis === "down"
      ? { x: blocker.x, y: blocker.y + half.y }
      : { x: blocker.x + half.x, y: blocker.y };
  const to = {
    down: { x: node.x, y: node.y - half.y },
    across: { x: node.x - half.x, y: node.y },
    // Back in on the side it went out on.
    around: { x: node.x + half.x, y: node.y },
  }[axis];
  return { axis, sideways, from, to, approach: approachOf(axis, sideways) };
}
