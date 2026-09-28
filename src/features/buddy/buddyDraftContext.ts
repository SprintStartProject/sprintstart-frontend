import { createContext, useContext } from "react";
import type { Dispatch, FormEvent, SetStateAction } from "react";

/**
 * Everything the composer is: the words in it, the way they are filled in, and the one way they
 * leave it.
 *
 * Split out of the buddy session because the two age at completely different rates. The session
 * changes when the conversation does — a message, a turn, a switch — while this changes on every
 * keystroke. While they shared one context value, every keypress handed every consumer of the
 * conversation a new value, so the whole thread re-parsed itself per character typed. See
 * [BuddyDraftProvider](./BuddyDraftProvider.tsx) for the shape that fixes it.
 */
export type BuddyDraft = {
  /** The words currently in the box — one composer, shared by the dock and the page. */
  draft: string;
  setDraft: Dispatch<SetStateAction<string>>;
  /**
   * Submits the composer. Returns whether a turn was actually started — `false` when the
   * submission was swallowed (an easter-egg phrase, an empty draft), which is what keeps the
   * caret in the box instead of handing it off on a send that never happened.
   */
  handleSubmit: (event: FormEvent) => boolean;
};

/**
 * The write-only half of the composer: what a surface needs in order to *fill* the box, without
 * the box's value.
 *
 * Its value never changes, so a reader can hold the setter for the session's lifetime and never
 * re-render for a keystroke — which is exactly what the surfaces that seed a draft (the
 * suggestion chips, the dock's hand-off to `/buddy`) have to do. Reading [BuddyDraft] for the
 * setter instead would put them back on the per-keystroke path this split exists to leave.
 */
export type BuddyDraftActions = { setDraft: Dispatch<SetStateAction<string>> };

export const BuddyDraftContext = createContext<BuddyDraft | null>(null);

export const BuddyDraftActionsContext = createContext<BuddyDraftActions | null>(null);

/**
 * The composer this session has — the value *and* the way to fill it.
 *
 * Deliberately no fallback, like `useBuddySession`: a hook that quietly made its own draft would
 * put the dock and the page back on two composers that merely share a name.
 */
export function useBuddyDraft(): BuddyDraft {
  const draft = useContext(BuddyDraftContext);

  if (!draft) {
    throw new Error("useBuddyDraft must be used inside a BuddyDraftProvider");
  }

  return draft;
}

/**
 * The setter without the value — see [BuddyDraftActions] for why the two are apart.
 *
 * This is the one to reach for whenever a surface only *writes* to the composer: nothing it
 * reads here ever changes, so the surface keeps its sub over a keystroke-free value.
 */
export function useBuddyDraftActions(): BuddyDraftActions {
  const actions = useContext(BuddyDraftActionsContext);

  if (!actions) {
    throw new Error("useBuddyDraftActions must be used inside a BuddyDraftProvider");
  }

  return actions;
}
