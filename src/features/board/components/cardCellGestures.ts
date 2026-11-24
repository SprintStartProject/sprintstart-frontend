import type { MouseEvent as ReactMouseEvent } from "react";
import type { CardStack } from "../layout/cardStacks";
import { INTERACTIVE_WITHIN_CARD } from "./interactiveSelectors";

/**
 * Opens the pile when the card itself is clicked.
 *
 * The chip in the header is still the real control — it is what a keyboard reaches, what a screen
 * reader announces, and what carries `aria-expanded`. This is the pointer shortcut beside it:
 * the card *looks* like a pile, so clicking the pile should open it, and hunting for a chip to do
 * something the whole card is depicting is the kind of small friction nobody reports and
 * everybody feels.
 *
 * Three things it stays out of the way of: anything that already does something when clicked
 * (see {@link INTERACTIVE_WITHIN_CARD}), the click that ends a drag while the board is being
 * arranged, and the click that ends a text selection — releasing after selecting a line is not a
 * request to rearrange the page under it.
 */
export function stackClickHandler(
  stack: CardStack | undefined,
  isArranging: boolean,
  onToggleStack: ((rootId: string) => void) | undefined,
) {
  return (event: ReactMouseEvent<HTMLElement>) => {
    if (!stack || isArranging || !onToggleStack) return;
    // The second click of a double click, which would otherwise open the pile and shut it again.
    if (event.detail > 1) return;
    if ((event.target as HTMLElement).closest(INTERACTIVE_WITHIN_CARD)) return;
    if ((window.getSelection()?.toString().length ?? 0) > 0) return;

    onToggleStack(stack.rootId);
  };
}

/**
 * Folds a card, or opens a folded one, on a double click anywhere on it.
 *
 * The fold button is a four-pixel target that only appears on hover, at the far end of a cluster
 * of four — which is fine as the deliberate control and hopeless as the one you reach for while
 * skim-reading a board. A double click is the gesture people already try on anything folded, and
 * it costs nothing to answer: a single click on a card still does what it did.
 *
 * Same three exclusions as the pile below, and one more — a card standing in for a closed stack
 * is already answering clicks by opening the pile, and a card that both unfolds itself and opens
 * a sequence gets one of the two wrong.
 *
 * The selection a double click leaves behind is cleared: the gesture was aimed at the card, and
 * a highlighted word left over from it reads as the card having been mis-clicked.
 *
 * Unless the double click landed on *words*. Double-clicking a word is how everybody selects one,
 * and since a card's text can be highlighted, it is now the shortest way to mark a single word —
 * so the same gesture meant both "select this word" and "fold this card", and did the second
 * while throwing away the first. Text was always selectable here; nobody had a reason to select
 * it before, which is why this only became wrong once there was something to do with a selection.
 */
export function doubleClickHandler(
  cardId: string,
  stack: CardStack | undefined,
  isArranging: boolean,
  onToggleCollapsed: ((cardId: string) => void) | undefined,
) {
  return (event: ReactMouseEvent<HTMLElement>) => {
    if (isArranging || stack || !onToggleCollapsed) return;
    if ((event.target as HTMLElement).closest(INTERACTIVE_WITHIN_CARD)) return;

    // Read after the browser has made its selection, which it does before the second click's
    // handlers run — so this is the word the hire just picked, not one left over from earlier.
    if (window.getSelection()?.isCollapsed === false) return;

    window.getSelection()?.removeAllRanges();
    onToggleCollapsed(cardId);
  };
}
