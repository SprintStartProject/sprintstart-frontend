import { useCallback, useMemo } from "react";
import { ensureOpened, openSession, type OpenEnv } from "../conversation/openConversation";

/**
 * Bringing a conversation on screen: `openSession` for one the hire named, `ensureOpened` for
 * whichever one the app is on, once per app session.
 *
 * The decisions are in `conversation/openConversation`; this only hands them the live readers.
 */
export function useOpening(parts: OpenEnv) {
  const { latches, view, messagesNow, sessionsNow, currentSessionNow } = parts;
  const { teamProjectNow, resolveHireSession } = parts;

  const env = useMemo<OpenEnv>(
    () => ({
      latches,
      view,
      messagesNow,
      sessionsNow,
      currentSessionNow,
      teamProjectNow,
      resolveHireSession,
    }),
    [
      latches,
      view,
      messagesNow,
      sessionsNow,
      currentSessionNow,
      teamProjectNow,
      resolveHireSession,
    ],
  );

  const open = useCallback((sessionId: string) => openSession(env, sessionId), [env]);
  const ensure = useCallback(() => ensureOpened(env), [env]);

  return { openSession: open, ensureOpened: ensure };
}
