import type { Dispatch, SetStateAction } from "react";
import {
  streamMessage,
  type BuddyOpeningAction,
  type BuddySessionSummary,
} from "../../../services/buddyService";
import type { BuddyMessageView, ProposedAction } from "../types";
import { toWireFilters } from "../utils/filterRange";
import type { BuddySessionFilters } from "../types";
import { withTurn } from "./messageReducers";
import { STREAM_TIMEOUT_MS } from "./replyMessages";
import {
  applyChunk,
  streamHandlers,
  turnClosings,
  type TurnContext,
  type TurnView,
} from "./streamHandlers";
import type { TurnTracker } from "./turnTracker";
import { createDraftBuffer, createWatchdog } from "./turnTimers";

/** What a turn reads from the conversation around it, always as of the moment it asks. */
export type TurnSession = {
  teamProjectNow: () => string | null;
  currentSessionNow: () => string | null;
  sessionsNow: () => BuddySessionSummary[];
  resolveHireSession: () => Promise<string>;
  refreshSessions: () => Promise<BuddySessionSummary[] | null>;
  capabilitiesNow: () => boolean;
  filtersNow: () => BuddySessionFilters;
};

export type TurnEnv = {
  tracker: TurnTracker;
  view: TurnView & { setOpenerAction: Dispatch<SetStateAction<BuddyOpeningAction | null>> };
  session: TurnSession;
  invalidateBoard: () => void;
  /** Called when the conversation could not be found for the send; the banner owns the retry. */
  onResolveFailed: () => void;
};

/**
 * The hire's surface must name the conversation it speaks into. The composer is live from the
 * first paint, so a send can beat the opening read; resolution is shared and memoised in flight
 * (`resolveHireSession`), so both land on the same conversation.
 *
 * @returns The conversation to speak into (`undefined` in team mode), or `null` when it could not
 *   be resolved.
 */
async function resolveTarget(env: TurnEnv): Promise<{ sessionId: string | undefined } | null> {
  if (env.session.teamProjectNow() !== null) return { sessionId: undefined };
  try {
    const sessionId = env.session.currentSessionNow() ?? (await env.session.resolveHireSession());
    return { sessionId };
  } catch (e) {
    console.error(e);
    env.onResolveFailed();
    return null;
  }
}

/** Puts the hire's question and an empty reply on screen, and returns the reply's id. */
function openTurn(env: TurnEnv, text: string): string {
  const now = new Date().toISOString();
  const userMessage: BuddyMessageView = {
    id: crypto.randomUUID(),
    role: "USER",
    content: text,
    createdAt: now,
  };
  const assistantId = crypto.randomUUID();
  const assistantMessage: BuddyMessageView = {
    id: assistantId,
    role: "ASSISTANT",
    content: "",
    createdAt: now,
    citations: [],
  };

  env.view.setMessages((prev) => withTurn(prev, userMessage, assistantMessage));
  env.view.setIsThinking(true);
  env.view.setActiveTool(null);
  // Once the hire says anything, the opener's one-click suggestion has served its purpose.
  env.view.setOpenerAction(null);
  return assistantId;
}

/**
 * The first completed turn is when the backend has named the conversation; while its row is still
 * untitled, re-read the list so the rail shows the name it just wrote.
 */
function titleRefresher(env: TurnEnv, sessionId: string | undefined) {
  return () => {
    if (sessionId === undefined) return;
    const summary = env.session.sessionsNow().find((session) => session.id === sessionId);
    if (summary && summary.title.trim() === "") void env.session.refreshSessions();
  };
}

type Opened = {
  sessionId: string | undefined;
  assistantId: string;
  watchdog: TurnContext["watchdog"];
};

function turnContext(env: TurnEnv, opened: Opened): TurnContext {
  const { sessionId, assistantId, watchdog } = opened;
  return {
    view: env.view,
    assistantId,
    draft: createDraftBuffer(applyChunk(env.view, assistantId)),
    watchdog,
    refreshTitle: titleRefresher(env, sessionId),
    proposed: [] as ProposedAction[],
    touched: { board: false, any: false },
    shown: { content: false },
  };
}

/**
 * Closes a turn the abort ended: an abort resolves the read silently, so the terminal `onDone`
 * never ran. The watchdog's abort arrives through the same door and is a failure, not a stop.
 */
function closeIfAborted(
  closings: ReturnType<typeof turnClosings>,
  signal: AbortSignal,
  timedOut: boolean,
): boolean {
  if (!signal.aborted) return false;
  if (timedOut) closings.timedOut();
  else closings.stopped();
  return true;
}

/**
 * Runs one turn: sends the message and streams the buddy's reply into the conversation.
 * Resolves once the turn's close-out has run, whether it finished, failed or was stopped.
 */
export async function runTurn(env: TurnEnv, text: string): Promise<void> {
  if (!text.trim()) return;

  const controller = env.tracker.begin();
  const target = await resolveTarget(env);
  if (target === null) {
    // The turn never started, but this send already claimed the slot; without releasing it every
    // later submit would queue behind a turn that never ends.
    env.tracker.end(controller);
    return;
  }

  const assistantId = openTurn(env, text);
  const timeout = { fired: false };
  const watchdog = createWatchdog(STREAM_TIMEOUT_MS, () => {
    timeout.fired = true;
    console.error(`Buddy stream timed out (no events for ${STREAM_TIMEOUT_MS}ms)`);
    controller.abort();
  });
  const ctx = turnContext(env, { sessionId: target.sessionId, assistantId, watchdog });
  const closings = turnClosings(ctx);

  await streamUnderWatchdog({ env, ctx, closings, controller, text, target, timeout });
}

type StreamRun = {
  env: TurnEnv;
  ctx: TurnContext;
  closings: ReturnType<typeof turnClosings>;
  controller: AbortController;
  text: string;
  target: { sessionId: string | undefined };
  timeout: { fired: boolean };
};

async function streamUnderWatchdog(run: StreamRun): Promise<void> {
  const { env, ctx, closings, controller, timeout } = run;
  // Any tool, not only `place_card`: the backend adds tools faster than this list follows, and a
  // re-read costs one request where a stale board costs the hire's trust.
  const syncBoardIfTouched = () => {
    if (ctx.touched.board || ctx.touched.any) env.invalidateBoard();
  };

  ctx.watchdog.arm();
  try {
    await sendStream(run);
    // The turn is over — the first moment a card placed mid-answer is certainly on the board.
    syncBoardIfTouched();
    closeIfAborted(closings, controller.signal, timeout.fired);
  } catch (e) {
    console.error(e);
    closings.endBusy();
    if (!closeIfAborted(closings, controller.signal, timeout.fired)) closings.thrown();
    // A turn that placed a card and then broke still wrote it.
    syncBoardIfTouched();
  } finally {
    ctx.watchdog.clear();
    // Whatever the close-out did not already write: no frame callback outlives the turn.
    ctx.draft.flush();
    env.tracker.end(controller);
  }
}

function sendStream(run: StreamRun): Promise<void> {
  const { env, ctx, closings, controller, text, target } = run;
  return streamMessage(
    text,
    streamHandlers(ctx, closings),
    // Read at call time: a turn speaks to whichever conversation is current when it starts.
    target.sessionId,
    env.session.teamProjectNow() ?? undefined,
    // The page the dock floats over, for the buddy's app guide; read from the window at send time
    // so the app-wide conversation does not re-render on every navigation.
    window.location.pathname,
    controller.signal,
    {
      capabilitiesEnabled: env.session.capabilitiesNow(),
      filters: toWireFilters(env.session.filtersNow()),
    },
  );
}
