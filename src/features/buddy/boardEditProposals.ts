import type { HireActionProposal } from "./types";
import {
  BUDDY_ACTION_DISMISS_CARDS,
  BUDDY_ACTION_EDIT_CHECKLIST,
  BUDDY_ACTION_EDIT_LINK,
  BUDDY_ACTION_EDIT_NOTE,
  BUDDY_ACTION_PLACE_LINK,
  BUDDY_ACTION_REORDER_CARDS,
} from "./types";

/**
 * Whether a board edit arrived without what the hire needs to see before agreeing to it.
 *
 * The same fail-closed rule stored team proposals follow: an offer that would change what the hire
 * already has is not confirmable if the card cannot show what it would change. A clean-up whose
 * card names did not survive the stream would otherwise be a button that removes cards nobody was
 * shown, and a checklist edit without its preview would hide which lines it deletes. An older
 * backend, a failed lookup or a truncated event all end up here rather than at a blind confirm.
 *
 * @returns false for every other action — this only knows the board edits.
 */
export function lacksBoardEditDetails(action: HireActionProposal): boolean {
  const ids = action.cardIds ?? [];
  switch (action.action) {
    case BUDDY_ACTION_DISMISS_CARDS:
    case BUDDY_ACTION_REORDER_CARDS:
      return !action.preview || ids.length === 0 || action.cardNames?.length !== ids.length;
    case BUDDY_ACTION_EDIT_CHECKLIST:
      return !action.preview || !action.cardId || !action.checklistItems?.length;
    case BUDDY_ACTION_EDIT_NOTE:
      return !action.cardId || !action.noteText;
    case BUDDY_ACTION_EDIT_LINK:
      return !action.cardId || !action.linkUrl;
    case BUDDY_ACTION_PLACE_LINK:
      return !action.linkUrl;
    default:
      return false;
  }
}
