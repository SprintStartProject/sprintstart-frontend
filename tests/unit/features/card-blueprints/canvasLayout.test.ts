import { describe, it, expect } from "vitest";
import {
  LANE_GAP,
  LANE_MIN_HEIGHT,
  LANE_PAD_TOP,
  LANE_PAD_X,
  NODE_HEIGHT,
  autoLayoutPositions,
  buildLanes,
  stageForAbsoluteY,
  toAbsolute,
  toRelative,
  withFallbackPositions,
  wouldCycle,
} from "../../../../src/features/card-blueprints/canvas/canvasLayout";
import type { CardBlueprint } from "../../../../src/features/card-blueprints/types";

function blueprint(over: Partial<CardBlueprint> & { id: string }): CardBlueprint {
  return {
    title: over.id,
    description: "",
    items: [],
    stage: "NOW",
    roleIds: [],
    position: 0,
    afterId: null,
    ...over,
  };
}

describe("the bands of the blueprint canvas", () => {
  it("stacks one band per stage, earliest on top", () => {
    const lanes = buildLanes([]);

    expect(lanes.map((lane) => lane.stage)).toEqual(["NOW", "LATER"]);
    expect(lanes[0].top).toBe(0);
    expect(lanes[1].top).toBe(LANE_MIN_HEIGHT + LANE_GAP);
  });

  it("grows a band to hold what was dropped in it, and pushes the one below down", () => {
    const lanes = buildLanes([
      { stage: "NOW", position: { x: LANE_PAD_X, y: LANE_PAD_TOP + 600 } },
    ]);

    expect(lanes[0].height).toBeGreaterThan(LANE_MIN_HEIGHT);
    expect(lanes[1].top).toBe(lanes[0].height + LANE_GAP);
  });

  it("draws every band the same width, wide enough for the card furthest right", () => {
    const lanes = buildLanes([{ stage: "LATER", position: { x: 4000, y: LANE_PAD_TOP } }]);

    expect(lanes[0].width).toBe(lanes[1].width);
    expect(lanes[0].width).toBeGreaterThan(4000);
  });
});

describe("which stage a card was dropped in", () => {
  const lanes = buildLanes([]);

  it("is the band the middle of the card lands in", () => {
    expect(stageForAbsoluteY(LANE_PAD_TOP, lanes)).toBe("NOW");
    expect(stageForAbsoluteY(lanes[1].top + LANE_PAD_TOP, lanes)).toBe("LATER");
  });

  it("goes by the middle rather than the top edge, so a straddling card lands where most of it is", () => {
    // Top edge still in the first band, but three quarters of the card hangs into the second.
    const y = lanes[1].top - NODE_HEIGHT / 4;

    expect(stageForAbsoluteY(y, lanes)).toBe("LATER");
  });

  it("puts a drop past the last band in the last band rather than nowhere", () => {
    expect(stageForAbsoluteY(99_999, lanes)).toBe("LATER");
  });
});

describe("storing where a card was dropped", () => {
  const lanes = buildLanes([]);

  it("stores the y relative to the card's own band, and draws it back where it was", () => {
    const dropped = { x: 500, y: lanes[1].top + 120 };
    const stored = toRelative(dropped, "LATER", lanes);

    expect(stored.y).toBe(120);
    expect(toAbsolute(stored, "LATER", lanes)).toEqual(dropped);
  });

  it("never lets a card sit under its band's own heading", () => {
    const stored = toRelative({ x: 0, y: lanes[1].top }, "LATER", lanes);

    expect(stored.y).toBe(LANE_PAD_TOP);
    expect(stored.x).toBe(LANE_PAD_X);
  });
});

describe("cards nobody has placed", () => {
  it("gives every blueprint a position without piling them on each other", () => {
    const blueprints = [blueprint({ id: "a" }), blueprint({ id: "b" }), blueprint({ id: "c" })];
    const positions = withFallbackPositions(blueprints, {});

    const seen = new Set(Object.values(positions).map((position) => `${position.x}:${position.y}`));
    expect(seen.size).toBe(3);
  });

  it("keeps the position of a card that has one", () => {
    const placed = { x: 999, y: 999 };
    const positions = withFallbackPositions([blueprint({ id: "a" }), blueprint({ id: "b" })], {
      a: placed,
    });

    expect(positions.a).toEqual(placed);
    expect(positions.b).not.toEqual(placed);
  });

  it("does not drop a new card on top of an arranged one", () => {
    // "a" is sitting in the very cell the first unplaced card would otherwise be given.
    const positions = withFallbackPositions([blueprint({ id: "a" }), blueprint({ id: "b" })], {
      a: { x: LANE_PAD_X, y: LANE_PAD_TOP },
    });

    expect(positions.b).not.toEqual({ x: LANE_PAD_X, y: LANE_PAD_TOP });
  });

  it("fills each band from its own top-left, since a y is relative to its band", () => {
    const positions = withFallbackPositions(
      [blueprint({ id: "a" }), blueprint({ id: "b", stage: "LATER" })],
      {},
    );

    expect(positions.a).toEqual(positions.b);
  });
});

describe("tidying the canvas up", () => {
  it("lays a chain out left to right", () => {
    const positions = autoLayoutPositions([
      blueprint({ id: "a" }),
      blueprint({ id: "b", afterId: "a" }),
      blueprint({ id: "c", afterId: "b" }),
    ]);

    expect(positions.a.x).toBeLessThan(positions.b.x);
    expect(positions.b.x).toBeLessThan(positions.c.x);
  });

  it("starts every band at its own top-left corner", () => {
    const positions = autoLayoutPositions([
      blueprint({ id: "a" }),
      blueprint({ id: "b", stage: "LATER" }),
    ]);

    expect(positions.a).toEqual({ x: LANE_PAD_X, y: LANE_PAD_TOP });
    expect(positions.b).toEqual({ x: LANE_PAD_X, y: LANE_PAD_TOP });
  });

  it("lays a band out on its own, ignoring a link into the other one", () => {
    // Were the two bands laid out together, "b" would be ranked to the right of "a".
    const positions = autoLayoutPositions([
      blueprint({ id: "a" }),
      blueprint({ id: "b", stage: "LATER", afterId: "a" }),
    ]);

    expect(positions.b.x).toBe(LANE_PAD_X);
  });
});

describe("refusing a chain that would close a loop", () => {
  const chain = [
    blueprint({ id: "a" }),
    blueprint({ id: "b", afterId: "a" }),
    blueprint({ id: "c", afterId: "b" }),
  ];

  it("refuses a card that would come after itself", () => {
    expect(wouldCycle(chain, "a", "a")).toBe(true);
  });

  it("refuses an edge drawn back along a chain", () => {
    expect(wouldCycle(chain, "a", "c")).toBe(true);
  });

  it("allows a link that only lengthens the chain", () => {
    expect(wouldCycle([...chain, blueprint({ id: "d" })], "d", "c")).toBe(false);
  });

  it("does not hang on a ring that somehow got stored", () => {
    const ring = [
      blueprint({ id: "a", afterId: "b" }),
      blueprint({ id: "b", afterId: "a" }),
      blueprint({ id: "d" }),
    ];

    expect(wouldCycle(ring, "d", "a")).toBe(false);
  });
});
