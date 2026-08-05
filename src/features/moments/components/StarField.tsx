import { useMemo } from "react";
import { motion } from "framer-motion";
import { seeded } from "../seededRandom.ts";

interface StarFieldProps {
    /**
     * How far the field travels while `moving` is true, as a multiple of each
     * star's own depth-derived distance. Positive slides down (the viewer is
     * climbing), negative slides up (the viewer is descending).
     */
    travel: number;
    /** Whether the field is currently sliding. */
    moving: boolean;
    /** How long the slide takes, in seconds. */
    duration?: number;
    /** Distinguishes two fields on screen so they are not the same sky twice. */
    seedOffset?: number;
}

/** Stars in a field. Enough to read as space, few enough to stay quiet. */
const STAR_COUNT = 70;

interface Star {
    /** Position as a percentage of the viewport. */
    left: number;
    top: number;
    size: number;
    opacity: number;
    /** Depth-derived travel distance, in px. */
    drift: number;
}

/**
 * The sky both space scenes are set in: the launch away from Earth and the
 * landing on the Moon.
 *
 * The stars are what make either of those read as *travel* rather than as a
 * rocket sliding across a backdrop. They move at different speeds depending on
 * a per-star depth, and that parallax is the cheapest honest signal of distance
 * there is — with a field that moves as one, the rocket is just an icon being
 * animated.
 *
 * Positions are seeded rather than random, so the sky does not visibly reshuffle
 * when the component re-renders between beats.
 *
 * Colour is `app-text`, which means dark stars on a light background in the
 * light theme. That is deliberate: it is the palette's foreground token, so the
 * field stays visible in both themes rather than disappearing into one of them.
 */
export function StarField({
    travel,
    moving,
    duration = 1.6,
    seedOffset = 0,
}: StarFieldProps) {
    const stars = useMemo<Star[]>(
        () =>
            Array.from({ length: STAR_COUNT }, (_, index) => {
                const s = index + seedOffset * 1000;
                const depth = seeded(s + 300);
                return {
                    left: seeded(s) * 100,
                    // Kept out of the bottom fifth, which is where the planet is.
                    top: seeded(s + 100) * 80,
                    size: 1 + Math.round(depth * 2),
                    opacity: 0.25 + depth * 0.55,
                    drift: 120 + depth * 460,
                };
            }),
        [seedOffset],
    );

    return (
        <>
            {stars.map((star, index) => (
                <motion.span
                    key={index}
                    className="absolute rounded-full bg-app-text"
                    style={{
                        left: `${star.left}%`,
                        top: `${star.top}%`,
                        width: star.size,
                        height: star.size,
                        opacity: star.opacity,
                    }}
                    initial={{ y: 0 }}
                    animate={{ y: moving ? star.drift * travel : 0 }}
                    transition={{ duration, ease: moving ? "easeIn" : "easeOut" }}
                />
            ))}
        </>
    );
}
