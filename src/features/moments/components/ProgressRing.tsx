import { motion, useReducedMotion } from "framer-motion";
import { RocketGlyph } from "./RocketGlyph.tsx";

interface ProgressRingProps {
    /** Completed segments. */
    current: number;
    /** Total segments in the journey. */
    total: number;
    size?: number;
}

const STROKE = 5;

/**
 * A ring that fills to show how far along a journey someone is, with the rocket
 * sitting in the middle.
 *
 * Segmented rather than continuous: a smooth arc reads as a percentage, and a
 * percentage is a measurement. Discrete ticks read as *stages*, which is what
 * onboarding phases actually are — and it lets someone see "two down, three to
 * go" without doing arithmetic on an angle.
 *
 * The newly-earned segment animates in last and slightly behind the rest, so
 * the eye lands on the thing that just changed.
 */
export function ProgressRing({ current, total, size = 92 }: ProgressRingProps) {
    const reduceMotion = useReducedMotion();

    const radius = (size - STROKE) / 2;
    const centre = size / 2;
    const circumference = 2 * Math.PI * radius;

    // A hair of padding between ticks so they read as separate segments without
    // the gaps eating the ring at high counts.
    const gap = Math.min(6, circumference / (total * 6));
    const segment = circumference / total - gap;

    return (
        <div
            className="relative mx-auto"
            style={{ width: size, height: size }}
            role="img"
            aria-label={`Phase ${current} of ${total} complete`}
        >
            <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
                {Array.from({ length: total }, (_, index) => {
                    const filled = index < current;
                    const isNewest = index === current - 1;
                    const offset = -(index * (segment + gap));

                    return (
                        <motion.circle
                            key={index}
                            cx={centre}
                            cy={centre}
                            r={radius}
                            fill="none"
                            strokeWidth={STROKE}
                            strokeLinecap="round"
                            strokeDasharray={`${segment} ${circumference - segment}`}
                            strokeDashoffset={offset}
                            className={
                                filled ? "stroke-app-brand" : "stroke-app-progress-track"
                            }
                            initial={
                                reduceMotion || !filled
                                    ? false
                                    : { pathLength: 0, opacity: 0 }
                            }
                            animate={{ pathLength: 1, opacity: 1 }}
                            transition={
                                reduceMotion
                                    ? { duration: 0 }
                                    : {
                                          duration: isNewest ? 0.5 : 0.3,
                                          delay: isNewest ? 0.45 : index * 0.07,
                                          ease: "easeOut",
                                      }
                            }
                        />
                    );
                })}
            </svg>

            <div className="absolute inset-0 flex items-center justify-center text-app-brand">
                <RocketGlyph size={size * 0.4} />
            </div>
        </div>
    );
}
