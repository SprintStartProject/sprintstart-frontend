export type RoutingPoint = { x: number; y: number };
export type RoutingObstacle = {
  center: RoutingPoint;
  halfWidth: number;
  halfHeight: number;
};
export type RoutingSegment = { from: RoutingPoint; to: RoutingPoint };

/** Space kept between a routed edge and a node that it does not connect to. */
export const ROUTING_CLEARANCE = 12;

/** Preferred gap between parallel connections. Crossings and overlaps carry a larger penalty. */
export const EDGE_SEPARATION = 14;

const EPSILON = 1e-6;
const BEND_COST = 24;
const CROSSING_COST = 5_000;
const OVERLAP_COST = 8_000;

type Direction = "horizontal" | "vertical" | "none";
type QueueEntry = { key: string; cost: number };

function pointKey(point: RoutingPoint): string {
  return `${point.x},${point.y}`;
}

function stateKey(point: RoutingPoint, direction: Direction): string {
  return `${pointKey(point)}|${direction}`;
}

function directionOf(segment: RoutingSegment): Exclude<Direction, "none"> {
  return Math.abs(segment.to.x - segment.from.x) > EPSILON ? "horizontal" : "vertical";
}

function obstacleBounds(obstacle: RoutingObstacle, pad: number) {
  return {
    minX: obstacle.center.x - obstacle.halfWidth - pad,
    maxX: obstacle.center.x + obstacle.halfWidth + pad,
    minY: obstacle.center.y - obstacle.halfHeight - pad,
    maxY: obstacle.center.y + obstacle.halfHeight + pad,
  };
}

function pointInsideObstacle(point: RoutingPoint, obstacle: RoutingObstacle, pad: number): boolean {
  const bounds = obstacleBounds(obstacle, pad);
  return (
    point.x > bounds.minX + EPSILON &&
    point.x < bounds.maxX - EPSILON &&
    point.y > bounds.minY + EPSILON &&
    point.y < bounds.maxY - EPSILON
  );
}

function segmentCrossesObstacle(
  segment: RoutingSegment,
  obstacle: RoutingObstacle,
  pad: number,
): boolean {
  const bounds = obstacleBounds(obstacle, pad);
  if (directionOf(segment) === "horizontal") {
    if (segment.from.y <= bounds.minY + EPSILON || segment.from.y >= bounds.maxY - EPSILON) {
      return false;
    }
    const minX = Math.min(segment.from.x, segment.to.x);
    const maxX = Math.max(segment.from.x, segment.to.x);
    return maxX > bounds.minX + EPSILON && minX < bounds.maxX - EPSILON;
  }

  if (segment.from.x <= bounds.minX + EPSILON || segment.from.x >= bounds.maxX - EPSILON) {
    return false;
  }
  const minY = Math.min(segment.from.y, segment.to.y);
  const maxY = Math.max(segment.from.y, segment.to.y);
  return maxY > bounds.minY + EPSILON && minY < bounds.maxY - EPSILON;
}

function samePoint(a: RoutingPoint, b: RoutingPoint): boolean {
  return Math.abs(a.x - b.x) < EPSILON && Math.abs(a.y - b.y) < EPSILON;
}

function between(value: number, a: number, b: number): boolean {
  return value >= Math.min(a, b) - EPSILON && value <= Math.max(a, b) + EPSILON;
}

/**
 * Soft cost for using an existing connection's space. A soft cost is intentional: shared
 * endpoints and dense graphs can make total separation impossible, but the router still returns
 * a valid path instead of failing.
 */
