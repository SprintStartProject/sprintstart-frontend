/**
 * Keyframes sampled along the flight. Every keyframe carries both the travel and
 * the loop, so this is the resolution of the whole curve.
 *
 * Playback walks straight lines between the samples while the rotation
 * interpolates linearly, so too few of them and the nose drifts off the chord
 * through the tightest part of the loop — at 28 that costs about 20° of wobble.
 * These are plain numbers in an array; there is no reason to be stingy.
 */
const FLIGHT_STEPS = 60;

/**
 * Fraction of the flight over which the nose swings from its resting angle to
 * the flight path, when an `entryRotate` is given.
 */
const TIP_IN = 0.18;

/**
 * Smallest loop radius, as a fraction of the flight distance, that still closes
 * into a loop.
 *
 * The rocket travels `distance` while the loop unrolls `2 * PI * radius` of
 * circumference. Below `1 / (2 * PI)` the travel outruns the circle and the path
 * never doubles back — you get a shallow wave, and a nose that spins through
 * 360° while the path stays straight, which reads as tumbling out of control.
 */
export const MIN_LOOP_RATIO = 1 / (2 * Math.PI);

export interface FlightPath {
    /** Offset from the starting point along the flight, in px. */
    x: number[];
    /** Offset from the starting point across the flight, in px. */
    y: number[];
    /** Absolute rotation, in degrees. */
    rotate: number[];
    /** Uniform keyframe positions, 0..1. */
    times: number[];
    /**
     * Eased progress along the flight at each keyframe, 0..1.
     *
     * Drive `scale`, `opacity` and anything else off this rather than off
     * `times`, so they speed up and slow down with the rocket instead of
     * running to their own clock.
     */
    progress: number[];
}

interface LoopFlightOptions {
    /** Horizontal flight vector, in px. Negative travels left. */
    dx: number;
    /** Vertical flight vector, in px. Negative travels up. */
    dy: number;
    /**
     * Loop radius as a fraction of the flight distance. Must exceed
     * `MIN_LOOP_RATIO` (~0.16) or the path will not close into a loop; the
     * default leaves comfortable headroom above it.
     *
     * Expressed as a fraction rather than in px on purpose: the flight is sized
     * in viewport units, so a fixed radius would loop on a laptop and barely
     * wobble on a 4K monitor.
     */
    loopRatio?: number;
    /**
     * Rotation the rocket holds before it tips into the flight path, in degrees.
     * Defaults to no tip-over. Pass the rocket's resting angle to have it lean
     * into the climb instead of snapping to its heading on the first frame.
     */
    entryRotate?: number;
}

function round(value: number): number {
    return Number(value.toFixed(2));
}

/**
 * Smoothstep. Lifts off from a standstill, quickest through the loop, settles as
 * it recedes — and gentler at both ends than a cubic ease-in-out, which peaks at
 * twice the average speed and makes the middle of the flight feel snatched.
 */
function smoothstep(t: number): number {
    return t * t * (3 - 2 * t);
}

/** Direction of a screen-space vector, in degrees clockwise from "up". */
function bearing(dx: number, dy: number): number {
    return (Math.atan2(dx, -dy) * 180) / Math.PI;
}

/**
 * Builds a rocket flight: a straight-line climb with one loop-the-loop in it.
 *
 * The curve is a **prolate cycloid** — the path traced by a point on the rim of
 * a rolling wheel, and the reason a loop can happen without the rocket ever
 * pausing or backing up. Travel and loop are one parametric curve here rather
 * than two animations layered on top of each other, which is what makes it read
 * as a single continuous flight:
 *
 * ```
 * position(s) = flight * s                       <- travel
 *             + radius * sin(2PI*s)   * forward  <- loop, along the path
 *             + radius * (1-cos(2PI*s)) * perp   <- loop, across the path
 * ```
 *
 * Everything derives from one eased parameter `s`, so the shape of the curve and
 * the speed along it are independent: the easing changes how fast the rocket
 * moves, never where it goes. That is also why the keyframes are meant to be
 * played back **linearly** — the easing is already baked into them, and easing
 * them again would ripple the curve.
 *
 * The nose tracks the tangent throughout, and pitches towards vertical first: a
 * rocket climbing to the right loops anticlockwise, one climbing to the left
 * loops clockwise. Pitching the other way starts the trick by aiming at the
 * ground.
 */
export function loopFlight({
    dx,
    dy,
    loopRatio = 0.2,
    entryRotate,
}: LoopFlightOptions): FlightPath {
    const distance = Math.hypot(dx, dy) || 1;

    // Unit vector along the flight, in screen coordinates (y grows downward).
    const forwardX = dx / distance;
    const forwardY = dy / distance;

    const heading = bearing(forwardX, forwardY);

    // -1 loops anticlockwise, +1 clockwise; either way the nose goes towards
    // vertical first rather than starting the trick by aiming at the ground.
    const spin = heading > 0 ? -1 : 1;

    // Perpendicular to the flight, on the side the loop bulges towards.
    const perpX = -spin * forwardY;
    const perpY = spin * forwardX;

    const radius = loopRatio * distance;

    const x: number[] = [];
    const y: number[] = [];
    const times: number[] = [];
    const progress: number[] = [];

    for (let step = 0; step <= FLIGHT_STEPS; step++) {
        const t = step / FLIGHT_STEPS;
        const s = smoothstep(t);
        const angle = s * Math.PI * 2;

        const along = radius * Math.sin(angle);
        const across = radius * (1 - Math.cos(angle));

        x.push(round(dx * s + forwardX * along + perpX * across));
        y.push(round(dy * s + forwardY * along + perpY * across));
        times.push(Number(t.toFixed(4)));
        progress.push(Number(s.toFixed(4)));
    }

    return {
        x,
        y,
        rotate: noseAlongPath(x, y, entryRotate),
        times,
        progress,
    };
}

/**
 * Turns a sampled path into the rotations that keep the rocket's nose on it.
 *
 * Derived from the path rather than from the loop's own parameter, because on a
 * cycloid the two are not the same: a point on a rolling wheel spins at a steady
 * rate while the curve it traces sweeps unevenly, and near the top of the loop
 * the two disagree by more than 60°. Reading the direction back off the finished
 * curve means the rocket points exactly where it is going, by construction.
 *
 * Angles are unwrapped as they go, so a flight that loops accumulates a full
 * ±360° instead of snapping across the ±180° boundary halfway round.
 */
function noseAlongPath(
    x: number[],
    y: number[],
    entryRotate: number | undefined,
): number[] {
    const rotate: number[] = [];
    let previous: number | null = null;

    for (let i = 0; i < x.length; i++) {
        // Central difference, one-sided at the ends.
        const before = Math.max(0, i - 1);
        const after = Math.min(x.length - 1, i + 1);

        let angle = bearing(x[after] - x[before], y[after] - y[before]);

        if (previous !== null) {
            // Unwrap onto the same revolution as the previous sample.
            angle += Math.round((previous - angle) / 360) * 360;
        }
        previous = angle;

        if (entryRotate !== undefined) {
            const t = i / (x.length - 1);
            if (t < TIP_IN) {
                // Lean out of the resting angle rather than snapping onto the
                // path on the first frame.
                const lean = 1 - t / TIP_IN;
                angle = angle * (1 - lean) + entryRotate * lean;
            }
        }

        rotate.push(round(angle));
    }

    return rotate;
}
