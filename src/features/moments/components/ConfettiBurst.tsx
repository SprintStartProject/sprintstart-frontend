import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { seeded } from "../seededRandom.ts";

/**
 * Palette-only confetti colours so a burst matches the app in light and dark.
 * Semantic tokens on purpose — a hardcoded hex would drift the moment the
 * palette moves.
 */
const CONFETTI_COLORS = [
    "bg-app-brand",
    "bg-app-progress-fill-end",
    "bg-app-success-solid",
    "bg-app-warning-solid",
    "bg-app-orange-text",
];

interface ConfettiBurstProps {
    /** Number of pieces. Tone-dependent — see `MomentCelebration`. */
    count: number;
    /** Distinguishes consecutive bursts so each one re-seeds its own spread. */
    seedOffset?: number;
}

interface Piece {
    /** Horizontal travel, in px. */
    dx: number;
    /** Upward travel at the top of the arc, in px (negative = up). */
    dy: number;
    /** How far below the arc the piece falls out of view, in px. */
    fall: number;
    duration: number;
    delay: number;
    rotate: number;
    size: number;
    color: string;
    square: boolean;
}

/**
 * A radial confetti burst, anchored to the centre of its positioned parent.
 *
 * Purely decorative: `aria-hidden`, `pointer-events-none`, and rendered as
 * nothing at all for users who prefer reduced motion — a burst of moving
 * particles is exactly what that preference exists to suppress.
 */
export function ConfettiBurst({ count, seedOffset = 0 }: ConfettiBurstProps) {
    const reduceMotion = useReducedMotion();

    const pieces = useMemo<Piece[]>(() => {
        return Array.from({ length: count }, (_, i) => {
            const s = i + seedOffset * 1000;
            // Bias the spread upward: confetti thrown sideways reads as a leak,
            // thrown up and falling back reads as a burst.
            const angle = seeded(s) * Math.PI * 2;
            const speed = 90 + seeded(s + 11) * 190;

            return {
                dx: Math.cos(angle) * speed,
                dy: Math.sin(angle) * speed - 90,
                fall: 420 + seeded(s + 22) * 260,
                duration: 1.5 + seeded(s + 33) * 1.1,
                delay: seeded(s + 44) * 0.12,
                rotate: (seeded(s + 55) - 0.5) * 900,
                size: 6 + Math.round(seeded(s + 66) * 5),
                color: CONFETTI_COLORS[
                    Math.floor(seeded(s + 77) * CONFETTI_COLORS.length)
                ],
                square: seeded(s + 88) > 0.45,
            };
        });
    }, [count, seedOffset]);

    if (reduceMotion) return null;

    return (
        <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden"
        >
            {pieces.map((piece, index) => (
                <motion.span
                    key={index}
                    className={`absolute left-1/2 top-1/2 ${piece.color} ${
                        piece.square ? "rounded-[2px]" : "rounded-full"
                    }`}
                    style={{ width: piece.size, height: piece.size }}
                    initial={{ x: 0, y: 0, opacity: 0, rotate: 0, scale: 0.4 }}
                    animate={{
                        x: [0, piece.dx, piece.dx * 1.15],
                        y: [0, piece.dy, piece.dy + piece.fall],
                        opacity: [0, 1, 1, 0],
                        rotate: piece.rotate,
                        scale: 1,
                    }}
                    transition={{
                        duration: piece.duration,
                        delay: piece.delay,
                        ease: "easeOut",
                        times: [0, 0.25, 1],
                        opacity: {
                            duration: piece.duration,
                            delay: piece.delay,
                            times: [0, 0.08, 0.72, 1],
                        },
                    }}
                />
            ))}
        </div>
    );
}
