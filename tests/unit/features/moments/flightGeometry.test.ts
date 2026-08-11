import { describe, expect, it } from "vitest";
import {
  launchGeometry,
  petFlight,
  PET_EXIT_STEPS,
  PET_PERCH_INSET,
  PET_ROCKET_SIZE,
} from "../../../../src/features/moments/flightGeometry.ts";
import { loopFlight, MIN_LOOP_RATIO } from "../../../../src/features/moments/loopFlight.ts";
import { FLIGHT_DURATION_S } from "../../../../src/styles/tokens.ts";

/**
 * Worst-case half-extent of the rocket about its path point: it rotates through
 * a full turn, so the corner of its box is what has to stay inside.
 */
function halfDiagonal(rocketSize: number): number {
  return (rocketSize * Math.SQRT2) / 2;
}

/** Matches the `scale` keyframes the sequence animates the rocket with. */
function scaleAt(progress: number): number {
  return 0.5 + 0.55 * Math.min(1, progress * 4);
}

/**
 * Total turning of the path itself, in degrees. Measured from the traced points
 * rather than from `rotate`, because `rotate` carries the deliberate lean out of
 * the resting angle at the start, which eats into the sum.
 */
function pathTurning(x: number[], y: number[]): number {
  let total = 0;
  let previous: number | null = null;

  for (let i = 1; i < x.length; i++) {
    const dx = x[i] - x[i - 1];
    const dy = y[i] - y[i - 1];
    if (Math.hypot(dx, dy) < 1e-9) continue;

    const angle = Math.atan2(dy, dx);
    if (previous !== null) {
      let delta = angle - previous;
      while (delta > Math.PI) delta -= 2 * Math.PI;
      while (delta < -Math.PI) delta += 2 * Math.PI;
      total += delta;
    }
    previous = angle;
  }

  return (total * 180) / Math.PI;
}

const VIEWPORTS: Array<[string, number, number]> = [
  // Phones. The narrowest is a folded Galaxy Fold, which is the smallest
  // viewport any real browser reports.
  ["fold closed 280x653", 280, 653],
  ["Galaxy S8 360x740", 360, 740],
  ["iPhone SE 375x667", 375, 667],
  ["iPhone 14 390x844", 390, 844],
  ["Pixel 7 412x915", 412, 915],
  ["iPhone 14 Pro Max 430x932", 430, 932],
  ["phone landscape 844x390", 844, 390],
  ["phone landscape 740x360", 740, 360],
  // Tablets.
  ["iPad portrait 768x1024", 768, 1024],
  ["iPad landscape 1024x768", 1024, 768],
  // Desktop.
  ["laptop 1366x768", 1366, 768],
  ["laptop 1280x800", 1280, 800],
  ["1440x900", 1440, 900],
  ["1600x900", 1600, 900],
  ["1080p", 1920, 1080],
  ["1440p", 2560, 1440],
  ["ultrawide 3440x1440", 3440, 1440],
  ["superwide 5120x1440", 5120, 1440],
  ["portrait 1200x1600", 1200, 1600],
];

describe("launch sequence geometry", () => {
  it.each(VIEWPORTS)("keeps the whole flight on screen at %s", (_label, width, height) => {
    const { padX, padY, rocketSize, flight } = launchGeometry(width, height);

    for (let i = 0; i < flight.x.length; i++) {
      const pad = halfDiagonal(rocketSize) * scaleAt(flight.progress[i]);

      expect(padX + flight.x[i] - pad).toBeGreaterThanOrEqual(0);
      expect(padX + flight.x[i] + pad).toBeLessThanOrEqual(width);
      expect(padY + flight.y[i] - pad).toBeGreaterThanOrEqual(0);
      expect(padY + flight.y[i] + pad).toBeLessThanOrEqual(height);
    }
  });

  it.each(VIEWPORTS)("keeps the rocket a sensible size on %s", (_label, width, height) => {
    const { rocketSize } = launchGeometry(width, height);

    // Big enough that the drawing still reads as a rocket rather than a
    // smudge, small enough that it is never a landmark on the screen.
    expect(rocketSize).toBeGreaterThanOrEqual(28);
    expect(rocketSize / width).toBeLessThan(0.11);
  });

  it.each(VIEWPORTS)("still closes a real loop at %s", (_label, width, height) => {
    const { flight } = launchGeometry(width, height);

    // A loop is a path that turns all the way round. A rocket whose nose
    // spins while the path stays straight is tumbling, not looping.
    expect(Math.abs(pathTurning(flight.x, flight.y))).toBeGreaterThan(350);
    expect(Math.abs(pathTurning(flight.x, flight.y))).toBeLessThan(370);
  });

  it("puts the exhaust trail on the flight line, not near it", () => {
    const { trailAngle, trailLength, flight } = launchGeometry(1920, 1080);

    // The trail is a straight bar from the pad; it has to end where the
    // straight-line travel ends, at the angle that travel leaves at.
    const endX = Math.cos((trailAngle * Math.PI) / 180) * trailLength;
    const endY = Math.sin((trailAngle * Math.PI) / 180) * trailLength;

    expect(endX).toBeCloseTo(flight.x[flight.x.length - 1], 0);
    expect(endY).toBeCloseTo(flight.y[flight.y.length - 1], 0);
  });

  it("centres the flight band on an ultrawide instead of hugging the left", () => {
    const wide = launchGeometry(3440, 1440);
    const standard = launchGeometry(2560, 1440);

    // Same band, so the same flight — just shifted into the middle.
    expect(wide.trailLength).toBeCloseTo(standard.trailLength, 6);
    expect(wide.padX - standard.padX).toBeCloseTo((3440 - 2560) / 2, 6);
  });

  it("refuses loop radii that cannot close, so a shrunken flight fails loudly", () => {
    // Guards the constant the sizing rests on: below this the travel outruns
    // the circle and the path never doubles back.
    const tooTight = loopFlight({ dx: 1000, dy: -400, loopRatio: MIN_LOOP_RATIO * 0.6 });
    expect(Math.abs(pathTurning(tooTight.x, tooTight.y))).toBeLessThan(180);

    const justEnough = loopFlight({ dx: 1000, dy: -400, loopRatio: MIN_LOOP_RATIO * 1.25 });
    expect(Math.abs(pathTurning(justEnough.x, justEnough.y))).toBeGreaterThan(350);
  });
});

