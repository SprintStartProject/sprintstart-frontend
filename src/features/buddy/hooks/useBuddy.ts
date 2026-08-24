import { useCallback, useEffect, useRef, useState } from "react";
import { warmBuddyVisit } from "../../../services/buddyService";
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
 * The conversation is brought on screen the first time the dock opens, so an unopened dock
 * makes no request. Other surfaces can open the dock and seed a draft via the aiBuddyBus
 * (e.g. "Draft with AI" on the human-buddy card).
 *
 * The one thing that does not wait for the dock is opening the visit, and it is the exception
 * that makes the rest cheap. Writing the greeting is the slow part of meeting the buddy — a
 * remote model, measured between 2s and 13s and occasionally far worse — and the widget mounts
 * app-wide the moment a hire's session resolves, long before they click. Warming it there turns
 * the click into the replay path, which costs no model call at all.
 */
export function useBuddy() {
  const conversation = useBuddySession();
  const { ensureOpened, setDraft } = conversation;

  const [isOpen, setIsOpen] = useState(false);
  const warmedRef = useRef(false);

  // Gated on the dock being open for the same reason the conversation is: an unopened dock
  // makes no request. Chips are the answer to an empty composer, so they have to be ready by
  // the time one is on screen — hence the read is its own cheap endpoint, not something riding
  // on a greeting a model has to write first.
  const suggestions = useBuddySuggestions(isOpen);

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    // Guarded by a ref rather than by the effect's deps: <React.StrictMode> double-invokes
    // this in development, and two concurrent opens is the read-then-write race in miniature.
    // The backend is idempotent per visit, so a duplicate is harmless rather than wrong — this
    // just declines to send it.
    if (warmedRef.current) return;
    warmedRef.current = true;
    void warmBuddyVisit();
  }, []);

  useEffect(() => {
    if (isOpen) void ensureOpened();
  }, [isOpen, ensureOpened]);

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
    suggestions,
  };
}
