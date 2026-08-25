import { useEffect } from "react";
import { clearEggEffect, useActiveEggEffect } from "../eggEffectBus";
import { MatrixRain } from "./MatrixRain";

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
 */
export function EggEffectsLayer() {
  const effect = useActiveEggEffect();

  useEffect(() => {
    if (effect?.id !== "barrel-roll") return;
    document.body.classList.add("barrel-roll-active");
    // `seq` in the closure is fine: the class is idempotent, and clearing
    // on unmount covers the re-fire-while-running case.
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
  }, [effect?.id]);

  if (!effect) return null;

  if (effect.id === "matrix") {
    return <MatrixRain onClose={clearEggEffect} />;
  }

  // The barrel roll needs no DOM of its own — the body class is the effect.
  return null;
}
