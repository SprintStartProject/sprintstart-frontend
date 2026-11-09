import { describe, expect, it, vi } from "vitest";
import type { BuddyMessageView } from "../../../../src/features/buddy/types";
import {
  streamHandlers,
  turnClosings,
  type TurnContext,
} from "../../../../src/features/buddy/conversation/streamHandlers";
import {
  REPLY_FAILED,
  REPLY_TIMED_OUT,
} from "../../../../src/features/buddy/conversation/replyMessages";
import type { createDraftBuffer } from "../../../../src/features/buddy/conversation/turnTimers";

const REPLY: BuddyMessageView = {
  id: "reply",
  role: "ASSISTANT",
  content: "",
  createdAt: "2026-01-01T00:00:00Z",
  citations: [],
};

function harness() {
  const state = { messages: [REPLY] as BuddyMessageView[], thinking: true, streaming: false };
  const log: string[] = [];
  const tool = { current: "x" as string | null };
  const draft = {
    addContent: vi.fn(),
    addReasoning: vi.fn(),
    discardContent: vi.fn(),
    schedule: vi.fn(() => log.push("schedule")),
    flush: vi.fn(() => log.push("flush")),
  } satisfies ReturnType<typeof createDraftBuffer>;
  const ctx: TurnContext = {
    view: {
      setMessages: (update) => {
        state.messages = typeof update === "function" ? update(state.messages) : update;
      },
      setIsThinking: (next) => {
        state.thinking = next as boolean;
      },
      setIsStreaming: (next) => {
        state.streaming = next as boolean;
      },
      setActiveTool: (next) => {
        tool.current = next as string | null;
      },
    },
    assistantId: "reply",
    draft,
    watchdog: { arm: vi.fn(() => log.push("arm")), clear: vi.fn(() => log.push("clear")) },
    refreshTitle: vi.fn(() => log.push("title")),
    proposed: [],
    touched: { board: false, any: false },
    shown: { content: false },
  };
  const closings = turnClosings(ctx);
  return { ctx, closings, state, tool, draft, log, handlers: streamHandlers(ctx, closings) };
}

describe("turnClosings", () => {
  it("endBusy flushes the draft first, then clears every busy state", () => {
    const { closings, state, tool, log } = harness();
    state.streaming = true;

    closings.endBusy();

    expect(log).toEqual(["flush"]);
    expect(state.streaming).toBe(false);
    expect(state.thinking).toBe(false);
    expect(tool.current).toBeNull();
  });

  it("a stopped turn is marked stopped, carries no error and re-reads the title", () => {
    const { closings, state, log } = harness();

    closings.stopped();

    expect(state.messages[0].stopped).toBe(true);
    expect(state.messages[0].error).toBeUndefined();
    expect(log).toEqual(["flush", "title"]);
  });

  it("a timed-out turn fails with the silence line and re-reads the title", () => {
    const { closings, state, log } = harness();

    closings.timedOut();

    expect(state.messages[0].error).toBe(REPLY_TIMED_OUT);
    expect(state.messages[0].stopped).toBeUndefined();
    expect(log).toEqual(["flush", "title"]);
  });

  it("a failed turn fails with the generic line and re-reads the title", () => {
    const { closings, state, log } = harness();

    closings.failed();

    expect(state.messages[0].error).toBe(REPLY_FAILED);
    expect(log).toEqual(["flush", "title"]);
  });

  it("a thrown read fails the reply but leaves the title alone", () => {
    const { closings, state, log } = harness();

    closings.thrown();

    expect(state.messages[0].error).toBe(REPLY_FAILED);
    expect(log).toEqual(["flush"]);
  });

  it("done attaches held-back proposals after the words, and nothing when there are none", () => {
    const { closings, ctx, state } = harness();

    closings.done();
    expect(state.messages[0].actions).toBeUndefined();

    ctx.proposed.push({ id: "p1" } as never);
    closings.done();
    expect(state.messages[0].actions).toEqual([{ id: "p1" }]);
  });
});

describe("streamHandlers", () => {
  it("a tool use arms the watchdog, names the tool and marks board writes", () => {
    const { handlers, ctx, tool, log } = harness();

    handlers.onToolUse?.("search_wiki");
    expect(tool.current).toBe("search_wiki");
    expect(ctx.touched).toEqual({ board: false, any: true });

    handlers.onToolUse?.("place_card");
    expect(ctx.touched).toEqual({ board: true, any: true });
    expect(log.filter((entry) => entry === "arm")).toHaveLength(2);
  });

  it("reasoning counts as streaming and is scheduled, not written at once", () => {
    const { handlers, state, draft, log } = harness();

    handlers.onReasoning?.("hm");

    expect(state.streaming).toBe(true);
    expect(state.thinking).toBe(true);
    expect(draft.addReasoning).toHaveBeenCalledWith("hm");
    expect(log).toEqual(["arm", "schedule"]);
  });

  it("the first token is flushed at once, later ones wait for a frame", () => {
    const { handlers, state, tool, draft, log, ctx } = harness();

    handlers.onToken("a");
    expect(state.streaming).toBe(true);
    expect(state.thinking).toBe(false);
    expect(tool.current).toBeNull();
    expect(ctx.shown.content).toBe(true);
    expect(log).toEqual(["arm", "flush"]);

    handlers.onToken("b");
    expect(draft.addContent).toHaveBeenLastCalledWith("b");
    expect(log).toEqual(["arm", "flush", "arm", "schedule"]);
  });

  it("a reset throws the words away and puts the typing row back", () => {
    const { handlers, state, draft, ctx } = harness();
    state.messages = [{ ...REPLY, content: "words" }];
    ctx.shown.content = true;
    state.thinking = false;

    handlers.onReset?.();

    expect(draft.discardContent).toHaveBeenCalledTimes(1);
    expect(ctx.shown.content).toBe(false);
    expect(state.thinking).toBe(true);
    expect(state.messages[0].content).toBe("");
  });

  it("a citation lands on the reply", () => {
    const { handlers, state } = harness();

    handlers.onCitation({ id: "c1" } as never);

    expect(state.messages[0].citations).toEqual([{ id: "c1" }]);
  });

  it("proposals are held back, not shown, and clear the tool label", () => {
    const { handlers, ctx, state, tool } = harness();

    handlers.onActionProposal?.({ action: "claim_goal", label: "Take it" });
    handlers.onStoredProposal?.({ id: "s1", action: "place_note", label: "Note" } as never);

    expect(ctx.proposed).toHaveLength(2);
    expect(state.messages[0].actions).toBeUndefined();
    expect(tool.current).toBeNull();
  });

  it("done and error disarm the watchdog; error also reports and fails the reply", () => {
    const first = harness();
    first.handlers.onDone();
    expect(first.log).toEqual(["clear", "flush", "title"]);

    const second = harness();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    second.handlers.onError?.("boom");
    expect(error).toHaveBeenCalledWith("boom");
    expect(second.log).toEqual(["clear", "flush", "title"]);
    expect(second.state.messages[0].error).toBe(REPLY_FAILED);
    error.mockRestore();
  });
});
