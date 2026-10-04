/**
 * The hire's own wording for a proposal that carries an editable message, held per action.
 *
 * Deliberately *not* inside the card that renders the field. The dock unmounts every time it is
 * closed, and the hand-off to `/buddy` mounts a second card for the same action — so a draft kept
 * as component state is thrown away by gestures that were never about the text. Held by the
 * session instead, the way the composer's own draft already is, the wording outlives whichever
 * surface happens to be on screen.
 */
export type ActionDrafts = Record<string, string>;

/**
 * How one draft is keyed: an action inside the message it was proposed in.
 *
 * Both halves are needed. A hire offer's id is local to its message (the backend assigns none), so
 * keying by id alone would let one message's wording surface in another's card.
 */
export function actionDraftKey(messageId: string, actionId: string): string {
  return `${messageId}:${actionId}`;
}
