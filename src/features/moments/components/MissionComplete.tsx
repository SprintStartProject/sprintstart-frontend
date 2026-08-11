import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { RocketGlyph } from "./RocketGlyph.tsx";
import { StarField } from "./StarField.tsx";
import { ConfettiBurst } from "./ConfettiBurst.tsx";
import { rocketSizeFor } from "../flightGeometry.ts";
import { momentStageRect } from "../momentStage.ts";
import { celebrationSpringToken } from "../../../styles/tokens.ts";
import { useScrollLock } from "../../../components/ui/useScrollLock";

interface MissionCompleteProps {
  /** Greeted by name on the final card when the profile is loaded. */
  displayName?: string;
  onDismiss: () => void;
}

/**
 * Stages of the sequence, in order. Each one is a distinct beat rather than a
 * slice of a single long animation, so any of them can be retimed without
 * recomputing the rest.
 */
type Stage = "approach" | "touchdown" | "arrival";

const STAGE_MS: Record<Stage, number> = {
  // The long one: the descent is the part worth watching.
  approach: 1500,
  touchdown: 950,
  // Terminal: the card stays until dismissed.
  arrival: 0,
};

const STAGE_ORDER: Stage[] = ["approach", "touchdown", "arrival"];

/**
 * The finale: finishing the entire onboarding path.
 *
 * The far end of the journey the app has been telling all along. `PathReveal`
 * launched from Earth on the day the path was built, every step flyby was a leg
 * of the trip, and this is the arrival: the rocket comes down onto the Moon,
 * kicks up dust, and settles — with Earth a small blue dot in the sky behind
 * it, which is the distance covered made visible.
 *
 * This is the loudest thing the app does, and it is allowed to be, because it
 * happens exactly once per person. Everything else in the moments layer is
 * tuned to stay under it — a step flyby passes in under a second and never dims
 * the page, a phase celebration is a card.
 *
 * Landings are slow where launches are violent, and the timing follows that:
 * the descent takes its time, the touchdown settles rather than lands hard.
 * The stars hold still throughout — the ground is already in frame, and a sky
 * that slides behind a fixed horizon reads as broken, not as descending.
 *
 * Covers the content area rather than the screen (see `momentStage`), so the
 * sidebar stays put: the page the journey happened on is where it ends.
 *
 * Skippable at any point — a sequence you cannot escape stops being a reward
 * the second time someone sees it — and reduced to the arrival card alone under
 * `prefers-reduced-motion`.
 */
