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
  const { ensureOpened, setDraft, teamProjectId } = conversation;

  const [isOpen, setIsOpen] = useState(false);

  // Gated on the dock being open for the same reason the conversation is: an unopened dock
  // makes no request. Chips are the answer to an empty composer, so they have to be ready by
  // the time one is on screen — hence the read is its own cheap endpoint, not something riding
  // on a greeting a model has to write first.
  // Hire-only, too: the suggestions describe the *hire's* next useful question, and the backend
  // has no team-scoped list, so a team-mode conversation simply asks for none.
  const isTeamMode = teamProjectId !== null;
  const suggestions = useBuddySuggestions(isOpen && !isTeamMode);

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
      if (seed) setDraft((current) => withSeed(current, seed));
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

/**
 * What the composer holds once `seed` has been handed to it.
 *
 * Never at the cost of what the hire already typed. The draft outlives the dock — close it
 * mid-sentence and the words are still there next time — and the page behind an open dock stays
 * interactive, so a seed can arrive on top of a half-written question from either direction.
 * Replacing it would throw away the one thing on screen nobody else can bring back.
 *
 * So an empty composer takes the seed as it is, and a composer with words in it keeps them and
 * gets the seed underneath, after a blank line. Pressing the same button twice does not stack the
 * same text twice: a draft that already ends with the seed is left alone.
 */
export function withSeed(current: string, seed: string): string {
  if (current.trim().length === 0) return seed;
  if (current.trimEnd().endsWith(seed.trimEnd())) return current;

  return `${current.trimEnd()}\n\n${seed}`;
}
