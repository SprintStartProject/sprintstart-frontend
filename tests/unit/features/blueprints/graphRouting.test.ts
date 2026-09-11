// ============================================================
// tests/unit/features/blueprints/graphRouting.test.ts
// ============================================================
// Why: straight edges used to cut through whatever node lay between their
// endpoints, so a long blocking edge looked like a chain of adjacent
// connections (or none at all). The router must detour around intermediates.
// ============================================================

import { describe, expect, it } from "vitest";
import {
  EDGE_SEPARATION,
  routeEdgePath,
  ROUTING_CLEARANCE,
  routingSegments,
  type RoutingObstacle,
  type RoutingPoint,
} from "../../../../src/features/blueprints/components/graphRouting.ts";

/** Independent check: samples the polyline and fails when any point lies in a padded box. */
function polylineAvoids(
  from: RoutingPoint,
  through: RoutingPoint[],
  to: RoutingPoint,
  obstacles: RoutingObstacle[],
  pad: number,
): boolean {
  const points = [from, ...through, to];
  for (const obstacle of obstacles) {
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      for (let step = 0; step <= 24; step++) {
        const t = step / 24;
        const x = a.x + (b.x - a.x) * t;
        const y = a.y + (b.y - a.y) * t;
        if (
          Math.abs(x - obstacle.center.x) < obstacle.halfWidth + pad &&
          Math.abs(y - obstacle.center.y) < obstacle.halfHeight + pad
        ) {
          return false;
        }
      }
    }
  }
  return true;
}

function boxAt(x: number, y: number, halfWidth = 96, halfHeight = 44): RoutingObstacle {
  return { center: { x, y }, halfWidth, halfHeight };
}

function expectOrthogonal(from: RoutingPoint, through: RoutingPoint[], to: RoutingPoint) {
  for (const segment of routingSegments([from, ...through, to])) {
    expect(segment.from.x === segment.to.x || segment.from.y === segment.to.y).toBe(true);
  }
}

describe("routeEdgePath", () => {
  it("returns no waypoints when the straight path is clear", () => {
    const from = { x: 0, y: 0 };
    const to = { x: 1000, y: 0 };
    const obstacles = [boxAt(500, 400)];

    expect(routeEdgePath(from, to, obstacles)).toEqual([]);
  });

  it("turns a diagonal connection into two orthogonal segments", () => {
    const from = { x: 0, y: 0 };
    const to = { x: 300, y: 200 };

    const waypoints = routeEdgePath(from, to, []);

    expect(waypoints).toHaveLength(1);
    expectOrthogonal(from, waypoints, to);
  });

  it("detours around a node lying on the segment", () => {
    const from = { x: 0, y: 0 };
    const to = { x: 600, y: 0 };
    const obstacles = [boxAt(300, 10)]; // slightly off-center, like an overlapping row of cards

    const waypoints = routeEdgePath(from, to, obstacles);

    expect(waypoints.length).toBeGreaterThan(0);
    expectOrthogonal(from, waypoints, to);
    expect(polylineAvoids(from, waypoints, to, obstacles, ROUTING_CLEARANCE)).toBe(true);
  });

  it("detours around every node of an AI-authored straight line", () => {
    // The personalized graph places steps/questions on one row; a long edge between the
    // outer nodes would otherwise be clipped at the first of the three in between.
    const from = { x: 0, y: 0 };
    const to = { x: 800, y: 0 };
    const obstacles = [boxAt(200, 0), boxAt(400, 0), boxAt(600, 0)];

    const waypoints = routeEdgePath(from, to, obstacles);

    expect(waypoints.length).toBeGreaterThan(0);
    expectOrthogonal(from, waypoints, to);
    expect(polylineAvoids(from, waypoints, to, obstacles, ROUTING_CLEARANCE)).toBe(true);
  });

  it("moves a repeated connection into a separate lane", () => {
    const from = { x: 0, y: 0 };
    const to = { x: 400, y: 0 };
    const occupied = routingSegments([from, to]);

    const waypoints = routeEdgePath(from, to, [], ROUTING_CLEARANCE, occupied);

    expect(waypoints.length).toBeGreaterThan(0);
    expectOrthogonal(from, waypoints, to);
    expect(waypoints.some((point) => Math.abs(point.y) >= EDGE_SEPARATION)).toBe(true);
  });

  it("terminates on degenerate overlapping layouts", () => {
    const from = { x: 0, y: 0 };
    const to = { x: 400, y: 0 };
    // Nodes wider than their spacing: every detour still crosses some box.
    const obstacles = [boxAt(150, 0, 120, 120), boxAt(250, 0, 120, 120)];

    const waypoints = routeEdgePath(from, to, obstacles);

    expect(waypoints.length).toBeLessThanOrEqual(6);
    expectOrthogonal(from, waypoints, to);
  });
});
