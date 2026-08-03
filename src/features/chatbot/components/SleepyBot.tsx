import { motion, useReducedMotion } from "framer-motion";
import { BotGlyph } from "./BotGlyph";
import { useIdleSleep } from "../hooks/useIdleSleep";

interface SleepyBotProps {
    /** Edge length of the bot in px. */
    size?: number;
    /**
     * Whether the bot may fall asleep. Pass `false` while the assistant is
     * thinking or streaming — dozing off mid-answer reads as a hang, not a joke.
     */
    canSleep?: boolean;
    className?: string;
}

/** The three Z's, smallest first, so they read as drifting away. */
const ZS = [
    { delay: 0, scale: 0.7, drift: 10 },
    { delay: 0.75, scale: 0.9, drift: 16 },
    { delay: 1.5, scale: 1.1, drift: 22 },
];

/**
 * The chat assistant, which nods off if left alone and wakes when you come back.
 *
 * Purely decorative — it is `aria-hidden` and announces nothing, because a
 * screen reader user has no idea there is a cartoon here and does not need a
 * running commentary on its eyelids. Clicking it wakes it, but so does typing
 * anywhere, so the click is a bonus rather than the way out.
 *
 * Under `prefers-reduced-motion` the bot still falls asleep — the state is the
 * joke — but holds a static pose: no blinking, no drifting Z's.
 */
export function SleepyBot({ size = 44, canSleep = true, className }: SleepyBotProps) {
    const reduceMotion = useReducedMotion();
    const { stage, isWaking, wake } = useIdleSleep({ enabled: canSleep });

    const asleep = stage === "asleep";
    const zFontSize = Math.max(9, size * 0.36);

    return (
        <span className={`relative inline-flex ${className ?? ""}`}>
            {/* Not a button: it is decoration, and putting it in the tab order
                would hand keyboard users a control that does nothing they need.
                Pointer presses anywhere already wake it. */}
            <span onPointerDown={wake} className="inline-flex">
                <BotGlyph size={size} stage={stage} isWaking={isWaking} />
            </span>

            {/* Deliberately not wrapped in `AnimatePresence`. Its exit only
                completes once every descendant animation has settled, and these
                loop forever — so the Z's went on drifting out of a wide-awake
                bot for a good while after it woke. Waking should snap them off,
                which unmounting plainly does. */}
            {asleep && (
                <span
                    aria-hidden="true"
                    className="pointer-events-none absolute left-full top-0 select-none font-semibold leading-none text-app-brand-text"
                    style={{ fontSize: zFontSize }}
                >
                    {ZS.map((z, index) => (
                        <motion.span
                            key={index}
                            className="absolute"
                            style={{ scale: z.scale }}
                            initial={{ opacity: 0, x: 0, y: 0 }}
                            animate={
                                reduceMotion
                                    ? { opacity: index === ZS.length - 1 ? 0.8 : 0 }
                                    : {
                                          opacity: [0, 0.9, 0],
                                          x: [0, z.drift * 0.6, z.drift],
                                          y: [0, -z.drift, -z.drift * 1.9],
                                      }
                            }
                            transition={
                                reduceMotion
                                    ? { duration: 0 }
                                    : {
                                          duration: 2.4,
                                          delay: z.delay,
                                          repeat: Infinity,
                                          repeatDelay: 0.3,
                                          ease: "easeOut",
                                      }
                            }
                        >
                            z
                        </motion.span>
                    ))}
                </span>
            )}
        </span>
    );
}
