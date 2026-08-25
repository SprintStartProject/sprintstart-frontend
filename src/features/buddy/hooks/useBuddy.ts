import { useCallback, useEffect, useState } from "react";
import { onOpenAiBuddy } from "../aiBuddyBus";
import { useBuddySession } from "../buddySessionContext";
import { useBuddySuggestions } from "./useBuddySuggestions";

/**
 * Drives the floating buddy dock: the session's shared conversation plus the dock's own
 * open/closed state.
 *
 * The conversation is *not* created here. It belongs to [BuddyProvider], one instance for the
 * whole app, so the dock and the `/buddy` page are two views of one conversation rather than
 * two conversations — see the provider for what the split used to cost.
 *
 * The conversation is brought on screen at mount rather than on first open, so the click finds
 * it already there — see the effect below for why that read must never be a bare open. Other
 * surfaces can open the dock and seed a draft via the aiBuddyBus (e.g. "Draft with AI" on the
 * human-buddy card).
 */
export function useBuddy() {
  const conversation = useBuddySession();
  const { ensureOpened, setDraft } = conversation;

  const [isOpen, setIsOpen] = useState(false);

  // Gated on the dock being open for the same reason the conversation is: an unopened dock
  // makes no request. Chips are the answer to an empty composer, so they have to be ready by
  // the time one is on screen — hence the read is its own cheap endpoint, not something riding
  // on a greeting a model has to write first.
  const suggestions = useBuddySuggestions(isOpen);

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  // Distinct from `toggleOpen`, and the distinction matters: the page hand-off has to *close*
  // the dock at a point where it may or may not still be open, and a toggle there re-opens it.
  const closeDock = useCallback(() => {
    setIsOpen(false);
  }, []);

  // On mount, not on first open. Writing the greeting is the slow part of meeting the buddy —
  // a remote model, measured between 2s and 13s — and the widget mounts app-wide the moment a
  // hire's session resolves, long before they click. Doing it here means the click finds the
  // conversation already there.
  //
  // It is `ensureOpened`, never a bare open. A blind open used to run here, on the premise that
  // opening twice is idempotent — true only while the hire has said nothing. Once they have, a
  // visit has ended, so an open writes a *new* opening marker and `getMessagesForMe` returns
  // only from there: every reload silently threw the hire's scrollback away. Reading first
  // costs one cheap request and greets only a visit that really is empty.
  useEffect(() => {
    void ensureOpened();
  }, [ensureOpened]);

  useEffect(() => {
    /**
     * Lets other surfaces (e.g. the human buddy card) open the AI buddy and hand it
     * a draft to help the hire word their question.
     */
    return onOpenAiBuddy(({ draft: seed }) => {
      setIsOpen(true);
      if (seed) setDraft(seed);
    });
  }, [setDraft]);

  return {
    ...conversation,
    isOpen,
    toggleOpen,
    closeDock,
    suggestions,
  };
}
