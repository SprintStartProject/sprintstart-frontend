import { useCallback, useEffect, useState } from "react";

/**
 * The waiting game the conversation hosts. Handed in rather than imported, so the one place that
 * knows about the easter-egg feature stays the conversation hook itself.
 */
export type DinoGame = {
  unlocked: boolean;
  useGame: (
    armed: boolean,
    isUnlocked: boolean,
    options: { keepActiveUntilExit: boolean },
  ) => [gameActive: boolean, close: () => void, open: () => void];
};

/**
 * The dino waiting game, as the conversation offers it: an unlocked user may press Space while the
 * buddy thinks, as in the AI chat. The game closes on exit, at the end of the turn, or when the
 * unlock flag flips off.
 */
export function useDinoSurface(isThinking: boolean, { unlocked, useGame }: DinoGame) {
  // How many surfaces show this thread (the open dock, the mounted `/buddy` page). The game only
  // arms while one is visible, so it can never run, or hold the shared slot, inside a minimised
  // dock.
  const [surfaceCount, setSurfaceCount] = useState(0);
  const surfaceVisible = surfaceCount > 0;
  const [dinoGameActive, closeDinoGame] = useGame(isThinking && surfaceVisible, unlocked, {
    // The game outlives the turn it was armed for and stays open until the player leaves it; the
    // reply only flips its completion badge.
    keepActiveUntilExit: true,
  });

  // The last visible surface went away (dock minimised, page left): the game it hosted is gone
  // from screen, so it must not keep running — or keep the shared slot — behind it.
  useEffect(() => {
    if (!surfaceVisible) closeDinoGame();
  }, [surfaceVisible, closeDinoGame]);

  /**
   * Declares that a surface showing this thread is on screen. Returns the matching release;
   * meant to be called from an effect; the returned release is the effect's cleanup (see
   * `BuddyWidget` / `BuddyPage`).
   */
  const registerDinoSurface = useCallback(() => {
    setSurfaceCount((count) => count + 1);
    return () => setSurfaceCount((count) => count - 1);
  }, []);

  return { dinoGameActive, closeDinoGame, registerDinoSurface };
}
