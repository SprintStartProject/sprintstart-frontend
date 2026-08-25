import { useCallback, useEffect, useState } from "react";

/**
 * Reads the persisted dino unlock flag (`localStorage["dinoUnlocked"]`)
 * and keeps it live: reacts to the `dinoUnlockChanged` window event that
 * `useDinoEasterEgg` dispatches after a triple-click toggle, and to the
 * browser's cross-tab `storage` event.
 */
export function useDinoUnlocked(): boolean {
  const [isUnlocked, setIsUnlocked] = useState(
    () => localStorage.getItem("dinoUnlocked") === "true",
  );

  useEffect(() => {
    const sync = () => setIsUnlocked(localStorage.getItem("dinoUnlocked") === "true");
    window.addEventListener("dinoUnlockChanged", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("dinoUnlockChanged", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return isUnlocked;
}

const isTypingTarget = (el: Element | null) =>
  el instanceof HTMLElement &&
  (el.tagName === "TEXTAREA" || el.tagName === "INPUT" || el.isContentEditable);

/**
 * The Space-to-play trigger shared by every dino waiting-game host
 * (AI chat, onboarding generation, buddy chat): while `armed` is true and
 * the game is not already open, pressing Space opens it — unless the user
 * is typing in a field, in which case Space stays a space.
 *
 * Returns whether the game should be shown; hosts close it themselves
 * when their wait ends (or when the unlock flag flips off).
 */
export function useSpaceOpensDino(armed: boolean, isUnlocked: boolean): [boolean, () => void] {
  const [gameActive, setGameActive] = useState(false);

  useEffect(() => {
    if (!armed || !isUnlocked || gameActive) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      if (isTypingTarget(document.activeElement)) return;
      e.preventDefault();
      setGameActive(true);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [armed, isUnlocked, gameActive]);

  // Locking mid-game (triple-click toggle elsewhere, another tab) closes
  // it. Uses React's documented "adjust state when a value changes"
  // pattern instead of an effect, mirroring ChatPage — see
  // https://react.dev/learn/you-might-not-need-an-effect
  const [prevUnlocked, setPrevUnlocked] = useState(isUnlocked);
  if (prevUnlocked !== isUnlocked) {
    setPrevUnlocked(isUnlocked);
    if (!isUnlocked) {
      setGameActive(false);
    }
  }

  const close = useCallback(() => setGameActive(false), []);
  return [gameActive, close];
}
