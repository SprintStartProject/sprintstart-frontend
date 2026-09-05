import { useState } from "react";

/**
 * Closes a rail at the moment it stops being a column and becomes a drawer.
 *
 * Both rails already refuse to *restore* an overlay below `md`: a hire arriving on a phone
 * should not land behind their own conversation list. The window can cross that breakpoint after
 * load too, and nothing was watching — a rail opened as a column survived the narrowing and
 * turned into a panel over the conversation, backdrop and all, that nobody had asked for.
 *
 * Adjusted during render rather than in an effect, the pattern the rest of this feature uses:
 * the narrow layout is painted once, already closed, instead of showing the drawer for a frame
 * and then dismissing it. `close` therefore has to be a plain state update belonging to the same
 * component — no storage write, no navigation. Which is right anyway: this is the window
 * changing shape, not the hire saying they want less rail, and it should not be remembered.
 *
 * One way only. Widening again does not reopen anything — somebody who put the rail away meant
 * it, and the stored preference is what decides the next visit.
 *
 * @param isOverlay Whether the rail is currently a drawer over the conversation.
 * @param close Puts it away. Called only on the column → drawer crossing.
 */
export function useRailOverlayGuard(isOverlay: boolean, close: () => void): void {
  const [wasOverlay, setWasOverlay] = useState(isOverlay);

  if (wasOverlay !== isOverlay) {
    setWasOverlay(isOverlay);

    if (isOverlay) close();
  }
}
