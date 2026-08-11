import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { RocketGlyph } from "./RocketGlyph.tsx";
import { StarField } from "./StarField.tsx";
import { rocketSizeFor } from "../flightGeometry.ts";
import { momentStageRect } from "../momentStage.ts";
import { flightEaseToken } from "../../../styles/tokens.ts";

interface PathRevealProps {
  /**
   * Called once, when the user lights the fuse. Fires before anything has
   * flown, so a caller can record the moment as spent the instant it becomes
   * the user's — and *not* record it for a rocket that was only ever offered.
   */
  onLaunch?: () => void;
  /** Called when the launch is over, or as soon as the user skips it. */
  onDone: () => void;
}

/**
 * Beats of the launch, in order.
 *
 * One timer per beat rather than one long schedule: skipping mid-sequence then
 * cancels cleanly, and any beat can be retimed without recomputing the others.
 */
type Stage = "waiting" | "ignition" | "ascent" | "departure";

const STAGE_MS: Record<Stage, number> = {
  // Held: the rocket trembles on the pad until the user sets it off — the
  // first input is the launch button, and there is no timer standing in for
  // it. Someone who steps away mid-wait comes back to a rocket still waiting
  // for *them*, not to a page the launch played itself out over.
  waiting: 0,
  ignition: 850,
  ascent: 1150,
  // The hand-over: the rocket leaves the frame and the sky goes with it.
  departure: 850,
};

const STAGE_ORDER: Stage[] = ["waiting", "ignition", "ascent", "departure"];

/** How long the sky takes to clear the screen, in seconds. */
const DEPARTURE_S = 0.75;

/**
 * The moment an onboarding path is finished being built, the first time its
 * owner lays eyes on it.
 *
 * The other moments mark something the user *did*. This one marks something
 * that was made for them while they waited, so it is the departure: the rocket
 * stands on Earth, lights up, and leaves. The step flybys are the journey
 * between here and there, and `MissionComplete` is the far end of it.
 *
 * Three things carry it:
 *
 * - **The user lights the fuse.** The rocket waits on the pad, trembling, and
 *   the first key or click is what launches it — for as long as that takes. A
 *   launch that plays itself is something that happens *near* you; one you set
 *   off is yours, and someone who steps away mid-wait comes back to a rocket
 *   still waiting for them. A second input skips the rest, exactly as before.
 * - **The camera stays with the rocket.** It barely moves up the frame; the
 *   planet dropping away underneath and the stars sliding past are what do the
 *   travelling. A rocket that simply slides up the screen reads as an icon
 *   being animated.
 * - **It ends by getting out of the way.** No card, no button: the rocket
 *   accelerates out of the top and drags the whole sky up with it, uncovering
 *   the onboarding page from the bottom edge upwards. The sequence hands over
 *   to the page rather than asking to be dismissed first, so the last thing it
 *   does is show the user what it was about.
 *
 * Covers the content area rather than the screen (see `momentStage`), so the
 * sidebar stays where it is: this is the page having a moment, not the app
 * being replaced. Navigation therefore stays available throughout, and taking
 * it ends the launch — but that is the *page's* doing, on unmount, not
 * something handled here. See `usePathRevealMoment`.
 *
 * The page itself is not transformed to slide it in, tempting as that is: a
 * transform on an ancestor becomes the containing block for every
 * `position: fixed` descendant, which would knock the sidebar and any open
 * drawer out of place for the duration and snap them back at the end. Moving
 * the cover instead is the same reveal with none of that.
 *
 * Teardown is on a timer rather than on `onAnimationComplete` — the same reason
 * `RocketFlyby` does it that way. That callback is the animation reporting on
 * itself: if it never starts, the callback never fires and this overlay stays
 * over the app forever.
 *
 * Renders nothing at all under `prefers-reduced-motion` — it is a piece of
 * motion carrying no information, so the honest reduced version is none of it.
 */
