import { useEffect } from "react";
import { useReducedMotion } from "framer-motion";
import { clearEggEffect, useActiveEggEffect } from "../eggEffectBus";
import { MatrixRain } from "./MatrixRain";
import { ConfettiBurst } from "./ConfettiBurst";

/** How long the barrel roll spins before the page settles again (ms). */
const BARREL_ROLL_MS = 2000;

/**
 * The single app-level renderer for whole-window easter-egg effects.
 *
 * Mounted once (in App), it turns whatever {@link playEggEffect} fired —
 * from the AI chat, the buddy chat, anywhere — into the actual visuals:
 * the barrel-roll body class with a timed cleanup, and the MatrixRain
 * canvas overlay which cleans up after itself. Centralizing this is what
 * lets any chat trigger an effect without each surface owning DOM side
 * effects; two layers would double-apply the body class, so surfaces must
 * call the bus instead of rendering effects themselves.
 *
 * Effects that are pure motion are skipped for users who asked for less of
 * it: see the barrel-roll branch below, and the reduced-motion chip the
 * confetti falls back to.
 */
export function EggEffectsLayer() {
  const effect = useActiveEggEffect();
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (effect?.id !== "barrel-roll") return;
    // The spin of the whole app is the entire effect and has no honest still
    // frame, so somebody who prefers reduced motion gets nothing rather than
    // a rotation — the same call the sidebar logo's drop makes ("the counter
    // still consumes, nothing plays"). The state is cleared immediately so
    // the bus is not left holding an effect that is not being drawn.
    if (prefersReducedMotion) {
      clearEggEffect();
      return;
    }
    document.body.classList.add("barrel-roll-active");
    // `seq` is a dependency, not just the id: firing the roll again while it
    // is running must give it its full time again instead of letting the
    // first trigger's timer cut the second roll short. The class itself is
    // idempotent — cleanup drops it, the effect puts it straight back.
    const timeout = setTimeout(() => {
      if (document.body.classList.contains("barrel-roll-active")) {
        document.body.classList.remove("barrel-roll-active");
        clearEggEffect();
      }
    }, BARREL_ROLL_MS);
    return () => {
      clearTimeout(timeout);
      document.body.classList.remove("barrel-roll-active");
    };
  }, [effect?.id, effect?.seq, prefersReducedMotion]);

  if (!effect) return null;

  // Keyed by seq so re-triggering while running replays the burst.
  if (effect.id === "party") return <ConfettiBurst key={effect.seq} />;

  if (effect.id === "matrix") {
    // Same key contract: the rain ends itself on a timer from its own mount,
    // so without a remount a second "matrix" would just cut the first short.
    return <MatrixRain key={effect.seq} onClose={clearEggEffect} />;
  }

  // The barrel roll needs no DOM of its own — the body class is the effect.
  return null;
}
