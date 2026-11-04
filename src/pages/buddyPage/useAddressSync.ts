import { useEffect, useRef, type MutableRefObject } from "react";
import { useNavigate, useParams, type NavigateFunction } from "react-router-dom";
import type { BuddySession } from "./buddyPageTypes";
import { decideAddress, type AddressAction } from "./decideAddress";

type AddressRefs = {
  /** The latest of both ids, for continuations that settle after the render that started them. */
  latestUrlSessionId: MutableRefObject<string | undefined>;
  latestSessionId: MutableRefObject<string | null>;
  /** The unknown address a list re-read is already answering, so a refreshed list does not start a second. */
  refreshedFor: MutableRefObject<string | null>;
};

type AddressEnv = {
  navigate: NavigateFunction;
  refs: AddressRefs;
  selectSession: BuddySession["selectSession"];
  refreshSessions: BuddySession["refreshSessions"];
};

function addressScreen({ navigate, refs }: AddressEnv): void {
  const onScreen = refs.latestSessionId.current;
  void navigate(onScreen ? `/buddy/${onScreen}` : "/buddy", { replace: true });
}

function refreshThenGiveUp(env: AddressEnv, target: string): void {
  env.refs.refreshedFor.current = target;
  void env.refreshSessions().then((list) => {
    if (env.refs.latestUrlSessionId.current !== target) return;
    if (list?.some((session) => session.id === target)) return;
    void env.navigate("/buddy", { replace: true });
  });
}

function selectOrRevert(env: AddressEnv, target: string): void {
  // The session's own guards are read synchronously and can still refuse in the same frame a turn
  // starts — the answer says so, and the address goes back the same way.
  void env.selectSession(target).then((switched) => {
    if (!switched && env.refs.latestUrlSessionId.current === target) addressScreen(env);
  });
}

function runAddressAction(env: AddressEnv, action: AddressAction): void {
  switch (action.kind) {
    case "refresh":
      refreshThenGiveUp(env, action.target);
      return;
    case "revert":
      addressScreen(env);
      return;
    case "select":
      selectOrRevert(env, action.target);
      return;
    case "follow":
      void env.navigate(`/buddy/${action.sessionId}`, { replace: true });
      return;
    case "none":
      return;
  }
}

/**
 * Keeps the address and the conversation on screen in step. One reconciler for both directions,
 * because two would fight: a rail pick moves the conversation while the URL still names where it
 * was, and a "honour the URL" pass reading that stale name would drag the hire straight back.
 *
 * An address that cannot be followed *now* is never left to be followed later. A switch clears the
 * thread, the composer and the queue, so one that waited out a decision and then fired on its own
 * threw away whatever the hire had typed in the meantime. So while a decision is running, or in
 * team mode, the address goes back to the conversation on screen. A running answer does not hold it
 * back: the switch cuts that answer short, as a rail pick does. Only the first open is waited for.
 * The decision itself is `decideAddress`.
 */
export function useAddressSync(session: BuddySession): void {
  const { sessions, currentSessionId, selectSession, refreshSessions } = session;
  const navigate = useNavigate();
  const { id: urlSessionId } = useParams<{ id: string }>();
  const previousSessionIdRef = useRef<string | null>(currentSessionId);
  const latestUrlSessionId = useRef(urlSessionId);
  const latestSessionId = useRef(currentSessionId);
  const refreshedFor = useRef<string | null>(null);
  useEffect(() => {
    latestUrlSessionId.current = urlSessionId;
    latestSessionId.current = currentSessionId;
  });
  const isSettling = session.isOpening || session.isGreeting;
  const cannotSwitch = session.isDeciding || session.teamProjectId !== null;

  useEffect(() => {
    const previousSessionId = previousSessionIdRef.current;
    previousSessionIdRef.current = currentSessionId;
    // A re-read answers the address it was started for; once the address has moved on, the next
    // unknown one (or the same one, visited again) deserves its own.
    if (refreshedFor.current !== null && refreshedFor.current !== urlSessionId) {
      refreshedFor.current = null;
    }

    const action = decideAddress({
      urlSessionId,
      previousSessionId,
      currentSessionId,
      knownSessionIds: sessions.map((entry) => entry.id),
      refreshedFor: refreshedFor.current,
      isSettling,
      cannotSwitch,
    });
    const refs = { latestUrlSessionId, latestSessionId, refreshedFor };
    runAddressAction({ navigate, refs, selectSession, refreshSessions }, action);
  }, [
    urlSessionId,
    sessions,
    currentSessionId,
    isSettling,
    cannotSwitch,
    selectSession,
    refreshSessions,
    navigate,
  ]);
}
