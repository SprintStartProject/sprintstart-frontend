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

export type SpaceOpensDinoOptions = {
  /**
   * When true, if `armed` transitions from true to false while a game is actively
   * being played, the game remains active until the player exits (via Esc, exit button,
   * or game over). New games cannot be opened while `armed` is false.
   */
  keepActiveUntilExit?: boolean;
};

/**
 * The Space-to-play trigger shared by every dino waiting-game host
 * (AI chat, onboarding generation, buddy chat): while `armed` is true and
 * the game is not already open, pressing Space opens it — unless the user
 * is typing in a field, in which case Space stays a space.
 *
 * Returns whether the game should be shown, plus a way to close it early.
 * The game belongs to the wait it was opened under, so it closes by itself
 * the moment `armed` flips off — unless `keepActiveUntilExit` is set, in which
 * case an ongoing run is allowed to finish.
 */
export function useSpaceOpensDino(
  armed: boolean,
  isUnlocked: boolean,
  options?: SpaceOpensDinoOptions,
): [boolean, () => void] {
  const keepActiveUntilExit = options?.keepActiveUntilExit ?? false;
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

  // The other half of "this game belongs to this wait": when the wait ends,
  // the game is over. Closing here is not a nicety — the game's DOM belongs
  // to the host's waiting state, so it disappears on its own when the answer
  // arrives, and without this the shared slot would stay claimed by a game
  // nobody can see (the onboarding generation step has no close of its own,
  // which is how a finished generation used to eat the trigger for the rest
  // of the visit). Same render-phase pattern as the lock above.
  // When `keepActiveUntilExit` is true, an active run is preserved until the
  // user exits or finishes their run.
  const [prevArmed, setPrevArmed] = useState(armed);
  if (prevArmed !== armed) {
    setPrevArmed(armed);
    if (!armed && (!keepActiveUntilExit || !gameActive)) {
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
