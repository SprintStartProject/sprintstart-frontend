/** Keyframe points traced around the loop. More = rounder, but heavier. */
const LOOP_STEPS = 16;

/** Fraction of the flight before the loop starts / after it finishes. */
const LOOP_START = 0.22;
const LOOP_END = 0.8;

export interface LoopFlightKeyframes {
    /** Horizontal offset from the travel path, in px. */
    x: number[];
    /** Vertical offset from the travel path, in px. */
    y: number[];
    /** Absolute rotation, in degrees. */
    rotate: number[];
    /** Normalised keyframe positions; same length as the arrays above. */
    times: number[];
}

/**
 * Builds a loop-the-loop for a rocket already travelling along a straight path.
 *
 * The offsets trace a full circle that both starts and ends at (0, 0), so they
 * add a loop *on top of* the travel transform on a parent element without
 * disturbing where the flight begins or ends.
 *
 * Rotation is generated in lockstep with the circle rather than run as a
 * separate spin: a rocket that rotates without moving reads as pirouetting in
 * place, which is the thing this replaces. Going -360° matches the direction
 * the circle is traced (bottom → right → top → left), so the nose always points
 * along the arc.
 *
 * @param radius Loop radius in px. Around 1.2x the rocket's size keeps the loop
 *               tight enough to read as a deliberate trick rather than a detour.
 * @param heading Rotation of the straight-line flight, in degrees from "up".
 */
export function loopFlight(radius: number, heading: number): LoopFlightKeyframes {
    const x: number[] = [0];
    const y: number[] = [0];
    const rotate: number[] = [heading];
    const times: number[] = [0];

    for (let step = 0; step <= LOOP_STEPS; step++) {
        const progress = step / LOOP_STEPS;
        const angle = progress * Math.PI * 2;

        // Circle centred a radius above the path, entered from its lowest point,
        // so the rocket climbs into the loop instead of dropping into it.
        x.push(Number((radius * Math.sin(angle)).toFixed(2)));
        y.push(Number((-radius * (1 - Math.cos(angle))).toFixed(2)));
        rotate.push(Number((heading - 360 * progress).toFixed(2)));
        times.push(LOOP_START + progress * (LOOP_END - LOOP_START));
    }

    x.push(0);
    y.push(0);
    rotate.push(heading - 360);
    times.push(1);

    return { x, y, rotate, times };
}

/**
 * Heading of a flight vector, in degrees clockwise from "up".
 *
 * `RocketGlyph` points straight up at 0°, so this is what makes a rocket travel
 * nose-first. Approximate on purpose when given viewport units: vw and vh are
 * not the same number of pixels, so an exact angle would only ever be right at
 * one aspect ratio.
 */
export function headingOf(dx: number, dy: number): number {
    return Math.round((Math.atan2(dx, -dy) * 180) / Math.PI);
}
