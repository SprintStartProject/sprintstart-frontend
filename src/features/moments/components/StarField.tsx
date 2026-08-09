import { useMemo } from "react";
import { motion } from "framer-motion";
import { seeded } from "../seededRandom.ts";

interface StarFieldProps {
    /**
     * How far the field travels while `moving` is true, as a multiple of each
     * star's own depth-derived distance. Positive slides down (the viewer is
     * climbing), negative slides up (the viewer is descending).
     *
     * Omit it for a sky that holds still. That renders plain spans with no
     * animation attached at all — seventy idle motion components are seventy
     * spring subscriptions the scene pays for without anything moving.
     */
    travel?: number;
    /** Whether the field is currently sliding. Only read when `travel` is set. */
    moving?: boolean;
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
 * On the launch the stars are what make it read as *travel* rather than as a
 * rocket sliding across a backdrop: they move at different speeds depending on
 * a per-star depth, and that parallax is the cheapest honest signal of
 * distance there is. The landing keeps them still — the viewer is coming down
 * onto ground that is already in frame, and a sky that moves behind a fixed
 * horizon reads as the sky being broken, not as descent.
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
    moving = false,
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

    if (travel === undefined) {
        return (
            <>
                {stars.map((star, index) => (
                    <span
                        key={index}
                        className="absolute rounded-full bg-app-text"
                        style={{
                            left: `${star.left}%`,
                            top: `${star.top}%`,
                            width: star.size,
                            height: star.size,
                            opacity: star.opacity,
                        }}
                    />
                ))}
            </>
        );
    }

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
