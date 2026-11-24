import { useCallback } from "react";
import {
  createSession,
  getSessions,
  type BuddySessionSummary,
} from "../../../services/buddyService";
import { buddySessionIdFromPath } from "../buddyPagePath";
import { blankSession, chooseSession, mergeFetchedSessions } from "../conversation/sessionRules";
import type { useSessionStore } from "./useSessionStore";

type Store = ReturnType<typeof useSessionStore>;
type Parts = Pick<
  Store,
  | "applySessions"
  | "applyCurrentSession"
  | "sessionsNow"
  | "currentSessionNow"
  | "binnedNow"
  | "shareResolution"
>;

/**
 * Finding out which conversations the hire has, and which one they are in.
 *
 * Two reads of the same list with different jobs: `resolveHireSession` picks the conversation to
 * open (creating the first one when there is none), `refreshSessions` re-reads the list to pick
 * up titles and conversations started elsewhere.
 */
export function useSessionResolution(parts: Parts) {
  const { applySessions, applyCurrentSession, sessionsNow, currentSessionNow } = parts;
  const { binnedNow, shareResolution } = parts;

  /**
   * The conversation the hire was last in: their newest one, or a brand-new one when they have
   * none at all.
   *
   * Prefers the conversation this app session was already in when the list still holds it — a
   * team-mode round trip or a retry must not move the hire out of their conversation. Before
   * that, a conversation the address names (`/buddy/:id` — a reload, a shared link): resolving
   * the newest and then switching would read a conversation nobody asked for and flash it, and
   * the switch is refused while that first read is still running. Read from the window at
   * resolve time, because the dock resolves at app mount — before the lazily loaded page could
   * hand the address over.
   *
   * Memoised in flight, because the composer is live from the first paint: a send racing the
   * opening read must land on the same conversation, not create a second.
   */
  const resolveHireSession = useCallback(
    (): Promise<string> =>
      shareResolution(async () => {
        const list = await getSessions();

        if (list.length > 0) {
          const addressed = buddySessionIdFromPath(window.location.pathname);
          const chosen = chooseSession(list, addressed, currentSessionNow());
          applySessions(list);
          applyCurrentSession(chosen);
          return chosen;
        }

        const createdId = await createSession();
        applySessions([blankSession(createdId, new Date().toISOString())]);
        applyCurrentSession(createdId);
        return createdId;
      }),
    [applySessions, applyCurrentSession, shareResolution, currentSessionNow],
  );

  /**
   * Re-reads the conversation list.
   *
   * The backend names a conversation from its first message, and the list is otherwise read once
   * at open and edited locally from there — so without this, every conversation started in a
   * session read "New conversation" in the rail until a reload. Called when a first turn
   * completes on a row that is still untitled; the page also calls it once before giving up on
   * an address the list does not hold.
   *
   * @returns The list as applied, or `null` when the read failed.
   */
  const refreshSessions = useCallback(async (): Promise<BuddySessionSummary[] | null> => {
    try {
      const read = await getSessions();

      // A conversation binned while this read was in flight is still in it, so the tombstone wins
      // over the row; and one created while it was in flight is newer than that moment, so it
      // stays in front.
      const next = mergeFetchedSessions(read, binnedNow(), sessionsNow());
      applySessions(next);
      return next;
    } catch (e) {
      // Cosmetic only: the rail keeps the titles it has; the next completed turn tries again.
      console.error(e);
      return null;
    }
  }, [applySessions, binnedNow, sessionsNow]);

  return { resolveHireSession, refreshSessions };
}