function occupiedSegmentCost(candidate: RoutingSegment, occupied: RoutingSegment[]): number {
  const candidateDirection = directionOf(candidate);
  let cost = 0;

  for (const existing of occupied) {
    const existingDirection = directionOf(existing);
    if (candidateDirection !== existingDirection) {
      const horizontal = candidateDirection === "horizontal" ? candidate : existing;
      const vertical = candidateDirection === "vertical" ? candidate : existing;
      const intersection = { x: vertical.from.x, y: horizontal.from.y };
      if (
        between(intersection.x, horizontal.from.x, horizontal.to.x) &&
        between(intersection.y, vertical.from.y, vertical.to.y)
      ) {
        const sharedEndpoint =
          (samePoint(intersection, candidate.from) || samePoint(intersection, candidate.to)) &&
          (samePoint(intersection, existing.from) || samePoint(intersection, existing.to));
        if (!sharedEndpoint) cost += CROSSING_COST;
      }
      continue;
    }

    const candidateAxis = candidateDirection === "horizontal" ? candidate.from.y : candidate.from.x;
    const existingAxis = existingDirection === "horizontal" ? existing.from.y : existing.from.x;
    const distance = Math.abs(candidateAxis - existingAxis);
    if (distance > EDGE_SEPARATION + EPSILON) continue;

    const candidateStart =
      candidateDirection === "horizontal"
        ? Math.min(candidate.from.x, candidate.to.x)
        : Math.min(candidate.from.y, candidate.to.y);
    const candidateEnd =
      candidateDirection === "horizontal"
        ? Math.max(candidate.from.x, candidate.to.x)
        : Math.max(candidate.from.y, candidate.to.y);
    const existingStart =
      existingDirection === "horizontal"
        ? Math.min(existing.from.x, existing.to.x)
        : Math.min(existing.from.y, existing.to.y);
    const existingEnd =
      existingDirection === "horizontal"
        ? Math.max(existing.from.x, existing.to.x)
        : Math.max(existing.from.y, existing.to.y);
    const overlap = Math.min(candidateEnd, existingEnd) - Math.max(candidateStart, existingStart);
    if (overlap <= EPSILON) continue;

    if (distance < EPSILON) cost += OVERLAP_COST + overlap * 4;
    else cost += ((EDGE_SEPARATION - distance) / EDGE_SEPARATION) * (600 + overlap);
  }

  return cost;
}

function pushQueue(heap: QueueEntry[], entry: QueueEntry) {
  heap.push(entry);
  let index = heap.length - 1;
  while (index > 0) {
    const parent = Math.floor((index - 1) / 2);
    if (heap[parent].cost <= entry.cost) break;
    heap[index] = heap[parent];
    index = parent;
  }
  heap[index] = entry;
}

function popQueue(heap: QueueEntry[]): QueueEntry | undefined {
  const first = heap[0];
  const last = heap.pop();
  if (!first || !last || heap.length === 0) return first;
  let index = 0;
  heap[0] = last;
  while (true) {
    const left = index * 2 + 1;
    const right = left + 1;
    let smallest = index;
    if (left < heap.length && heap[left].cost < heap[smallest].cost) smallest = left;
    if (right < heap.length && heap[right].cost < heap[smallest].cost) smallest = right;
    if (smallest === index) break;
    [heap[index], heap[smallest]] = [heap[smallest], heap[index]];
    index = smallest;
  }
  return first;
}

function compress(points: RoutingPoint[]): RoutingPoint[] {
  const result: RoutingPoint[] = [];
  for (const point of points) {
    const previous = result.at(-1);
    if (previous && samePoint(previous, point)) continue;
    const beforePrevious = result.at(-2);
    if (
      beforePrevious &&
      previous &&
      ((Math.abs(beforePrevious.x - previous.x) < EPSILON &&
        Math.abs(previous.x - point.x) < EPSILON) ||
        (Math.abs(beforePrevious.y - previous.y) < EPSILON &&
          Math.abs(previous.y - point.y) < EPSILON))
    ) {
      result[result.length - 1] = point;
    } else {
      result.push(point);
    }
  }
  return result;
}

function fallbackRoute(
  from: RoutingPoint,
  to: RoutingPoint,
  obstacles: RoutingObstacle[],
  pad: number,
  occupied: RoutingSegment[],
): RoutingPoint[] {
  const candidates = [
    { x: to.x, y: from.y },
    { x: from.x, y: to.y },
  ];
  const score = (corner: RoutingPoint) => {
    const segments = [
      { from, to: corner },
      { from: corner, to },
    ].filter((segment) => !samePoint(segment.from, segment.to));
    return segments.reduce(
      (total, segment) =>
        total +
        occupiedSegmentCost(segment, occupied) +
        obstacles.filter((obstacle) => segmentCrossesObstacle(segment, obstacle, pad)).length *
          CROSSING_COST,
      0,
    );
  };
  const corner = score(candidates[0]) <= score(candidates[1]) ? candidates[0] : candidates[1];
  return samePoint(corner, from) || samePoint(corner, to) ? [] : [corner];
}

/**
 * Routes one connection as a Manhattan polyline. Padded node bounds are hard obstacles; previously
 * routed connection segments are soft obstacles so edges spread into separate lanes where space
 * permits. Returned points exclude `from` and `to` and every bend is exactly 90 degrees.
 */