describe("rocket pet flight", () => {
  /** Matches the `scale` keyframes the pet's flight animates with. */
  function petScaleAt(progress: number): number {
    return 1 - 0.35 * progress * progress;
  }

  it.each(VIEWPORTS)("keeps the loop leg on screen at %s", (_label, width, height) => {
    const { path } = petFlight(width, height);
    const x0 = width - PET_PERCH_INSET;
    const y0 = height - PET_PERCH_INSET;

    // Only the loop leg: the exit leg is *supposed* to leave. Skip the
    // very first sample too — that is the rocket sitting on its perch,
    // deliberately tight against the edge.
    const loopEnd = path.x.length - PET_EXIT_STEPS;
    for (let i = 1; i < loopEnd; i++) {
      const pad = halfDiagonal(PET_ROCKET_SIZE) * petScaleAt(path.progress[i]);

      expect(x0 + path.x[i] - pad).toBeGreaterThanOrEqual(0);
      expect(x0 + path.x[i] + pad).toBeLessThanOrEqual(width);
      expect(y0 + path.y[i] - pad).toBeGreaterThanOrEqual(0);
      expect(y0 + path.y[i] + pad).toBeLessThanOrEqual(height);
    }
  });

  it.each(VIEWPORTS)("ends fully past the screen edge at %s", (_label, width, height) => {
    const { path } = petFlight(width, height);
    const last = path.x.length - 1;
    const x0 = width - PET_PERCH_INSET;
    const y0 = height - PET_PERCH_INSET;
    const pad = halfDiagonal(PET_ROCKET_SIZE) * petScaleAt(path.progress[last]);

    // The flight exits, it does not fade: the final keyframe has to put
    // the whole glyph beyond the left or top edge, whichever its
    // heading reaches first.
    const beyondLeft = x0 + path.x[last] + pad < 0;
    const beyondTop = y0 + path.y[last] + pad < 0;
    expect(beyondLeft || beyondTop).toBe(true);

    // And never through the edges it started against.
    for (let i = 1; i <= last; i++) {
      expect(x0 + path.x[i]).toBeLessThanOrEqual(width);
      expect(y0 + path.y[i]).toBeLessThanOrEqual(height);
    }
  });

  it.each(VIEWPORTS)(
    "takes longer than the loop alone, within reason, at %s",
    (_label, width, height) => {
      const { durationS } = petFlight(width, height);

      // The exit leg buys its time honestly: more flight, more clock —
      // but bounded, so an ultrawide's long run out never drags.
      expect(durationS).toBeGreaterThan(FLIGHT_DURATION_S + 0.3);
      expect(durationS).toBeLessThanOrEqual(FLIGHT_DURATION_S + 0.95);
    },
  );

  it.each(VIEWPORTS)("still closes a real loop at %s", (_label, width, height) => {
    const { path } = petFlight(width, height);

    // The straight exit leg adds no turning, so the sum is still the loop's.
    expect(Math.abs(pathTurning(path.x, path.y))).toBeGreaterThan(350);
    expect(Math.abs(pathTurning(path.x, path.y))).toBeLessThan(370);
  });

  it("stays shallow on a tall phone, so the loop bulges up and not off the edge", () => {
    // A steep climb to the left swings the loop out to the right, and the pet
    // launches from the right-hand edge with nothing on that side. The exit
    // leg follows the same heading, so the end point still measures it.
    const phone = petFlight(390, 844);
    const desktop = petFlight(1920, 1080);

    const climbOf = ({ path }: ReturnType<typeof petFlight>) => {
      const endX = path.x[path.x.length - 1];
      const endY = path.y[path.y.length - 1];
      return (Math.atan2(Math.abs(endY), Math.abs(endX)) * 180) / Math.PI;
    };

    expect(climbOf(phone)).toBeLessThan(40);
    expect(climbOf(desktop)).toBeLessThan(40);
  });
});
