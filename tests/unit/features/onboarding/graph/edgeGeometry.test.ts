import { describe, expect, it } from "vitest";
import {
  arrowHead,
  axisBetween,
  bendFor,
  edgeEnds,
  edgeMidpoint,
  edgePath,
} from "../../../../../src/features/onboarding/graph/edgeGeometry";

const SIZE = { width: 200, height: 80 };

describe("bendFor", () => {
  it("keeps the minimum on a long span", () => {
    expect(bendFor(100, 56)).toBe(56);
  });

  it("grows to half the span once that is more than the minimum", () => {
    expect(bendFor(400, 56)).toBe(200);
  });

  it("never goes beyond the span on a short one", () => {
    expect(bendFor(20, 56)).toBe(20);
  });

  it("measures the span without regard to its direction", () => {
    expect(bendFor(-400, 56)).toBe(200);
    expect(bendFor(-20, 56)).toBe(20);
  });
});

describe("arrowHead", () => {
  it("draws two strokes meeting at the tip", () => {
    const d = arrowHead({ x: 100, y: 50 }, { x: 0, y: 1 });
    const numbers = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    expect(d.startsWith("M ")).toBe(true);
    expect(d).toContain("L 100 50 L");
    expect(numbers).toHaveLength(6);
  });

  it("sits behind the tip, against the way the line is travelling", () => {
    const d = arrowHead({ x: 100, y: 50 }, { x: 0, y: 1 });
    const [leftX, leftY, , , rightX, rightY] = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    expect(leftY).toBeLessThan(50);
    expect(rightY).toBeLessThan(50);
    expect(leftX + rightX).toBeCloseTo(200, 5);
    expect(Math.abs(leftX - 100)).toBeGreaterThan(3);
  });

  it("follows the direction it is given", () => {
    const d = arrowHead({ x: 0, y: 0 }, { x: 1, y: 0 });
    const [leftX, , , , rightX] = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    expect(leftX).toBeLessThan(0);
    expect(rightX).toBeLessThan(0);
  });

  it("is as long as the size it is asked for", () => {
    const d = arrowHead({ x: 0, y: 0 }, { x: 1, y: 0 }, 20);
    const [leftX, leftY] = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    expect(Math.hypot(leftX, leftY)).toBeCloseTo(20, 1);
  });

  it("rounds to two decimals", () => {
    expect(arrowHead({ x: 0, y: 0 }, { x: 1, y: 0 })).toBe("M -8.11 3.9 L 0 0 L -8.11 -3.9");
  });
});

describe("edgePath", () => {
  it("runs straight out of the bottom and into the top of a drop", () => {
    expect(edgePath({ x: 0, y: 0 }, { x: 0, y: 300 })).toBe("M 0 0 C 0 150, 0 150, 0 300");
  });

  it("uses the minimum bend on a short drop that has room for it", () => {
    expect(edgePath({ x: 10, y: 0 }, { x: 10, y: 100 })).toBe("M 10 0 C 10 56, 10 44, 10 100");
  });

  it("passes through a waypoint along the line joining its neighbours", () => {
    const d = edgePath({ x: 0, y: 0 }, { x: 100, y: 400 }, { waypoints: [{ x: 50, y: 200 }] });
    expect(d).toBe("M 0 0 C 0 100, 25 100, 50 200 C 75 300, 100 300, 100 400");
  });

  it("curves sideways between cards that stand side by side", () => {
    const d = edgePath({ x: 0, y: 0 }, { x: 300, y: 20 }, { axis: "across" });
    expect(d).toBe("M 0 0 C 150 0, 150 20, 300 20");
  });

  it("curves the other way when the target is to the left", () => {
    const d = edgePath({ x: 300, y: 0 }, { x: 0, y: 20 }, { axis: "across" });
    expect(d).toBe("M 300 0 C 150 0, 150 20, 0 20");
  });

  it("swings out past the card and back in on the same side", () => {
    expect(edgePath({ x: 0, y: 0 }, { x: 10, y: 20 }, { axis: "around" })).toBe(
      "M 0 0 C 70 0, 80 20, 10 20",
    );
    expect(edgePath({ x: 0, y: 0 }, { x: 10, y: 20 }, { axis: "around", side: -1 })).toBe(
      "M 0 0 C -70 0, -60 20, 10 20",
    );
  });
});

