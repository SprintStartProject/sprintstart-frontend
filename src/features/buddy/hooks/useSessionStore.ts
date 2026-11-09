import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { BuddySessionSummary } from "../../../services/buddyService";
import { queryKeys } from "../../../services/queryKeys";

/**
 * The conversations this hire owns, newest first, and which one is on screen.
 *
 * Read once at the first open, then kept in step by the moves across it. The refs shadow the state
 * for the same reason every other ref in the conversation does: a decision made mid-flight reads
 * the current value without every token re-creating its callbacks.
 */
export function useSessionStore() {
  const [sessions, setSessions] = useState<BuddySessionSummary[]>([]);
  const sessionsRef = useRef<BuddySessionSummary[]>([]);
  /**
   * The conversations this app session has binned, by id.
   *
   * A list read that started before a bin still carries the binned row — the read is a moment,
   * and `refreshSessions` merges what it returns — so the ids are remembered and filtered out
   * of every later read. The backend never returns a binned conversation again, so the set only
   * ever grows within one app session, and never needs clearing.
   */
  const binnedRef = useRef<Set<string>>(new Set());
  /** Which conversation is on screen. `null` only before the first open has resolved one. */
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const currentRef = useRef<string | null>(null);
  /**
   * One resolution per app session, shared by every caller that can start one.
   *
   * The composer is live from the first paint, so a send can beat the opening read; without
   * this, two lookups racing an empty list would create two first conversations.
   */
  const resolvingRef = useRef<Promise<string> | null>(null);

  // The dashboard's "Recent conversations" card reads the same list from the query cache, so every
  // change here is written through to it.
  const queryClient = useQueryClient();
  const applySessions = useCallback(
    (next: BuddySessionSummary[]) => {
      sessionsRef.current = next;
      setSessions(next);
      queryClient.setQueryData(queryKeys.buddy.sessions(), next);
    },
    [queryClient],
  );

  const applyCurrentSession = useCallback((sessionId: string | null) => {
    currentRef.current = sessionId;
    setCurrentSessionId(sessionId);
  }, []);

  const sessionsNow = useCallback(() => sessionsRef.current, []);
  const currentSessionNow = useCallback(() => currentRef.current, []);
  const isBinned = useCallback((sessionId: string) => binnedRef.current.has(sessionId), []);
  const binnedNow = useCallback((): ReadonlySet<string> => binnedRef.current, []);
  const markBinned = useCallback((sessionId: string) => {
    binnedRef.current.add(sessionId);
  }, []);

  /** Runs `resolve` unless a resolution is already in flight, in which case everyone shares it. */
  const shareResolution = useCallback(async (resolve: () => Promise<string>): Promise<string> => {
    if (resolvingRef.current) return resolvingRef.current;

    const pending = resolve();
    resolvingRef.current = pending;

    try {
      return await pending;
    } finally {
      resolvingRef.current = null;
    }
  }, []);

  return {
    sessions,
    currentSessionId,
    applySessions,
    applyCurrentSession,
    sessionsNow,
    currentSessionNow,
    isBinned,
    binnedNow,
    markBinned,
    shareResolution,
  };
}
