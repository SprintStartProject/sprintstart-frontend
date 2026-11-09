import type { Dispatch, SetStateAction } from "react";
import type { BuddyMessageView, BuddyStreamHandlers, ProposedAction } from "../types";
import { placesOnBoard } from "./boardActions";
import {
  addActions,
  addCitation,
  appendChunk,
  clearContent,
  markStopped,
  setError,
} from "./messageReducers";
import { hireProposal, storedProposal } from "./proposals";
import { REPLY_FAILED, REPLY_TIMED_OUT } from "./replyMessages";
import type { createDraftBuffer } from "./turnTimers";

type Setter<T> = Dispatch<SetStateAction<T>>;

/** The thread's state as one running turn is allowed to write it. */
export type TurnView = {
  setMessages: Setter<BuddyMessageView[]>;
  setIsThinking: Setter<boolean>;
  setIsStreaming: Setter<boolean>;
  setActiveTool: Setter<string | null>;
};

/** Everything one turn's stream callbacks share. */
export type TurnContext = {
  view: TurnView;
  assistantId: string;
  draft: ReturnType<typeof createDraftBuffer>;
  watchdog: { arm: () => void; clear: () => void };
  /** Re-reads the conversation list when the row is still untitled. */
  refreshTitle: () => void;
  /** Proposals held back until the reply is finished, so a card never lands above an empty bubble. */
  proposed: ProposedAction[];
  /**
   * Whether this turn ran a tool that puts a card on the board, and whether it ran any tool at
   * all. Properties rather than `let`s, so a read after the stream sees writes made in callbacks.
   */
  touched: { board: boolean; any: boolean };
  /** Whether any of the answer's words have reached state yet. */
  shown: { content: boolean };
};

/**
 * The closings a turn can have. Every one ends the busy states and re-reads a still-untitled row —
 * the backend names the conversation before the turn, so even a failed or stopped turn has a title
 * waiting.
 */
export function turnClosings(ctx: TurnContext) {
  const { view, assistantId, draft } = ctx;

  const endBusy = () => {
    draft.flush();
    view.setIsStreaming(false);
    view.setIsThinking(false);
    view.setActiveTool(null);
  };
  const fail = (reason: string) => {
    endBusy();
    view.setMessages((prev) => setError(prev, assistantId, reason));
    ctx.refreshTitle();
  };

  return {
    endBusy,
    /** A turn the hire stopped: what streamed is kept, with no error line, because nothing failed. */
    stopped: () => {
      endBusy();
      view.setMessages((prev) => markStopped(prev, assistantId));
      ctx.refreshTitle();
    },
    /** A turn the watchdog cut off: it went silent, so the reply says it failed. */
    timedOut: () => fail(REPLY_TIMED_OUT),
    failed: () => fail(REPLY_FAILED),
    /** A read that threw: the reply fails, and the title waits for the next completed turn. */
    thrown: () => {
      endBusy();
      view.setMessages((prev) => setError(prev, assistantId, REPLY_FAILED));
    },
    /** A finished reply, with the proposals it held back attached after its words. */
    done: () => {
      endBusy();
      if (ctx.proposed.length > 0) {
        view.setMessages((prev) => addActions(prev, assistantId, ctx.proposed));
      }
      ctx.refreshTitle();
    },
  };
}

type Closings = ReturnType<typeof turnClosings>;
type Handlers<K extends keyof BuddyStreamHandlers> = Pick<BuddyStreamHandlers, K>;

function progressHandlers(ctx: TurnContext): Handlers<"onToolUse" | "onReasoning" | "onCitation"> {
  const { view, draft, assistantId } = ctx;
  const alive = ctx.watchdog.arm;

  return {
    onToolUse: (name) => {
      alive();
      view.setActiveTool(name);
      ctx.touched.any = true;
      if (placesOnBoard(name)) ctx.touched.board = true;
    },
    onReasoning: (text) => {
      alive();
      // `isThinking` stays true until the first real token, but the turn counts as streaming, so
      // the panel follows it from the first thought.
      view.setIsStreaming(true);
      draft.addReasoning(text);
      draft.schedule();
    },
    onCitation: (citation) => {
      alive();
      view.setMessages((prev) => addCitation(prev, assistantId, citation));
    },
  };
}

function wordHandlers(ctx: TurnContext): Handlers<"onToken" | "onReset"> {
  const { view, draft, assistantId } = ctx;
  const alive = ctx.watchdog.arm;

  return {
    onToken: (token) => {
      alive();
      view.setIsStreaming(true);
      view.setIsThinking(false);
      view.setActiveTool(null);
      draft.addContent(token);
      // The first word is written at once, so the typing row never gives way to an empty bubble.
      if (ctx.shown.content) {
        draft.schedule();
      } else {
        ctx.shown.content = true;
        draft.flush();
      }
    },
    onReset: () => {
      alive();
      // The backend is asking again and the streamed words will not be part of the answer;
      // thoughts and citations stay, and the typing row takes the reply's place.
      draft.discardContent();
      draft.flush();
      ctx.shown.content = false;
      view.setIsThinking(true);
      view.setMessages((prev) => clearContent(prev, assistantId));
    },
  };
}

function proposalHandlers(ctx: TurnContext): Handlers<"onActionProposal" | "onStoredProposal"> {
  const hold = (proposal: ProposedAction) => {
    ctx.watchdog.arm();
    ctx.view.setActiveTool(null);
    ctx.proposed.push(proposal);
  };

  return {
    onActionProposal: (proposal) => hold(hireProposal(crypto.randomUUID(), proposal)),
    onStoredProposal: (proposal) => hold(storedProposal(crypto.randomUUID(), proposal)),
  };
}

function endHandlers(ctx: TurnContext, closings: Closings): Handlers<"onDone" | "onError"> {
  return {
    onDone: () => {
      ctx.watchdog.clear();
      closings.done();
    },
    onError: (err) => {
      ctx.watchdog.clear();
      console.error(err);
      closings.failed();
    },
  };
}

/** The callbacks the buddy's stream calls into, one group per kind of event. */
export function streamHandlers(ctx: TurnContext, closings: Closings): BuddyStreamHandlers {
  return {
    ...progressHandlers(ctx),
    ...wordHandlers(ctx),
    ...proposalHandlers(ctx),
    ...endHandlers(ctx, closings),
  };
}

/** Writes a flushed chunk of words and thoughts onto the reply being written. */
export function applyChunk(view: TurnView, assistantId: string) {
  return (chunk: Parameters<typeof appendChunk>[2]) =>
    view.setMessages((prev) => appendChunk(prev, assistantId, chunk));
}
