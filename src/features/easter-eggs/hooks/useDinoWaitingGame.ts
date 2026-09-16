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
 * Which host currently has the one waiting-game open, if any.
 *
 * The AI chat, the onboarding generation step and the buddy conversation
 * are each armed while their own turn runs and each listen on the window,
 * so without a shared slot a single Space press with two surfaces busy
 * opened two games at once. The first host to claim it plays; the others
 * stay shut. A module-level variable rather than context because the hosts
 * are a page, a floating dock and a wizard step, with no common component
 * above them to own the state.
 */
let gameHost: symbol | null = null;

/** Frees the shared slot, but only for the host that still holds it. */
function releaseGameSlot(host: symbol): void {
  if (gameHost === host) gameHost = null;
}

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

  // Stable per-instance identity for the shared slot. Initial state rather
  // than a ref so it exists on the first render without reading a ref during
  // it (`react-hooks/refs` forbids that, and rightly: a handler registered in
  // the first effect would capture a ref that is still null).
  const [host] = useState(() => Symbol("dino-waiting-game"));

  useEffect(() => {
    if (!armed || !isUnlocked || gameActive) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      if (isTypingTarget(document.activeElement)) return;
      if (gameHost !== null) return;
      e.preventDefault();
      gameHost = host;
      setGameActive(true);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [armed, isUnlocked, gameActive, host]);

  // A host that goes away mid-game (navigating off the page) must not take
  // the slot with it, or every other surface loses the trigger for good.
  useEffect(() => () => releaseGameSlot(host), [host]);

  // Locking mid-game (triple-click toggle elsewhere, another tab) closes
  // it. Uses React's documented "adjust state when a value changes"
  // pattern instead of an effect, mirroring ChatPage — see
  // https://react.dev/learn/you-might-not-need-an-effect
  const [prevUnlocked, setPrevUnlocked] = useState(isUnlocked);
  if (prevUnlocked !== isUnlocked) {
    setPrevUnlocked(isUnlocked);
    if (!isUnlocked) {
      releaseGameSlot(host);
      setGameActive(false);
    }
  }

  const close = useCallback(() => {
    releaseGameSlot(host);
    setGameActive(false);
  }, [host]);
  return [gameActive, close];
}
