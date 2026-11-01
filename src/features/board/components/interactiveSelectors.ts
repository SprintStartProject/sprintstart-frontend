/** Pressing inside one of these is acting on the board, not looking away from an open pile. */
export const KEEPS_PILES_OPEN =
  "[role='toolbar'], [role='dialog'], [role='menu'], [role='listbox'], [role='status'], [role='alert'], [data-keeps-piles-open]";

/**
 * Everything on a card that already does something when it is clicked.
 *
 * The top card of a closed stack opens the pile — but these cards are full of controls, and a card
 * that both ticks a checkbox and unfolds a stack gets one of the two wrong. So the card handles a
 * click only when it landed on nothing in particular: on the title, the body text, the padding.
 * Ticking an item, following a link or pressing a control does what it says, and never also opens
 * the pile.
 */
export const INTERACTIVE_WITHIN_CARD =
  "a, button, input, select, textarea, label, [role='button'], [role='checkbox'], [role='link']";
