import {
  BUDDY_ACTION_AMEND_CHECKLIST,
  BUDDY_ACTION_CLAIM_GOAL,
  BUDDY_ACTION_DISMISS_CARDS,
  BUDDY_ACTION_EDIT_CHECKLIST,
  BUDDY_ACTION_EDIT_LINK,
  BUDDY_ACTION_EDIT_NOTE,
  BUDDY_ACTION_PLACE_CHECKLIST,
  BUDDY_ACTION_PLACE_LINK,
  BUDDY_ACTION_PLACE_NOTE,
  BUDDY_ACTION_REORDER_CARDS,
  BUDDY_ACTION_REWORD_CHECKLIST,
  BUDDY_ACTION_TICK_CHECKLIST,
} from "../types";

/**
 * The hire-confirmed buddy actions that write to the board, by their wire names: the five
 * `BuddyBoardWriteActions` handles (placing, amending, ticking and rewording a checklist, and
 * the note), the six board edits (a link, editing a note, link or checklist, clearing cards off
 * and rearranging them), plus `claim_goal`, which pins the claimed task as the board's CURRENT_TASK card —
 * its own outcome line says so ("It's on your board too"). Every other confirm changes something
 * else — a task claim, an attestation request, a flag, a username — and needs no board sync.
 */
const BOARD_ACTIONS = new Set<string>([
  BUDDY_ACTION_PLACE_CHECKLIST,
  BUDDY_ACTION_AMEND_CHECKLIST,
  BUDDY_ACTION_TICK_CHECKLIST,
  BUDDY_ACTION_REWORD_CHECKLIST,
  BUDDY_ACTION_PLACE_NOTE,
  BUDDY_ACTION_CLAIM_GOAL,
  BUDDY_ACTION_PLACE_LINK,
  BUDDY_ACTION_EDIT_NOTE,
  BUDDY_ACTION_EDIT_LINK,
  BUDDY_ACTION_EDIT_CHECKLIST,
  BUDDY_ACTION_DISMISS_CARDS,
  BUDDY_ACTION_REORDER_CARDS,
]);

/**
 * The mid-answer tool that puts a card on the board. `place_card` is deliberately not a confirmed
 * action — it applies the moment the mentor runs it — so a turn that ran it is the only signal
 * the client ever gets that the board moved. Acted on by `sendMessage` when the turn ends.
 */
const BOARD_TOOLS = new Set<string>(["place_card"]);

/** Whether a confirmed action changes cards on the board, so the board has to be read again. */
export function changesBoard(action: string): boolean {
  return BOARD_ACTIONS.has(action);
}

/** Whether a tool the buddy used places cards on the board while it runs. */
export function placesOnBoard(tool: string): boolean {
  return BOARD_TOOLS.has(tool);
}
