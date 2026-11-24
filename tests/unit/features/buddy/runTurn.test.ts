import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BuddyMessageView } from "../../../../src/features/buddy/types";
import { runTurn, type TurnEnv } from "../../../../src/features/buddy/conversation/runTurn";
import { createTurnTracker } from "../../../../src/features/buddy/conversation/turnTracker";
import { REPLY_FAILED } from "../../../../src/features/buddy/conversation/replyMessages";
import { streamMessage } from "../../../../src/services/buddyService";

vi.mock("../../../../src/services/buddyService", () => ({ streamMessage: vi.fn() }));

type Handlers = Parameters<typeof streamMessage>[1];
const stream = vi.mocked(streamMessage);

function setup(overrides: Partial<TurnEnv["session"]> = {}) {
  const state = { messages: [] as BuddyMessageView[], thinking: false, tool: "x" as string | null };
  const calls = { opener: [] as unknown[], invalidated: 0, resolveFailed: 0, titleReads: 0 };
  const tracker = createTurnTracker();
  const drain = vi.fn();
  tracker.onEnd(drain);
  const env: TurnEnv = {
    tracker,
    view: {
      setMessages: (update) => {
        state.messages = typeof update === "function" ? update(state.messages) : update;
      },
      setIsThinking: (next) => {
        state.thinking = next as boolean;
      },
      setIsStreaming: () => {},
      setActiveTool: (next) => {
        state.tool = next as string | null;
      },
      setOpenerAction: (next) => {
        calls.opener.push(next);
      },
    },
    session: {
      teamProjectNow: () => null,
      currentSessionNow: () => "s1",
      sessionsNow: () => [{ id: "s1", title: "" }] as never,
      resolveHireSession: () => Promise.resolve("resolved"),
      refreshSessions: () => {
        calls.titleReads += 1;
        return Promise.resolve([]);
      },
      capabilitiesNow: () => true,
      filtersNow: () => ({ sourceSystems: ["GITHUB" as const], from: "", to: "" }),
      ...overrides,
    },
    invalidateBoard: () => {
      calls.invalidated += 1;
    },
    onResolveFailed: () => {
      calls.resolveFailed += 1;
    },
  };
  return { env, state, calls, tracker, drain };
}

