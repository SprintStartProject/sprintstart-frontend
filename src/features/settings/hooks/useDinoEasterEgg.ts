import { useCallback, useEffect, useRef, useState } from "react";
import { useRepeatClicks } from "../../easter-eggs/hooks/useRepeatClicks";

const TOAST_DURATION_MS = 3000;
const TOGGLE_DEBOUNCE_MS = 2000;
const UNLOCK_THRESHOLD = 3;

/**
 * Which way the last triple-click flipped the dino game. Exposed as an
 * explicit discriminant so the popover picks its copy from state rather than
 * substring-matching a message — copy edits can then never silently break the
 * lock/unlock rendering.
 */
export type DinoToggleKind = "unlocked" | "locked";

type DinoEasterEgg = {
  /** Result of the most recent toggle while its notice is showing, or null when hidden. */
  kind: DinoToggleKind | null;
  /** Registers one cogwheel click; every third click toggles the unlock. */
  handleIconClick: () => void;
};

/**
 * Dino game easter-egg trigger: triple-clicking the settings cogwheel
 * toggles the hidden Space-to-play dinosaur game, persisted in
 * `localStorage` under `dinoUnlocked`.
 *
 * This hook only owns the *trigger* (click counting, persistence, toast).
 * Whoever plays the game subscribes through {@link useDinoUnlocked} /
 * {@link useSpaceOpensDino}, which react to the `dinoUnlockChanged`
 * window event dispatched here — so unlocking in Settings instantly arms
 * the chat, onboarding and buddy waiting-games without any direct wiring.
 *
 * The toggle is debounced (2s) so an accidental fourth+third click can't
 * silently re-lock the game, and the unlock write is wrapped in try/catch
 * because private-browsing modes can reject localStorage writes.
 */
export function useDinoEasterEgg(): DinoEasterEgg {
  const [kind, setKind] = useState<DinoToggleKind | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastToggleRef = useRef(0);

  // Clear any pending toast timer on unmount.
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showToast = useCallback((nextKind: DinoToggleKind) => {
    setKind(nextKind);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setKind(null);
    }, TOAST_DURATION_MS);
  }, []);

  const toggleUnlock = useCallback(() => {
    if (Date.now() - lastToggleRef.current < TOGGLE_DEBOUNCE_MS) return;
    lastToggleRef.current = Date.now();

    const currentlyUnlocked = localStorage.getItem("dinoUnlocked") === "true";
    const nextValue = currentlyUnlocked ? "false" : "true";
    try {
      localStorage.setItem("dinoUnlocked", nextValue);
    } catch (error) {
      console.warn("Failed to persist dino unlock state", error);
    }

    // Notify listeners (chat, onboarding, buddy) on a microtask so their
    // setState is deferred past the current render — a synchronous
    // dispatchEvent can land a listener's setState during a sibling's
    // render cycle (React 19: "Cannot update a component while rendering
    // a different component").
    queueMicrotask(() => window.dispatchEvent(new Event("dinoUnlockChanged")));

    showToast(currentlyUnlocked ? "locked" : "unlocked");
  }, [showToast]);

  const handleIconClick = useRepeatClicks(UNLOCK_THRESHOLD, toggleUnlock);

  return {
    kind,
    handleIconClick,
  };
}
