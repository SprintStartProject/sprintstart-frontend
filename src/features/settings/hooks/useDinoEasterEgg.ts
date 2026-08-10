import { useCallback, useEffect, useRef, useState } from "react";

const TOAST_DURATION_MS = 3000;
const TOGGLE_DEBOUNCE_MS = 2000;
const UNLOCK_THRESHOLD = 3;

type DinoEasterEgg = {
  isUnlocked: boolean;
  gameActive: boolean;
  toast: string | null;
  handleIconClick: () => void;
  setGameActive: (active: boolean) => void;
};

/**
 * Dino game easter-egg: triple-clicking the settings cogwheel toggles a
 * hidden Space-to-play dinosaur game. The unlock state is persisted in
 * `localStorage` under `dinoUnlocked` and broadcast via a custom
 * `dinoUnlockChanged` window event so multiple components stay in sync.
 *
 * Extracted from `SettingsPage` so the page itself only orchestrates
 * settings sections. The click-counter state lives in a ref (not in a state
 * updater) so the side effects (localStorage write, event dispatch, toast)
 * run exactly once even when React double-invokes updaters in StrictMode dev.
 */
export function useDinoEasterEgg(): DinoEasterEgg {
  const [isUnlocked, setIsUnlocked] = useState(
    () => localStorage.getItem("dinoUnlocked") === "true",
  );
  const [gameActive, setGameActive] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const clickCountRef = useRef(0);
  const lastToggleRef = useRef(0);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, TOAST_DURATION_MS);
  }, []);

  const handleIconClick = useCallback(() => {
    const next = clickCountRef.current + 1;
    if (next < UNLOCK_THRESHOLD) {
      clickCountRef.current = next;
      return;
    }

    clickCountRef.current = 0;
    if (Date.now() - lastToggleRef.current < TOGGLE_DEBOUNCE_MS) return;
    lastToggleRef.current = Date.now();

    const currentlyUnlocked = localStorage.getItem("dinoUnlocked") === "true";
    const nextValue = currentlyUnlocked ? "false" : "true";
    try {
      localStorage.setItem("dinoUnlocked", nextValue);
    } catch (error) {
      console.warn("Failed to persist dino unlock state", error);
    }

    // Update our own state directly (batched with the click handler) rather
    // than round-tripping through a synchronous `dispatchEvent`, which can
    // land the listener's setState during a sibling's render cycle (React
    // 19: "Cannot update a component while rendering a different
    // component"). Notify external listeners (SideBar, DinoGame) on a
    // microtask so their setState is deferred past the current render.
    const nextUnlocked = nextValue === "true";
    setIsUnlocked(nextUnlocked);
    if (!nextUnlocked) setGameActive(false);
    queueMicrotask(() => window.dispatchEvent(new Event("dinoUnlockChanged")));

    showToast(currentlyUnlocked ? "you saw nothing... 🫣" : "shh... 🤫 (press Space)");
  }, [showToast]);

  // Keep isUnlocked in sync with localStorage (other tabs, or our own event).
  useEffect(() => {
    const sync = () => {
      const unlocked = localStorage.getItem("dinoUnlocked") === "true";
      setIsUnlocked(unlocked);
      if (!unlocked) setGameActive(false);
    };
    window.addEventListener("dinoUnlockChanged", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("dinoUnlockChanged", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // Space-to-play, but only when unlocked, no game running, and not typing.
  useEffect(() => {
    if (!isUnlocked || gameActive) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const active = document.activeElement;
      const typing =
        active instanceof HTMLElement &&
        (active.tagName === "TEXTAREA" || active.tagName === "INPUT" || active.isContentEditable);
      if (typing) return;

      e.preventDefault();
      setGameActive(true);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isUnlocked, gameActive]);

  // Clear any pending toast timer on unmount.
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  return {
    isUnlocked,
    gameActive,
    toast,
    handleIconClick,
    setGameActive,
  };
}