beforeEach(() => {
  stream.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("runTurn", () => {
  it("ignores a blank message without touching the slot", async () => {
    const { env, tracker } = setup();

    await runTurn(env, "   ");

    expect(stream).not.toHaveBeenCalled();
    expect(tracker.sendCount()).toBe(0);
  });

  it("puts the question and an empty reply up, speaks into the current conversation and releases", async () => {
    stream.mockImplementation((_text, handlers) => {
      handlers.onDone();
      return Promise.resolve();
    });
    const { env, state, calls, tracker, drain } = setup();

    await runTurn(env, "hello");

    const [text, , sessionId, teamId, page, signal, options] = stream.mock.calls[0];
    expect(text).toBe("hello");
    expect(sessionId).toBe("s1");
    expect(teamId).toBeUndefined();
    expect(page).toBe(window.location.pathname);
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(options?.capabilitiesEnabled).toBe(true);
    expect(options?.filters?.source_systems).toEqual(["GITHUB"]);
    expect(state.messages.map((m) => m.role)).toEqual(["USER", "ASSISTANT"]);
    expect(state.messages[0].content).toBe("hello");
    expect(calls.opener).toEqual([null]);
    expect(tracker.isStreaming()).toBe(false);
    expect(drain).toHaveBeenCalledTimes(1);
  });

  it("resolves the hire's conversation when none is current, and names none in team mode", async () => {
    stream.mockImplementation((_t, handlers) => {
      handlers.onDone();
      return Promise.resolve();
    });
    const hire = setup({ currentSessionNow: () => null });
    await runTurn(hire.env, "a");
    expect(stream.mock.calls[0][2]).toBe("resolved");

    const team = setup({ teamProjectNow: () => "p1", currentSessionNow: () => "s1" });
    await runTurn(team.env, "b");
    expect(stream.mock.calls[1][2]).toBeUndefined();
    expect(stream.mock.calls[1][3]).toBe("p1");
  });

  it("gives up cleanly when the conversation cannot be resolved", async () => {
    const { env, state, calls, tracker, drain } = setup({
      currentSessionNow: () => null,
      resolveHireSession: () => Promise.reject(new Error("down")),
    });

    await runTurn(env, "hello");

    expect(stream).not.toHaveBeenCalled();
    expect(calls.resolveFailed).toBe(1);
    expect(state.messages).toEqual([]);
    expect(tracker.isStreaming()).toBe(false);
    expect(drain).toHaveBeenCalledTimes(1);
  });

  it("re-reads the board after a turn that ran a tool, and not after one that ran none", async () => {
    stream.mockImplementationOnce((_t, handlers) => {
      handlers.onToolUse?.("search");
      handlers.onDone();
      return Promise.resolve();
    });
    const withTool = setup();
    await runTurn(withTool.env, "a");
    expect(withTool.calls.invalidated).toBe(1);

    stream.mockImplementationOnce((_t, handlers) => {
      handlers.onDone();
      return Promise.resolve();
    });
    const without = setup();
    await runTurn(without.env, "b");
    expect(without.calls.invalidated).toBe(0);
  });

  it("re-reads the list when the finished turn's row is still untitled", async () => {
    stream.mockImplementation((_t, handlers) => {
      handlers.onDone();
      return Promise.resolve();
    });
    const untitled = setup();
    await runTurn(untitled.env, "a");
    expect(untitled.calls.titleReads).toBe(1);

    const titled = setup({ sessionsNow: () => [{ id: "s1", title: "Named" }] as never });
    await runTurn(titled.env, "b");
    expect(titled.calls.titleReads).toBe(0);

    const team = setup({ teamProjectNow: () => "p1" });
    await runTurn(team.env, "c");
    expect(team.calls.titleReads).toBe(0);
  });

  it("fails the reply, quietly about the title, when the read throws", async () => {
    stream.mockRejectedValue(new Error("network"));
    const { env, state, calls, tracker } = setup();

    await runTurn(env, "hello");

    expect(state.messages[1].error).toBe(REPLY_FAILED);
    expect(state.thinking).toBe(false);
    expect(calls.titleReads).toBe(0);
    expect(tracker.isStreaming()).toBe(false);
  });

  it("still re-reads the board when the read throws after a tool ran", async () => {
    stream.mockImplementation((_t, handlers) => {
      handlers.onToolUse?.("place_card");
      return Promise.reject(new Error("network"));
    });
    const { env, calls } = setup();

    await runTurn(env, "hello");

    expect(calls.invalidated).toBe(1);
  });

  it("closes a stopped turn as stopped, not failed", async () => {
    stream.mockImplementation((_t, _h, _s, _team, _p, signal) => {
      tracker.abort();
      expect(signal?.aborted).toBe(true);
      return Promise.resolve();
    });
    const { env, state, tracker } = setup();

    await runTurn(env, "hello");

    expect(state.messages[1].stopped).toBe(true);
    expect(state.messages[1].error).toBeUndefined();
  });

  it("closes a stopped turn whose read threw as stopped too", async () => {
    stream.mockImplementation(() => {
      tracker.abort();
      return Promise.reject(new Error("aborted"));
    });
    const { env, state, tracker } = setup();

    await runTurn(env, "hello");

    expect(state.messages[1].stopped).toBe(true);
    expect(state.messages[1].error).toBeUndefined();
  });
});

describe("runTurn watchdog", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("fails a silent stream as timed out instead of stopped", async () => {
    stream.mockImplementation(
      (_t, _h, _s, _team, _p, signal) =>
        new Promise<void>((resolve) => {
          signal?.addEventListener("abort", () => resolve());
        }),
    );
    const { env, state } = setup();

    const turn = runTurn(env, "hello");
    await vi.advanceTimersByTimeAsync(300_000);
    await turn;

    expect(state.messages[1].error).toContain("stopped responding");
    expect(state.messages[1].stopped).toBeUndefined();
  });

  it("is pushed back by every event", async () => {
    let handlers: Handlers | undefined;
    let finish = () => {};
    stream.mockImplementation(
      (_t, h) =>
        new Promise<void>((resolve) => {
          handlers = h;
          finish = resolve;
        }),
    );
    const { env, state } = setup();

    const turn = runTurn(env, "hello");
    await vi.advanceTimersByTimeAsync(299_000);
    handlers?.onToolUse?.("search");
    await vi.advanceTimersByTimeAsync(299_000);
    expect(state.messages[1].error).toBeUndefined();

    handlers?.onDone();
    finish();
    await turn;
    expect(state.messages[1].error).toBeUndefined();
    await vi.advanceTimersByTimeAsync(600_000);
    expect(state.messages[1].error).toBeUndefined();
  });
});
