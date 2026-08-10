import { useEffect, useRef } from "react";
import { useScrollLock } from "../../../components/ui/useScrollLock";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { CircleCheckBig, PartyPopper, Rocket } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { celebrationSpringToken } from "../../../styles/tokens.ts";
import { ConfettiBurst } from "./ConfettiBurst.tsx";
import { ProgressRing } from "./ProgressRing.tsx";
import type { Celebration, MomentTone } from "../types.ts";

interface ToneConfig {
    icon: LucideIcon;
    confetti: number;
    /** Classes for the badge disc behind the icon. */
    badgeClassName: string;
    defaultAction: string;
}

/**
 * Per-tone presentation. Colour is never the only signal — each tone also has
 * its own icon and copy weight, so the three read apart for colour-blind users
 * and in a screenshot alike.
 */
const TONE: Record<MomentTone, ToneConfig> = {
    success: {
        icon: CircleCheckBig,
        confetti: 26,
        badgeClassName: "bg-app-success-bg text-app-success-text",
        defaultAction: "Nice",
    },
    milestone: {
        icon: Rocket,
        confetti: 52,
        badgeClassName: "bg-app-brand-soft text-app-brand-text",
        defaultAction: "Keep going",
    },
    triumph: {
        icon: PartyPopper,
        confetti: 84,
        badgeClassName: "bg-app-orange-bg text-app-orange-text",
        defaultAction: "Awesome",
    },
};

interface MomentCelebrationProps {
    celebration: Celebration;
    onDismiss: () => void;
}

/**
 * Full-screen celebration for an earned moment (check passed, phase unlocked,
 * onboarding finished).
 *
 * Rendered into `<body>` so it is never trapped inside an ancestor's stacking
 * context — the same reason the shared `Modal` portals. Dismissible by button,
 * backdrop or Escape; focus moves to the action button on open and returns to
 * wherever it came from on close.
 */
export function MomentCelebration({
    celebration,
    onDismiss,
}: MomentCelebrationProps) {
    // A deliberate full-screen moment rather than a dialog, so it does not
    // use `Modal` — but the page behind it must still hold still.
    useScrollLock(true);

    const reduceMotion = useReducedMotion();
    const actionRef = useRef<HTMLButtonElement>(null);
    const previouslyFocused = useRef<HTMLElement | null>(null);

    const tone = TONE[celebration.tone];
    const Icon = tone.icon;

    useEffect(() => {
        previouslyFocused.current =
            document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;
        actionRef.current?.focus();

        return () => previouslyFocused.current?.focus();
    }, []);

    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") onDismiss();
        }
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [onDismiss]);

    return createPortal(
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-app-overlay p-6 backdrop-blur-md">
            <button
                type="button"
                aria-label="Dismiss celebration"
                onClick={onDismiss}
                className="absolute inset-0"
            />

            <motion.div
                role="dialog"
                aria-modal="true"
                aria-labelledby="moment-title"
                aria-describedby="moment-message"
                initial={
                    reduceMotion
                        ? { opacity: 0 }
                        : { opacity: 0, scale: 0.86, y: 18 }
                }
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={reduceMotion ? { duration: 0 } : celebrationSpringToken}
                className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-app-brand-border bg-app-surface px-8 py-9 text-center shadow-2xl"
            >
                {/* Soft glow behind the badge, echoing the shared Modal's corner bloom. */}
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-app-brand-glow blur-3xl"
                />

                <ConfettiBurst count={tone.confetti} seedOffset={celebration.seed} />

                {/* A journey moment shows the ring instead of the badge: the two
                    say the same thing, and stacking them makes the card top-heavy. */}
                {celebration.progress ? (
                    <div className="relative mb-5">
                        <ProgressRing
                            current={celebration.progress.current}
                            total={celebration.progress.total}
                        />
                    </div>
                ) : (
                    <motion.div
                        initial={reduceMotion ? false : { scale: 0.4, rotate: -25 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={
                            reduceMotion
                                ? { duration: 0 }
                                : { ...celebrationSpringToken, delay: 0.06 }
                        }
                        className={`relative mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl ${tone.badgeClassName}`}
                    >
                        <Icon className="h-8 w-8" />
                    </motion.div>
                )}

                <h2
                    id="moment-title"
                    className="relative text-2xl font-bold tracking-tight text-app-text"
                >
                    {celebration.title}
                </h2>

                <p
                    id="moment-message"
                    className="relative mx-auto mt-2 max-w-sm text-sm leading-relaxed text-app-text-muted"
                >
                    {celebration.message}
                </p>

                <button
                    ref={actionRef}
                    type="button"
                    onClick={onDismiss}
                    className="relative mt-7 rounded-xl bg-app-brand px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-app-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus"
                >
                    {celebration.actionLabel ?? tone.defaultAction}
                </button>
            </motion.div>
        </div>,
        document.body,
    );
}