export function routeEdgePath(
  from: RoutingPoint,
  to: RoutingPoint,
  obstacles: RoutingObstacle[],
  pad: number = ROUTING_CLEARANCE,
  occupied: RoutingSegment[] = [],
): RoutingPoint[] {
  if (samePoint(from, to)) return [];

  const xCoordinates = new Set([from.x, to.x]);
  const yCoordinates = new Set([from.y, to.y]);
  for (const obstacle of obstacles) {
    const bounds = obstacleBounds(obstacle, pad);
    xCoordinates.add(bounds.minX);
    xCoordinates.add(bounds.maxX);
    yCoordinates.add(bounds.minY);
    yCoordinates.add(bounds.maxY);
  }
  for (const segment of occupied) {
    xCoordinates.add(segment.from.x);
    xCoordinates.add(segment.to.x);
    yCoordinates.add(segment.from.y);
    yCoordinates.add(segment.to.y);
    if (directionOf(segment) === "horizontal") {
      yCoordinates.add(segment.from.y - EDGE_SEPARATION);
      yCoordinates.add(segment.from.y + EDGE_SEPARATION);
    } else {
      xCoordinates.add(segment.from.x - EDGE_SEPARATION);
      xCoordinates.add(segment.from.x + EDGE_SEPARATION);
    }
  }

  const xs = [...xCoordinates].sort((a, b) => a - b);
  const ys = [...yCoordinates].sort((a, b) => a - b);
  const xIndexByCoordinate = new Map(xs.map((coordinate, index) => [coordinate, index]));
  const yIndexByCoordinate = new Map(ys.map((coordinate, index) => [coordinate, index]));
  const validPoints = new Map<string, RoutingPoint>();
  for (const x of xs) {
    for (const y of ys) {
      const point = { x, y };
      if (!obstacles.some((obstacle) => pointInsideObstacle(point, obstacle, pad))) {
        validPoints.set(pointKey(point), point);
      }
    }
  }

  if (!validPoints.has(pointKey(from)) || !validPoints.has(pointKey(to))) {
    return fallbackRoute(from, to, obstacles, pad, occupied);
  }

  const distances = new Map<string, number>();
  const previous = new Map<string, string>();
  const states = new Map<string, { point: RoutingPoint; direction: Direction }>();
  const queue: QueueEntry[] = [];
  const startKey = stateKey(from, "none");
  distances.set(startKey, 0);
  states.set(startKey, { point: from, direction: "none" });
  pushQueue(queue, { key: startKey, cost: 0 });
  let endKey: string | null = null;

  while (queue.length > 0) {
    const currentEntry = popQueue(queue)!;
    if (currentEntry.cost !== distances.get(currentEntry.key)) continue;
    const current = states.get(currentEntry.key)!;
    if (samePoint(current.point, to)) {
      endKey = currentEntry.key;
      break;
    }

    const xIndex = xIndexByCoordinate.get(current.point.x)!;
    const yIndex = yIndexByCoordinate.get(current.point.y)!;
    const neighborCoordinates = [
      [xIndex - 1, yIndex],
      [xIndex + 1, yIndex],
      [xIndex, yIndex - 1],
      [xIndex, yIndex + 1],
    ];

    for (const [neighborXIndex, neighborYIndex] of neighborCoordinates) {
      if (
        neighborXIndex < 0 ||
        neighborXIndex >= xs.length ||
        neighborYIndex < 0 ||
        neighborYIndex >= ys.length
      )
        continue;
      const neighbor = validPoints.get(pointKey({ x: xs[neighborXIndex], y: ys[neighborYIndex] }));
      if (!neighbor) continue;
      const segment = { from: current.point, to: neighbor };
      if (obstacles.some((obstacle) => segmentCrossesObstacle(segment, obstacle, pad))) continue;

      const direction = directionOf(segment);
      const length =
        Math.abs(neighbor.x - current.point.x) + Math.abs(neighbor.y - current.point.y);
      const bendCost =
        current.direction !== "none" && current.direction !== direction ? BEND_COST : 0;
      const nextCost =
        currentEntry.cost + length + bendCost + occupiedSegmentCost(segment, occupied);
      const nextKey = stateKey(neighbor, direction);
      if (nextCost >= (distances.get(nextKey) ?? Infinity)) continue;
      distances.set(nextKey, nextCost);
      previous.set(nextKey, currentEntry.key);
      states.set(nextKey, { point: neighbor, direction });
      pushQueue(queue, { key: nextKey, cost: nextCost });
    }
  }

  if (!endKey) return fallbackRoute(from, to, obstacles, pad, occupied);
  const reversed: RoutingPoint[] = [];
  for (let key: string | undefined = endKey; key; key = previous.get(key)) {
    reversed.push(states.get(key)!.point);
  }
  const route = compress(reversed.reverse());
  return route.slice(1, -1);
}

/** Converts a complete routed polyline into segments that can influence the next edge. */
export function routingSegments(points: RoutingPoint[]): RoutingSegment[] {
  return points
    .slice(0, -1)
    .map((point, index) => ({ from: point, to: points[index + 1] }))
    .filter((segment) => !samePoint(segment.from, segment.to));
}
