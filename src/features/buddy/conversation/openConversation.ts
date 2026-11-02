import type { Dispatch, SetStateAction } from "react";
import { getMessages } from "../../../services/buddyService";
import type { BuddyMessage, BuddyMessageView } from "../types";
import { streamGreeting, type GreetTarget, type GreetView } from "./greet";
import { withHistory } from "./messageReducers";
import type { OpeningLatches } from "./openingLatches";
import { HISTORY_FAILED } from "./replyMessages";
import type { BuddySessionSummary } from "../../../services/buddyService";

/** What opening a conversation reads and writes. */
export type OpenEnv = {
  latches: OpeningLatches;
  view: GreetView & { setOpenError: Dispatch<SetStateAction<string | null>> };
  /** The thread as of now, not as of the last render: the composer is live while a read is in flight. */
  messagesNow: () => BuddyMessageView[];
  sessionsNow: () => BuddySessionSummary[];
  currentSessionNow: () => string | null;
  teamProjectNow: () => string | null;
  resolveHireSession: () => Promise<string>;
};

/**
 * Merges a read window in front of whatever is already there, never assigned over it.
 *
 * The fetch is in flight while the composer is live, so a hire who types straight away has an
 * optimistic turn in the list by the time this resolves — assigning would delete their own
 * message out from under them. History is older, so it belongs in front.
 */
function mergeHistory(env: OpenEnv, history: BuddyMessage[]): void {
  env.view.setMessages((prev) => withHistory(prev, history));
}

/**
 * Greets a conversation nobody has spoken in. Never-spoken is read as of now: a turn the composer
 * sent while the history read was in flight is the hire having spoken, and a greeting over it
 * would answer their question with a hello.
 */
async function greetIfSilent(env: OpenEnv, eligible: boolean, target: GreetTarget): Promise<void> {
  if (!eligible || env.messagesNow().some((message) => message.role === "USER")) return;
  env.latches.setBusy(true);
  try {
    await streamGreeting(env.view, target);
  } finally {
    env.latches.setBusy(false);
  }
}

/**
 * Brings one conversation on screen: reads it, merges its window in front of anything the
 * composer has already put up, and greets only the hire's first, never-spoken conversation.
 *
 * A conversation with anything in it is read, not re-greeted — the greeting belongs to the
 * conversation, not to every reopening of it — and a conversation the hire created on purpose
 * starts empty, the composer theirs.
 *
 * Throws when the read fails; the callers decide what that means (the mount warm-up releases its
 * latch so "Try again" can retry, a pick from the list reports it in place).
 */
export async function openSession(env: OpenEnv, sessionId: string): Promise<void> {
  env.view.setIsOpening(true);
  env.view.setOpenError(null);

  try {
    const history = await getMessages(sessionId);

    // A read for a conversation that has left the screen is not this thread's to show. Every
    // switch refuses while an open runs, so this guards the invariant for the next caller.
    if (env.currentSessionNow() !== sessionId) return;

    mergeHistory(env, history);
    await greetIfSilent(env, history.length === 0 && env.sessionsNow().length === 1, {
      sessionId,
    });
  } finally {
    env.view.setIsOpening(false);
  }
}

/** Team mode names its project instead of a session: one conversation per project, greeted only while empty. */
async function openTeamConversation(env: OpenEnv, teamId: string): Promise<void> {
  const history = await getMessages(undefined, teamId);

  // Same invariant as `openSession`'s: a switch that happened while this read was in flight makes
  // the read stale, and stale history does not merge.
  if (env.teamProjectNow() !== teamId) return;

  mergeHistory(env, history);
  await greetIfSilent(env, history.length === 0, { teamProjectId: teamId });
}

/**
 * Brings the current conversation on screen, once per app session.
 *
 * For the hire it first resolves *which* conversation that is — the newest, or the one this window
 * was last in — then reads it and, only for the first, still-empty conversation, opens the
 * greeting. Reading first is what keeps a reload from replacing the transcript: everything read is
 * merged in front of what is already on screen, never assigned over it.
 *
 * Idempotent by latch rather than by state, so the dock's mount effect and the page's can both
 * call it without either double-fetching or racing.
 */
export async function ensureOpened(env: OpenEnv): Promise<void> {
  if (!env.latches.claimLoad()) return;
  env.view.setIsOpening(true);
  env.view.setOpenError(null);

  try {
    const teamId = env.teamProjectNow();
    if (teamId === null) {
      await openSession(env, await env.resolveHireSession());
    } else {
      await openTeamConversation(env, teamId);
    }
  } catch (e) {
    console.error(e);
    // This failure owns the banner: a retry must redo *this* read, not a stale move.
    env.latches.setRetryMove(null);
    // The latch goes back, or one blip is permanent: this runs as the app root mounts, the widget
    // never unmounts, and `retryOpen` is the only way back.
    env.latches.releaseLoad();
    env.view.setOpenError(HISTORY_FAILED);
  } finally {
    env.view.setIsOpening(false);
  }
}
