import { describe, expect, it } from "vitest";
import {
  DOCK_INFLUENCE_RADIUS_PX,
  DOCK_TINT_FALLOFF_EXPONENT,
  NAV_ROW_PITCH_PX,
  getInfluence,
  liftNudge,
  liftScale,
  ringOpacityOf,
  tintOpacityOf,
} from "../../../../src/components/layout/navLink/dockMath";
import {
  countText,
  needsAttentionOf,
  statusDetail,
} from "../../../../src/components/layout/navLink/navLinkText";

describe("getInfluence", () => {
  it("is full at the centre and nothing at or past the radius", () => {
    expect(getInfluence(100, 100, 96)).toBe(1);
    expect(getInfluence(196, 100, 96)).toBe(0);
    expect(getInfluence(400, 100, 96)).toBe(0);
    expect(getInfluence(4, 100, 96)).toBe(0);
  });

  it("is symmetric around the centre and falls off between", () => {
    const above = getInfluence(52, 100, 96);
    expect(above).toBeCloseTo(Math.cos(Math.PI / 4), 10);
    expect(getInfluence(148, 100, 96)).toBeCloseTo(above, 10);
    expect(above).toBeGreaterThan(0);
    expect(above).toBeLessThan(1);
  });

  it("is nothing while the pointer is outside (infinite distance)", () => {
    expect(getInfluence(Number.NEGATIVE_INFINITY, 100, 96)).toBe(0);
    expect(getInfluence(Number.NaN, 100, 96)).toBe(0);
  });

  it("raises the curve to the exponent", () => {
    const linear = getInfluence(52, 100, 96);
    expect(getInfluence(52, 100, 96, 2)).toBeCloseTo(linear ** 2, 10);
  });

  it("splits one row's worth of tint between two neighbours exactly (cos² + sin² = 1)", () => {
    for (const offset of [0, 7, 15, 22.5, 30, 41]) {
      const near = getInfluence(100 + offset, 100, NAV_ROW_PITCH_PX, DOCK_TINT_FALLOFF_EXPONENT);
      const far = getInfluence(
        100 + offset - NAV_ROW_PITCH_PX,
        100,
        NAV_ROW_PITCH_PX,
        DOCK_TINT_FALLOFF_EXPONENT,
      );
      expect(near + far).toBeCloseTo(1, 10);
    }
  });

  it("lifts over a wider radius than it tints", () => {
    expect(DOCK_INFLUENCE_RADIUS_PX).toBeGreaterThan(NAV_ROW_PITCH_PX);
  });
});

describe("dock outputs", () => {
  it("scales from 1 at rest to the hover scale at full lift", () => {
    expect(liftScale(0)).toBe(1);
    expect(liftScale(1)).toBeCloseTo(1.06, 10);
    expect(liftScale(0.5)).toBeCloseTo(1.03, 10);
  });

  it("nudges up to four pixels", () => {
    expect(liftNudge(0)).toBe(0);
    expect(liftNudge(1)).toBe(4);
    expect(liftNudge(0.5)).toBe(2);
  });

  it("shows the tint at full strength and the ring as its square", () => {
    expect(tintOpacityOf(0.5)).toBe(0.5);
    expect(tintOpacityOf(1)).toBe(1);
    expect(ringOpacityOf(0.5)).toBe(0.25);
    expect(ringOpacityOf(1)).toBe(1);
    expect(ringOpacityOf(0)).toBe(0);
  });
});

describe("needsAttentionOf", () => {
  it("is raised by the marker or by a count, and by neither alone being absent", () => {
    expect(needsAttentionOf(true, 0)).toBe(true);
    expect(needsAttentionOf(false, 3)).toBe(true);
    expect(needsAttentionOf(true, 3)).toBe(true);
    expect(needsAttentionOf(false, 0)).toBe(false);
  });
});

describe("countText", () => {
  it("prefers the caller's words and falls back to the number", () => {
    expect(countText(3, (n) => `${n} open escalations`)).toBe("3 open escalations");
    expect(countText(3)).toBe("3 waiting");
  });
});

describe("statusDetail", () => {
  const quiet = { busy: false, count: 0, needsAttention: false };

  it("is nothing for an entry with nothing to say", () => {
    expect(statusDetail(quiet)).toBeNull();
  });

  it("says busy first, with a default", () => {
    expect(statusDetail({ ...quiet, busy: true, busyLabel: "Building", count: 2 })).toBe(
      "Building",
    );
    expect(statusDetail({ ...quiet, busy: true })).toBe("In progress");
  });

  it("then the count, in the caller's words or as a number", () => {
    expect(
      statusDetail({ ...quiet, count: 2, countLabel: () => "2 things", needsAttention: true }),
    ).toBe("2 things");
    expect(statusDetail({ ...quiet, count: 2, needsAttention: true })).toBe("2 waiting");
  });

  it("then the attention note, with a default", () => {
    expect(statusDetail({ ...quiet, needsAttention: true, attentionLabel: "Look here" })).toBe(
      "Look here",
    );
    expect(statusDetail({ ...quiet, needsAttention: true })).toBe("Needs attention");
  });
});
