import type { Dispatch, SetStateAction } from "react";
import { binSession as binSessionApi, createSession } from "../../../services/buddyService";
import type { BuddySessionSummary } from "../../../services/buddyService";
import { clearDraft } from "../buddyDraftStorage";
import type { OpeningLatches } from "./openingLatches";
import { BIN_MOVE_FAILED, CONVERSATION_FAILED, HISTORY_FAILED, isNotFound } from "./replyMessages";
import { blankSession, reusableBlankSession } from "./sessionRules";
import type { TurnTracker } from "./turnTracker";

/** What a move across conversations reads and writes. */
export type MoveEnv = {
  latches: OpeningLatches;
  tracker: TurnTracker;
  /**
   * Whether something is in flight that every transcript-clearing move refuses on: a greeting, an
   * opening read, a proposal decision. Re-asked after every wait, since anything may have moved.
   */
  blocked: () => boolean;
  /** Whether a decision is in flight right now, read apart from the render-time state. */
  decidingNow: () => boolean;
  currentSessionNow: () => string | null;
  sessionsNow: () => BuddySessionSummary[];
  teamProjectNow: () => string | null;
  applySessions: (next: BuddySessionSummary[]) => void;
  applyCurrentSession: (id: string | null) => void;
  markBinned: (id: string) => void;
  /** Puts the thread on screen away, and everything that belonged to it. */
  clearThread: () => void;
  setOpenError: Dispatch<SetStateAction<string | null>>;
  /** Cuts a running answer short and waits for its close-out. */
  stopRunningTurn: () => Promise<void>;
  openSession: (sessionId: string) => Promise<void>;
  userId: string | null;
};

/**
 * Lets a running answer finish being cut short before a move clears the thread.
 *
 * @returns Whether the move may still go ahead: anything may have moved during the wait (another
 *   switch, a queued message that started as the turn ended), and whoever is ahead keeps the thread.
 */
async function settleRunningTurn(env: MoveEnv): Promise<boolean> {
  if (!env.tracker.isStreaming()) return true;
  await env.stopRunningTurn();
  return !(env.blocked() || env.tracker.isStreaming() || env.teamProjectNow() !== null);
}

/** Puts a conversation on screen and reads it. A failed read leaves the switch standing, with the banner. */
async function switchTo(env: MoveEnv, sessionId: string): Promise<void> {
  env.latches.setBusy(true);
  env.applyCurrentSession(sessionId);
  env.clearThread();

  try {
    await env.openSession(sessionId);
  } catch (e) {
    console.error(e);
    // Release the latch so the banner's "Try again" can re-run the read for this conversation.
    env.latches.releaseLoad();
    // This failure owns the banner: a retry must redo this read, not a stale move.
    env.latches.setRetryMove(null);
    env.setOpenError(HISTORY_FAILED);
  } finally {
    env.latches.setBusy(false);
  }
}

/**
 * Brings a conversation the hire picked from the list on screen.
 *
 * Reads it and shows it — no greeting: only the first, never-spoken conversation opens with one,
 * and everything else is a continuing thing the hire asked to see again. A running answer is cut
 * short first; anything else in flight refuses, like every other move that clears the thread.
 *
 * @returns Whether the conversation asked for is the one on screen now — `false` only for a
 *   refusal, so a caller acting on someone else's behalf (the page following its address) can
 *   tell "switched" from "nothing happened". A running answer is not a refusal.
 */
export async function selectSession(env: MoveEnv, sessionId: string): Promise<boolean> {
  if (sessionId === env.currentSessionNow()) return true;
  if (env.teamProjectNow() !== null || env.blocked()) return false;
  if (!(await settleRunningTurn(env))) return false;
  if (sessionId === env.currentSessionNow()) return true;

  await switchTo(env, sessionId);
  // Switched even when the read failed: the conversation on screen is the one asked for, and the
  // banner owns the failure.
  return true;
}

/** What the new-conversation click saw, for the re-check after the create. */
type Entry = { session: string | null; sends: number };

/**
 * A send that begins during the create's round trip would land in the conversation being left and
 * lose its optimistic turn to the clears; a decision or a switch that starts meanwhile wins too.
 */
function movedSince(env: MoveEnv, entry: Entry): boolean {
  return (
    env.tracker.sendCount() !== entry.sends ||
    env.decidingNow() ||
    env.teamProjectNow() !== null ||
    env.currentSessionNow() !== entry.session
  );
}

