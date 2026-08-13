import { loopFlight, type FlightPath } from "./loopFlight.ts";
import { FLIGHT_DURATION_S } from "../../styles/tokens.ts";

/**
 * Flight vector, as a fraction of the flight band (see below) and of the
 * viewport height: up and to the right.
 *
 * Flatter than a straight diagonal, because the loop is not on the line — it
 * bulges a full diameter off it, on the upper side. A steeper climb spends that
 * bulge above the top edge, which is what used to swing the rocket briefly out
 * of view on the way past.
 */
const FLIGHT_X = 0.74;
const FLIGHT_Y = -0.42;

/**
 * The launch pad, as a fraction of the flight band and of the viewport height.
 * Low and to the left: the flight wants the width, and the loop wants headroom
 * above the line.
 */
const PAD_X = 0.12;
const PAD_Y = 0.89;

/**
 * Widest aspect the flight is allowed to spread across.
 *
 * The loop's radius grows with the length of the flight, and on a shallow climb
 * it bulges almost straight up — so on an ultrawide monitor the *width* ends up
 * driving a loop taller than the screen. Past this the rocket flies across a
 * band in the middle instead of across the whole desk.
 */
const MAX_FLIGHT_ASPECT = 16 / 9;

/**
 * Rocket size, as a fraction of the viewport width, and the range it is held to.
 *
 * A fixed size does not survive the trip to a phone: 64px is a tidy 3% of a
 * desktop screen and a quarter of a 280px foldable, and since the flight scales
 * with the viewport while the rocket would not, the glyph ends up eating the
 * whole margin and hanging off the edge. The cap keeps it from growing silly on
 * a large monitor.
 */
const ROCKET_OF_WIDTH = 0.085;
const ROCKET_MIN = 28;
const ROCKET_MAX = 64;

/** Resolves the rocket's on-screen size against the viewport it is drawn in. */
export function rocketSizeFor(width: number): number {
  return Math.min(ROCKET_MAX, Math.max(ROCKET_MIN, width * ROCKET_OF_WIDTH));
}

/**
 * The flyby: a rocket that crosses the screen corner to corner, marking a step
 * being completed.
 *
 * Sized to take the screen over for a moment rather than to pass across a
 * corner of it — closer to a scene transition than to a decoration. It still
 * never dims or blocks the page, because the step flips to done underneath it
 * at the same moment and that change has to stay visible.
 *
 * Deliberately not a `loopFlight`: a loop is a flourish for arriving or
 * departing, and this is neither. It is a pass, and nothing about the path
 * should ask the eye to slow down and follow it around a curve.
 */
const FLYBY_PEAK_OF_MIN = 0.72;
const FLYBY_PEAK_MIN = 180;

/** Trail length at the peak, as a multiple of the rocket's size. */
const FLYBY_TRAIL_RATIO = 2.4;

export interface FlybyGeometry {
  /** Edge length of the rocket at the middle of the pass, in px. */
  peakSize: number;
  /** Start offset from the viewport centre, in px. */
  fromX: number;
  fromY: number;
  /** End offset from the viewport centre, in px. */
  toX: number;
  toY: number;
  /** Nose angle, in degrees clockwise from "up". */
  rotate: number;
  /** Length of the exhaust trail at the peak, in px. */
  trailLength: number;
}

/**
 * Resolves the flyby against the viewport.
 *
 * Both ends clear the edge by a full rocket width, so the pass never begins or
 * ends with a rocket visibly parked outside the frame on a wide monitor.
 */
export function flybyGeometry(width: number, height: number): FlybyGeometry {
  const peakSize = Math.max(FLYBY_PEAK_MIN, Math.min(width, height) * FLYBY_PEAK_OF_MIN);

  // Bottom-left to top-right, through the centre.
  const fromX = -(width / 2 + peakSize);
  const fromY = height / 2 + peakSize;
  const toX = -fromX;
  const toY = -fromY;

  return {
    peakSize,
    fromX,
    fromY,
    toX,
    toY,
    rotate: (Math.atan2(toX - fromX, -(toY - fromY)) * 180) / Math.PI,
    trailLength: peakSize * FLYBY_TRAIL_RATIO,
  };
}