export function PathReveal({ onLaunch, onDone }: PathRevealProps) {
  const reduceMotion = useReducedMotion();
  const [stage, setStage] = useState<Stage>("waiting");
  const rootRef = useRef<HTMLDivElement>(null);
  // Two presses landing in the same tick would both still see "waiting", and
  // a moment can only be spent once.
  const hasLaunchedRef = useRef(false);

  // Resolved once: the launch is over in a few seconds, so a resize or a
  // sidebar toggle mid-sequence is not worth re-deriving for.
  const stageRect = useMemo(() => momentStageRect(), []);
  const rocketSize = useMemo(() => rocketSizeFor(stageRect.width) * 1.4, [stageRect]);

  useEffect(() => {
    if (reduceMotion) onDone();
  }, [reduceMotion, onDone]);

  useEffect(() => {
    if (reduceMotion) return;

    // A hold of zero is a beat with no clock on it — the wait on the pad,
    // which only input moves past.
    const hold = STAGE_MS[stage];
    if (hold === 0) return;

    const timer = window.setTimeout(() => {
      const next = STAGE_ORDER[STAGE_ORDER.indexOf(stage) + 1];
      if (next) setStage(next);
      else onDone();
    }, hold);

    return () => window.clearTimeout(timer);
  }, [stage, reduceMotion, onDone]);

  // The page is pinned to the top for the whole moment, not nudged there at
  // the end. A launch that goes *up* has to hand over to the start of the
  // path; uncovering its middle — or its footer — is the one ending that
  // makes no sense.
  //
  // Held rather than set once, because a fixed overlay does not stop the page
  // underneath from scrolling: a wheel passes straight through it, and the
  // browser restores a remembered position of its own accord once the path's
  // content finishes loading. Setting it only at the hand-over meant the
  // scrollbar visibly ran down and back up — and any exit that skipped that
  // beat, such as a click on the sidebar, left the page stranded where the
  // scroll had put it.
  useEffect(() => {
    if (reduceMotion) return;

    window.scrollTo(0, 0);

    const pin = () => {
      if (window.scrollY !== 0) window.scrollTo(0, 0);
    };
    window.addEventListener("scroll", pin, { passive: true });
    return () => window.removeEventListener("scroll", pin);
  }, [reduceMotion]);

  // Input inside the overlay advances the story one beat: the first press is
  // the launch itself, the second cuts to the hand-over, a third takes the
  // rest. Never straight to nothing mid-flight — someone who has seen the
  // launch still has to arrive somewhere, and a screen that vanishes
  // mid-frame reads as a crash.
  //
  // A pointer press *outside* the overlay ends it immediately instead: with
  // the sidebar left visible, that press is someone using the app, and an
  // animation that intercepts navigation to show its next beat has made
  // itself the obstacle it was supposed to be the reward.
  useEffect(() => {
    if (reduceMotion) return;

    const advance = () => {
      if (stage === "waiting") {
        if (hasLaunchedRef.current) return;
        hasLaunchedRef.current = true;
        setStage("ignition");
        onLaunch?.();
      } else if (stage === "departure") onDone();
      else setStage("departure");
    };

    const handleKeyDown = () => advance();

    // Presses on the overlay drive the sequence; presses outside it are
    // ignored outright. Closing on an outside press is what used to flash
    // the path on the way out — the router keeps the old view up while a
    // navigation is pending, so the overlay went away well before the new
    // one arrived. Leaving is the page's business now: whoever put this up
    // takes it down when their page unmounts, which is the same instant
    // the new view appears.
    const handlePointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      const isOutside = !!root && event.target instanceof Node && !root.contains(event.target);
      if (isOutside) return;
      advance();
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [stage, reduceMotion, onLaunch, onDone]);

  if (reduceMotion) return null;

  const isFlying = stage !== "waiting";
  const hasClimbed = stage === "ascent" || stage === "departure";
  const isLeaving = stage === "departure";

  return createPortal(
    <motion.div
      ref={rootRef}
      aria-hidden="true"
      data-testid="path-reveal"
      className="fixed z-[85] overflow-hidden bg-app-bg"
      style={{
        left: stageRect.left,
        top: stageRect.top,
        width: stageRect.width,
        height: stageRect.height,
      }}
      // The sky leaves through the top, so the page underneath is
      // uncovered from the bottom edge upwards — the user is slid onto it
      // rather than handed it.
      initial={{ y: 0 }}
      animate={{ y: isLeaving ? "-100%" : 0 }}
      transition={{ duration: DEPARTURE_S, ease: [0.5, 0, 0.75, 0] }}
    >
      <StarField travel={1} moving={hasClimbed} duration={1.6} />

      {/* The Moon, far off and dead ahead: where this is all going. Small
                and static — it is a destination, not a participant. */}
      <motion.span
        className="absolute top-[12%] left-1/2 rounded-full"
        style={{
          width: 54,
          height: 54,
          marginLeft: -27,
          // Greys that stay grey in both themes, so the moon keeps a
          // defined edge instead of fading into a light background.
          background:
            "radial-gradient(circle at 38% 32%, var(--text-muted) 0%, var(--text-subtle) 62%, var(--border-strong) 100%)",
          boxShadow: "0 0 34px 2px var(--brand-glow)",
        }}
        initial={{ opacity: 0.45, scale: 0.85 }}
        animate={{
          opacity: hasClimbed ? 1 : 0.45,
          scale: hasClimbed ? 1.12 : 0.85,
        }}
        transition={{ duration: 1.6, ease: "easeOut" }}
      />

      {/* Earth. A disc far wider than the screen, sitting mostly below it,
                so what shows is a curved horizon rather than a ball — the
                difference between standing on a planet and looking at one. */}
      <motion.div
        className="absolute left-1/2 w-[280vw] max-w-[2400px] -translate-x-1/2 rounded-full"
        style={{
          aspectRatio: "1 / 1",
          top: "78%",
          // Every stop is a token that holds its value across themes.
          // A planet is an object, not a surface — it should look the
          // same in light and dark, and the theme-flipping tokens
          // dissolve its edge into the page in one of the two.
          background:
            "radial-gradient(circle at 42% 26%, var(--brand-border-strong) 0%, var(--brand) 44%, var(--progress-fill-end) 100%)",
          boxShadow: "0 0 120px 26px var(--brand-glow), inset 0 14px 60px -10px var(--brand-glow)",
        }}
        initial={{ y: 0, scale: 1 }}
        animate={{
          y: isLeaving ? "70%" : hasClimbed ? "26%" : 0,
          scale: isLeaving ? 0.6 : hasClimbed ? 0.82 : 1,
        }}
        transition={{
          duration: isLeaving ? DEPARTURE_S : 1.6,
          ease: "easeIn",
        }}
      >
        {/* Cloud banding, so the limb is not a flat gradient. Blurred
                    and low-contrast on purpose: it should read at a glance and
                    survive being looked at directly. */}
        <span className="absolute top-[6%] left-[26%] h-[9%] w-[34%] rounded-[50%] bg-app-surface opacity-[0.14] blur-xl" />
        <span className="absolute top-[14%] left-[52%] h-[7%] w-[26%] rounded-[50%] bg-app-surface opacity-10 blur-xl" />
      </motion.div>

      {/* Atmosphere: a bright rim hugging the horizon, which is what
                actually sells the curve. */}
      <motion.div
        className="absolute left-1/2 w-[280vw] max-w-[2400px] -translate-x-1/2 rounded-full"
        style={{
          aspectRatio: "1 / 1",
          top: "78%",
          boxShadow: "0 0 60px 8px var(--brand-border-strong)",
          opacity: 0.35,
        }}
        initial={{ y: 0, scale: 1 }}
        animate={{
          y: isLeaving ? "70%" : hasClimbed ? "26%" : 0,
          scale: isLeaving ? 0.6 : hasClimbed ? 0.82 : 1,
        }}
        transition={{
          duration: isLeaving ? DEPARTURE_S : 1.6,
          ease: "easeIn",
        }}
      />

      {/* Ignition: exhaust piling up against the ground and a plume out of
                the nozzle. Anchored to the pad, so it stays behind when the
                rocket goes. */}
      <AnimatePresence>
        {isFlying && (
          <motion.div
            key="ignition"
            className="absolute top-[78%] left-1/2 -translate-x-1/2"
            style={{ marginTop: rocketSize * 0.1 }}
            exit={{ opacity: 0, transition: { duration: 0.5 } }}
          >
            <motion.span
              className="absolute top-0 left-1/2 -translate-x-1/2 rounded-[50%]"
              style={{
                width: rocketSize * 1.6,
                height: rocketSize * 0.5,
                background:
                  "radial-gradient(50% 50%, var(--progress-fill-end) 0%, var(--brand) 45%, transparent 72%)",
                filter: "blur(14px)",
              }}
              initial={{ scaleX: 0.2, scaleY: 0.3, opacity: 0 }}
              animate={{
                scaleX: [0.2, 3, 4.2],
                scaleY: [0.3, 1.1, 1.35],
                opacity: [0, 0.9, hasClimbed ? 0 : 0.8],
              }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            />

            <motion.span
              className="absolute top-0 left-1/2 -translate-x-1/2 rounded-full"
              style={{
                width: rocketSize * 0.28,
                height: rocketSize * 1.3,
                transformOrigin: "50% 0%",
                background:
                  "linear-gradient(180deg, var(--progress-fill-end), var(--brand) 40%, transparent)",
                filter: "blur(9px)",
              }}
              initial={{ scaleY: 0, opacity: 0 }}
              animate={{
                scaleY: [0, 1, 0.8, 1],
                opacity: [0, 0.95, 0.8, 0.9],
              }}
              transition={{ duration: 0.9, ease: "easeOut" }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* The rocket. Fidgets on the pad until it is set off, shakes
                against its own thrust, climbs a fifth of the stage while the
                world falls away, then accelerates out of the top. */}
      <motion.div
        className="absolute top-[78%] left-1/2 text-app-brand"
        style={{
          marginLeft: -rocketSize / 2,
          marginTop: -rocketSize,
          filter: "drop-shadow(0 0 24px var(--brand-glow))",
        }}
        initial={{ x: 0, y: 0, rotate: 0, scale: 1 }}
        animate={
          stage === "waiting"
            ? {
                // Eager, not shaking: a slow lean side to side,
                // like something straining against its clamps.
                // The violent tremble belongs to ignition —
                // spending it here leaves nothing to escalate to.
                x: 0,
                y: 0,
                rotate: [0, -2.5, 2, -1.5, 2.5, 0],
                scale: 1,
              }
            : stage === "ignition"
              ? { x: [0, -2, 2, 0], y: 0, rotate: 0, scale: 1 }
              : {
                  x: 0,
                  y: isLeaving
                    ? -(1.5 * stageRect.height)
                    : hasClimbed
                      ? -(0.22 * stageRect.height)
                      : 0,
                  rotate: 0,
                  scale: isLeaving ? 0.55 : hasClimbed ? 0.8 : 1,
                }
        }
        transition={
          stage === "waiting"
            ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
            : stage === "ignition"
              ? { duration: 0.14, repeat: Infinity }
              : stage === "ascent"
                ? { ...flightEaseToken, duration: 1.6 }
                : isLeaving
                  ? { duration: DEPARTURE_S * 0.9, ease: [0.5, 0, 0.75, 0] }
                  : { duration: 0.3 }
        }
      >
        <RocketGlyph size={rocketSize} flame={isFlying} />
      </motion.div>

      {/* The prompt doubles as the launch control: while the rocket
                waits, it says so. Once flying, it is the usual way out. */}
      {!isLeaving && (
        <p className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[11px] font-medium tracking-[0.18em] text-app-text-subtle uppercase">
          {stage === "waiting" ? "Press any key to launch" : "Press any key to skip"}
        </p>
      )}
    </motion.div>,
    document.body,
  );
}