describe("edgeMidpoint", () => {
  it("is halfway between the ends when there are no waypoints", () => {
    expect(edgeMidpoint({ x: 0, y: 0 }, { x: 100, y: 200 })).toEqual({ x: 50, y: 100 });
  });

  it("is the middle waypoint when there are some", () => {
    const waypoints = [
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
    ];
    expect(edgeMidpoint({ x: 0, y: 0 }, { x: 9, y: 9 }, waypoints)).toEqual({ x: 2, y: 2 });
  });

  it("takes the earlier of the two middle waypoints when there is an even number", () => {
    const waypoints = [
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ];
    expect(edgeMidpoint({ x: 0, y: 0 }, { x: 9, y: 9 }, waypoints)).toEqual({ x: 1, y: 1 });
  });
});

describe("axisBetween", () => {
  it("drops when there is a clear row between the cards", () => {
    expect(axisBetween({ x: 0, y: 0 }, { x: 0, y: 105 }, SIZE)).toBe("down");
  });

  it("does not drop when the cards are closer than a clear row", () => {
    expect(axisBetween({ x: 0, y: 0 }, { x: 0, y: 104 }, SIZE)).not.toBe("down");
  });

  it("goes across for cards side by side", () => {
    expect(axisBetween({ x: 0, y: 0 }, { x: 201, y: 0 }, SIZE)).toBe("across");
    expect(axisBetween({ x: 0, y: 0 }, { x: -201, y: 0 }, SIZE)).toBe("across");
  });

  it("goes around when the cards overlap", () => {
    expect(axisBetween({ x: 0, y: 0 }, { x: 200, y: 0 }, SIZE)).toBe("around");
    expect(axisBetween({ x: 0, y: 50 }, { x: 0, y: 0 }, SIZE)).toBe("around");
  });
});

describe("edgeEnds", () => {
  it("leaves the bottom of the blocker and enters the top of the node on a drop", () => {
    const ends = edgeEnds({ x: 0, y: 0 }, { x: 40, y: 300 }, SIZE);
    expect(ends).toEqual({
      axis: "down",
      sideways: 1,
      from: { x: 0, y: 40 },
      to: { x: 40, y: 260 },
      approach: { x: 0, y: 1 },
    });
  });

  it("leaves the near side and enters the facing side across to the right", () => {
    const ends = edgeEnds({ x: 0, y: 0 }, { x: 400, y: 10 }, SIZE);
    expect(ends).toEqual({
      axis: "across",
      sideways: 1,
      from: { x: 100, y: 0 },
      to: { x: 300, y: 10 },
      approach: { x: 1, y: 0 },
    });
  });

  it("mirrors that across to the left", () => {
    const ends = edgeEnds({ x: 400, y: 0 }, { x: 0, y: 10 }, SIZE);
    expect(ends).toEqual({
      axis: "across",
      sideways: -1,
      from: { x: 300, y: 0 },
      to: { x: 100, y: 10 },
      approach: { x: -1, y: 0 },
    });
  });

  it("goes back in on the side it went out on when it goes around", () => {
    const ends = edgeEnds({ x: 0, y: 0 }, { x: 20, y: 30 }, SIZE);
    expect(ends).toEqual({
      axis: "around",
      sideways: 1,
      from: { x: 100, y: 0 },
      to: { x: 120, y: 30 },
      approach: { x: -1, y: 0 },
    });
  });

  it("treats a node level with its blocker as to the right", () => {
    expect(edgeEnds({ x: 0, y: 0 }, { x: 0, y: 10 }, SIZE).sideways).toBe(1);
  });
});