/**
 * The loop leg of the pet's flight, as fractions of the viewport.
 *
 * Deliberately well short of the far corner: this is only where the *loop*
 * happens. The exit leg appended after it (see `petFlight`) is what actually
 * carries the rocket off the screen.
 */
const PET_X = 0.58;
const PET_Y = 0.52;

/**
 * Ceiling on the pet's climb, as a fraction of the viewport *width*.
 *
 * Without it the flight turns steep on a tall phone, where 52% of the height is
 * far more than 58% of the width. That matters more for the pet than for the
 * launch: a steep climb to the left makes the loop bulge to the *right*, and the
 * pet starts in the right-hand corner with nothing but edge on that side. Keep
 * it shallow and the loop bulges upwards instead, where there is room.
 */
const PET_MAX_CLIMB = 0.34;

/** Edge length of the pet's rocket, in px. */
export const PET_ROCKET_SIZE = 40;

/**
 * Where the pet perches: inset from the bottom-right corner, in px. Mirrors the
 * `right-[14px]` + half of the 40px frame in `RocketPet`'s markup — the flight
 * needs it to know where on the screen its path actually starts, which is what
 * the exit computation is relative to.
 */
export const PET_PERCH_INSET = 34;

/** Keyframes appended for the exit leg. Straight line; a handful is plenty. */
export const PET_EXIT_STEPS = 12;

/**
 * Clearance past the screen edge before the flight may end, in px: the glyph's
 * half-diagonal (it is rotated, so the corner of its box is what has to clear)
 * plus a margin so the drop-shadow does not linger on the edge.
 */
const PET_EXIT_CLEARANCE = (PET_ROCKET_SIZE * Math.SQRT2) / 2 + 8;

/**
 * Exit speed the rocket works up to, as a multiple of the loop leg's average.
 * The exit accelerates from the loop's settle — like a second stage lighting —
 * and this is how hard it burns by the time it crosses the edge.
 */
const PET_EXIT_SPEED = 2.2;

/** Bounds on the exit leg's duration, in seconds, whatever the screen size. */
const PET_EXIT_MIN_S = 0.35;
const PET_EXIT_MAX_S = 0.95;

export interface PetFlightPlan {
  path: FlightPath;
  /** Total flight time, loop leg plus exit leg, in seconds. */
  durationS: number;
}

export interface LaunchGeometry {
  /** Edge length of the rocket, in px. */
  rocketSize: number;
  /** Launch pad, in px from the left of the viewport. */
  padX: number;
  /** Launch pad, in px from the top of the viewport. */
  padY: number;
  /** Length of the exhaust trail at full stretch, in px. */
  trailLength: number;
  /** Angle of the exhaust trail, in degrees from horizontal. */
  trailAngle: number;
  flight: FlightPath;
}

/**
 * Resolves the launch sequence's flight against the viewport it is about to
 * play in.
 *
 * Everything the sequence draws — pad, exhaust trail, rocket — comes out of here
 * in px, so the three cannot drift apart, and the trail sits on the flight line
 * by construction rather than by a hand-tuned angle that is only right at one
 * aspect ratio.
 *
 * Lives outside the component so it can be tested directly: whether the whole
 * path fits on screen is arithmetic, and checking it by watching the animation
 * on nine different monitors is not a plan.
 */
export function launchGeometry(width: number, height: number): LaunchGeometry {
  const band = Math.min(width, height * MAX_FLIGHT_ASPECT);

  const dx = FLIGHT_X * band;
  const dy = FLIGHT_Y * height;

  return {
    rocketSize: Math.min(ROCKET_MAX, Math.max(ROCKET_MIN, width * ROCKET_OF_WIDTH)),
    // Band centred, so an ultrawide launches across the middle of the screen
    // rather than out of its left third.
    padX: (width - band) / 2 + PAD_X * band,
    padY: PAD_Y * height,
    trailLength: Math.hypot(dx, dy),
    trailAngle: (Math.atan2(dy, dx) * 180) / Math.PI,
    // Entered from 0°, so the rocket leaves the pad pointing straight up and
    // tips into its heading as it climbs, the way a launch actually looks.
    flight: loopFlight({ dx, dy, entryRotate: 0 }),
  };
}