export function MissionComplete({ displayName, onDismiss }: MissionCompleteProps) {
  // A deliberate full-screen moment rather than a dialog, so it does not
  // use `Modal` — but the page behind it must still hold still.
  useScrollLock(true);

  const reduceMotion = useReducedMotion();
  const [stage, setStage] = useState<Stage>(() => (reduceMotion ? "arrival" : "approach"));

  // Resolved once: the landing is over in seconds, so a resize or sidebar
  // toggle mid-sequence is not worth re-deriving for.
  const stageRect = useMemo(() => momentStageRect(), []);
  const rocketSize = useMemo(() => rocketSizeFor(stageRect.width) * 1.4, [stageRect]);
  const actionRef = useRef<HTMLButtonElement>(null);

  // Focus lands on the dismiss button once the card arrives, so a keyboard
  // user is never stranded in an overlay they cannot leave.
  useEffect(() => {
    if (stage === "arrival") actionRef.current?.focus();
  }, [stage]);

  // Advances through the beats. A single timer per stage rather than one long
  // schedule, so skipping mid-sequence cancels cleanly.
  useEffect(() => {
    const hold = STAGE_MS[stage];
    if (hold === 0) return;

    const timer = window.setTimeout(() => {
      const next = STAGE_ORDER[STAGE_ORDER.indexOf(stage) + 1];
      if (next) setStage(next);
    }, hold);

    return () => window.clearTimeout(timer);
  }, [stage]);

  // Any input jumps to the card. The sequence is a gift, not a toll.
  useEffect(() => {
    if (stage === "arrival") return;

    const skip = () => setStage("arrival");
    document.addEventListener("keydown", skip);
    document.addEventListener("pointerdown", skip);
    return () => {
      document.removeEventListener("keydown", skip);
      document.removeEventListener("pointerdown", skip);
    };
  }, [stage]);

  const hasLanded = stage === "touchdown" || stage === "arrival";

  return createPortal(
    <div
      className="fixed z-[95] flex items-center justify-center overflow-hidden bg-app-bg"
      style={{
        left: stageRect.left,
        top: stageRect.top,
        width: stageRect.width,
        height: stageRect.height,
      }}
    >
      {!reduceMotion && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          // Dims behind the card rather than clearing out: the landing
          // is what the card is talking about.
          animate={{ opacity: stage === "arrival" ? 0.4 : 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          {/* Held still, unlike the launch's parallax: the surface is
                        already in frame, so a sliding sky reads as the sky
                        being broken rather than as descent — and seventy
                        concurrently animated stars were where the touchdown
                        dropped its frames. */}
          <StarField seedOffset={3} />

          {/* Earth, small and far behind: where this started. Nothing
                        else in the frame says how far someone has come. */}
          <span
            className="absolute top-[16%] left-[22%] rounded-full"
            style={{
              width: 34,
              height: 34,
              background:
                "radial-gradient(circle at 40% 32%, var(--brand-border-strong) 0%, var(--brand) 45%, var(--progress-fill-end) 100%)",
              boxShadow: "0 0 26px 3px var(--brand-glow)",
            }}
          />

          {/* The Moon: same trick as Earth in the launch — a disc far
                        wider than the screen, mostly below it, so what shows is
                        a horizon to land on rather than a ball to look at. */}
          <motion.div
            className="absolute left-1/2 w-[280vw] max-w-[2400px] -translate-x-1/2 rounded-full"
            style={{
              aspectRatio: "1 / 1",
              top: "78%",
              // Theme-stable greys, so the surface looks the same
              // in light and dark instead of dissolving into one.
              background:
                "radial-gradient(circle at 44% 24%, var(--text-subtle) 0%, var(--text-muted) 40%, var(--border-strong) 100%)",
              boxShadow: "0 0 90px 18px var(--brand-glow)",
            }}
            // Takes the weight of the landing: a surface that does
            // not react is a backdrop, not ground.
            animate={hasLanded ? { y: [0, 5, 0] } : { y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            {/* Craters. Low contrast on purpose — enough to give the
                            limb some texture, not enough to look like a map. */}
            <span className="absolute top-[5%] left-[30%] h-[6%] w-[13%] rounded-[50%] bg-app-bg opacity-[0.16] blur-lg" />
            <span className="absolute top-[9%] left-[56%] h-[4%] w-[9%] rounded-[50%] bg-app-bg opacity-[0.13] blur-lg" />
            <span className="absolute top-[15%] left-[44%] h-[3%] w-[6%] rounded-[50%] bg-app-bg opacity-10 blur-lg" />
          </motion.div>

          {/* Dust kicked out sideways at touchdown. Wide and low: it
                        is being pushed along the ground, not thrown upward. */}
          <AnimatePresence>
            {hasLanded && (
              <motion.span
                key="dust"
                className="absolute top-[78%] left-1/2 -translate-x-1/2 rounded-[50%]"
                style={{
                  width: rocketSize * 2.2,
                  height: rocketSize * 0.45,
                  marginTop: -rocketSize * 0.25,
                  background:
                    "radial-gradient(50% 50%, var(--text-subtle) 0%, var(--text-muted) 45%, transparent 74%)",
                  filter: "blur(12px)",
                }}
                initial={{ scaleX: 0.3, scaleY: 0.5, opacity: 0 }}
                animate={{
                  scaleX: [0.3, 2.6, 3.4],
                  scaleY: [0.5, 1.1, 1.25],
                  opacity: [0, 0.7, 0],
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.4, ease: "easeOut" }}
              />
            )}
          </AnimatePresence>

          {/* The rocket: drops in from above under retro thrust, and
                        cuts its engine the moment it is down. */}
          <motion.div
            className="absolute top-[78%] left-1/2 text-app-brand"
            style={{
              marginLeft: -rocketSize / 2,
              marginTop: -rocketSize,
              filter: "drop-shadow(0 0 26px var(--brand-glow))",
            }}
            initial={{ y: -0.95 * stageRect.height, scale: 0.5, opacity: 0 }}
            animate={{
              y: 0,
              scale: 1,
              opacity: 1,
              // A touch of drift on the way down, killed before it
              // lands. Perfectly vertical reads as a lift being
              // lowered; a small correction reads as flying.
              x: hasLanded ? 0 : [6, -4, 0],
            }}
            transition={{
              // Decelerating into the surface: fast while there is
              // sky left, slow over the last few metres.
              duration: 1.5,
              ease: [0.35, 0.6, 0.2, 1],
              x: { duration: 1.5, ease: "easeInOut" },
            }}
          >
            <RocketGlyph size={rocketSize} flame={stage === "approach"} />
          </motion.div>
        </motion.div>
      )}

      {/* Arrival card. */}
      <AnimatePresence>
        {stage === "arrival" && (
          <motion.div
            key="card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mission-complete-title"
            className="relative z-10 mx-6 w-full max-w-lg overflow-hidden rounded-3xl border border-app-brand-border bg-app-surface px-8 py-10 text-center shadow-2xl"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8, y: 26 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={reduceMotion ? { duration: 0 } : celebrationSpringToken}
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-28 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-app-brand-glow blur-3xl"
            />

            <ConfettiBurst count={140} seedOffset={7} />

            <motion.div
              className="relative mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full text-app-brand"
              style={{
                background: "var(--brand-soft)",
                filter: "drop-shadow(0 0 20px var(--brand-glow))",
              }}
              initial={reduceMotion ? false : { scale: 0.3, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={
                reduceMotion ? { duration: 0 } : { ...celebrationSpringToken, delay: 0.1 }
              }
            >
              <RocketGlyph size={54} flame />
            </motion.div>

            <p className="relative text-[11px] font-semibold tracking-[0.22em] text-app-brand-text uppercase">
              Onboarding complete
            </p>

            <h2
              id="mission-complete-title"
              className="relative mt-3 text-3xl font-bold tracking-tight text-app-text"
            >
              {displayName ? `You're on board, ${displayName}` : "You're on board"}
            </h2>

            <p className="relative mx-auto mt-3 max-w-sm text-sm leading-relaxed text-app-text-muted">
              Every phase cleared, every check passed. You know where things live, how they fit
              together, and who to ask. Go build something.
            </p>

            <button
              ref={actionRef}
              type="button"
              onClick={onDismiss}
              className="relative mt-8 rounded-xl bg-app-brand px-7 py-3 text-sm font-medium text-white transition-colors hover:bg-app-brand-hover focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
            >
              Let&apos;s go
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Skip affordance, so the sequence never feels like a lock-in. */}
      {stage !== "arrival" && (
        <p className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[11px] font-medium tracking-[0.18em] text-app-text-subtle uppercase">
          Press any key to skip
        </p>
      )}
    </div>,
    document.body,
  );
}