async function createAndAdopt(env: MoveEnv): Promise<void> {
  env.latches.setBusy(true);
  const entry: Entry = { session: env.currentSessionNow(), sends: env.tracker.sendCount() };

  try {
    const createdId = await createSession();
    // Something moved while the create was in flight; the new conversation stays unadopted (a
    // later refresh lists it) and the user's actual move keeps its turn.
    if (movedSince(env, entry)) return;

    // Newest first, like the backend's own ordering.
    env.applySessions([blankSession(createdId, new Date().toISOString()), ...env.sessionsNow()]);
    env.applyCurrentSession(createdId);
    env.clearThread();
  } catch (e) {
    console.error(e);
    // "Try again" redoes the create itself: the opening read would no-op out of a loaded
    // conversation, so the retry has to be this move.
    env.latches.setRetryMove("newConversation");
    env.setOpenError(CONVERSATION_FAILED);
  } finally {
    env.latches.setBusy(false);
  }
}

/**
 * Starts a new conversation: creates it server-side and switches to it, empty.
 *
 * The composer is the hire's from there — they speak first, and the title is written from that
 * first message server-side. A still-untouched conversation the hire already has comes back
 * instead of a second one being created. Nothing is deleted: the conversation being left keeps
 * its transcript and stays in the list.
 *
 * A running answer is cut short first, because a stream cannot call its callbacks into a thread
 * that has just been cleared. Anything else in flight refuses, for the same reason.
 */
export async function newConversation(env: MoveEnv): Promise<void> {
  // The conversations list is the hire's surface; team mode has one conversation per project and
  // nothing to start. A stale keyboard shortcut must not switch a manager into an empty hire thread.
  if (env.teamProjectNow() !== null || env.blocked()) return;
  if (!(await settleRunningTurn(env))) return;

  // An untitled newest conversation is one nobody has written into (the backend titles from the
  // first message), so it is brought back instead of stacking a second empty one.
  const newest = reusableBlankSession(env.sessionsNow(), env.currentSessionNow());
  if (newest) {
    await selectSession(env, newest.id);
    return;
  }

  await createAndAdopt(env);
}

function assertBinnable(env: MoveEnv): void {
  if (env.teamProjectNow() !== null) {
    throw new Error("Conversations can't be binned while you're in team mode.");
  }
  if (env.blocked()) {
    throw new Error("Your buddy is still working — try again once the reply finishes.");
  }
}

/** A `404` is settled, not failed: binned in another tab, or purged after its retention window. */
async function binRemotely(sessionId: string): Promise<void> {
  try {
    await binSessionApi(sessionId);
  } catch (e) {
    if (!isNotFound(e)) throw e;
  }
}

/**
 * Bins one of the hire's conversations and takes it out of the list.
 *
 * Binned, not deleted: the backend keeps the conversation until its retention window ends, and
 * simply stops returning it. The id is tombstoned so a read already in flight cannot put the row
 * back. When the conversation binned was the one on screen, the next newest takes its place — or,
 * with none left, a fresh conversation starts, so the hire is never left on a thread they just binned.
 *
 * Unlike the other moves, a refusal throws: the list tells the user the bin worked, so returning
 * silently would toast "Conversation binned" over a conversation that never left. The same goes
 * for a failed move off the binned conversation.
 */
export async function binSession(env: MoveEnv, sessionId: string): Promise<void> {
  assertBinnable(env);
  await binRemotely(sessionId);

  env.markBinned(sessionId);
  // Its draft goes with it; the tombstone is what keeps the composer from filing it back.
  clearDraft(env.userId, sessionId);

  const remaining = env.sessionsNow().filter((session) => session.id !== sessionId);
  env.applySessions(remaining);
  if (env.currentSessionNow() !== sessionId) return;

  // The answer being written belongs to the binned conversation; stopping it once here keeps the
  // two paths from toasting twice.
  if (env.tracker.isStreaming()) await env.stopRunningTurn();

  const next = remaining[0];
  if (next) await selectSession(env, next.id);
  else await newConversation(env);

  // The move can fail and still resolve; if the hire is still on the binned conversation, the
  // caller must hear it.
  if (env.currentSessionNow() === sessionId) throw new Error(BIN_MOVE_FAILED);
}