/**
 * Resolves the rocket pet's flight against the viewport it is launched in.
 *
 * Same job as `launchGeometry`, different corner: this one starts hard against
 * the bottom-right edge, which is the tightest place on the screen to begin a
 * loop from. Sized at the moment of launch rather than at mount, so it survives
 * a window resize.
 *
 * Two legs. The loop leg is the proven flight — a cycloid across a band capped
 * at 16:9, which is what keeps the loop smaller than the screen on every
 * viewport down to a folded phone. The exit leg then carries straight on along
 * the flight's own heading until the rocket has fully cleared the left or top
 * edge, accelerating from the loop's settle like a second stage lighting.
 *
 * The exit cannot be folded into the cycloid itself: a loop only closes while
 * its radius exceeds the travel over 2π, so stretching one cycloid to the edge
 * of an ultrawide demands a loop taller than the screen. Two legs keep the
 * loop's geometry untouched and let the exit be as long as the screen is wide.
 *
 * The returned duration grows with the exit leg, because a longer way out at
 * the same clock is just a faster rocket — the pacing of the loop everyone
 * already knows must not change with the monitor.
 */
export function petFlight(width: number, height: number): PetFlightPlan {
  // Same band as the launch, for the same reason: past 16:9 the width drives a
  // loop bigger than the screen is tall.
  const band = Math.min(width, height * MAX_FLIGHT_ASPECT);

  const dx = -PET_X * band;
  const dy = -Math.min(PET_Y * height, PET_MAX_CLIMB * band);

  const loop = loopFlight({
    dx,
    dy,
    // Entered from 0°: the pet rests upright on its perch and leans into the
    // climb rather than snapping to its heading on the first frame.
    entryRotate: 0,
  });

  const distance = Math.hypot(dx, dy) || 1;
  const forwardX = dx / distance;
  const forwardY = dy / distance;

  // How far past the loop's end the rocket must travel before the whole
  // glyph has cleared the screen — through whichever edge its heading
  // reaches first. The perch pins the path to the viewport; without it the
  // path is offsets with no opinion on where the screen ends.
  const endAbsX = width - PET_PERCH_INSET + dx;
  const endAbsY = height - PET_PERCH_INSET + dy;
  const untilLeft = forwardX < 0 ? (endAbsX + PET_EXIT_CLEARANCE) / -forwardX : Infinity;
  const untilTop = forwardY < 0 ? (endAbsY + PET_EXIT_CLEARANCE) / -forwardY : Infinity;
  const exitLength = Math.max(0, Math.min(untilLeft, untilTop));

  // Accelerating from rest, so the leg's time is set by the speed it works up
  // to: t = 2d/v for a quadratic ramp. Clamped so a phone's short hop still
  // reads as a burn and an ultrawide's long run does not overstay.
  const exitSpeed = (PET_EXIT_SPEED * distance) / FLIGHT_DURATION_S;
  const exitS = Math.min(PET_EXIT_MAX_S, Math.max(PET_EXIT_MIN_S, (2 * exitLength) / exitSpeed));
  const durationS = FLIGHT_DURATION_S + exitS;

  // Stitch the legs. Times are rescaled so the loop keeps its own pacing
  // inside the longer flight; progress becomes the fraction of the *whole*
  // journey, so scale and fades driven off it keep meaning what they meant.
  const totalLength = distance + exitLength;
  const loopShare = FLIGHT_DURATION_S / durationS;

  const x = [...loop.x];
  const y = [...loop.y];
  const rotate = [...loop.rotate];
  const times = loop.times.map((t) => Number((t * loopShare).toFixed(4)));
  const progress = loop.progress.map((s) => Number(((s * distance) / totalLength).toFixed(4)));

  const finalRotate = rotate[rotate.length - 1];
  for (let step = 1; step <= PET_EXIT_STEPS; step++) {
    const t = step / PET_EXIT_STEPS;
    // Quadratic ramp: starts at the loop's settled rest, leaves at full
    // burn. Even time spacing plus squared distance is the acceleration.
    const along = exitLength * t * t;

    x.push(Number((dx + forwardX * along).toFixed(2)));
    y.push(Number((dy + forwardY * along).toFixed(2)));
    rotate.push(finalRotate);
    times.push(Number((loopShare + t * (1 - loopShare)).toFixed(4)));
    progress.push(Number(((distance + along) / totalLength).toFixed(4)));
  }

  return { path: { x, y, rotate, times, progress }, durationS };
}
