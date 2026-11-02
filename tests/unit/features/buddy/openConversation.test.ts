import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BuddyMessage, BuddyMessageView } from "../../../../src/features/buddy/types";
import {
  ensureOpened,
  openSession,
  type OpenEnv,
} from "../../../../src/features/buddy/conversation/openConversation";
import { createOpeningLatches } from "../../../../src/features/buddy/conversation/openingLatches";
import {
  GREETING_FAILED,
  HISTORY_FAILED,
} from "../../../../src/features/buddy/conversation/replyMessages";
import { getMessages, streamOpenBuddy } from "../../../../src/services/buddyService";

vi.mock("../../../../src/services/buddyService", () => ({
  getMessages: vi.fn(),
  streamOpenBuddy: vi.fn(),
}));

const read = vi.mocked(getMessages);
const greet = vi.mocked(streamOpenBuddy);

const OLD: BuddyMessage = { role: "USER", content: "earlier", createdAt: "2026-01-01T00:00:00Z" };

function setup(overrides: Partial<OpenEnv> = {}) {
  const state = {
    messages: [] as BuddyMessageView[],
    opening: [] as boolean[],
    greeting: [] as boolean[],
    errors: [] as (string | null)[],
  };
  const latches = createOpeningLatches();
  const env: OpenEnv = {
    latches,
    view: {
      setMessages: (update) => {
        state.messages = typeof update === "function" ? update(state.messages) : update;
      },
      setOpenerAction: () => {},
      setIsOpening: (next) => {
        state.opening.push(next as boolean);
      },
      setIsGreeting: (next) => {
        state.greeting.push(next as boolean);
      },
      setOpenError: (next) => {
        state.errors.push(next as string | null);
      },
    },
    messagesNow: () => state.messages,
    sessionsNow: () => [{ id: "s1", title: "" }] as never,
    currentSessionNow: () => "s1",
    teamProjectNow: () => null,
    resolveHireSession: () => Promise.resolve("s1"),
    ...overrides,
  };
  return { env, state, latches };
}

beforeEach(() => {
  read.mockReset();
  greet.mockReset();
  greet.mockImplementation((handlers) => {
    handlers.onToken("Hi");
    handlers.onDone();
    return Promise.resolve();
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("openSession", () => {
  it("merges what it read and does not greet a conversation with words in it", async () => {
    read.mockResolvedValue([OLD]);
    const { env, state } = setup();

    await openSession(env, "s1");

    expect(state.messages.map((m) => m.content)).toEqual(["earlier"]);
    expect(greet).not.toHaveBeenCalled();
    expect(state.opening).toEqual([true, false]);
    expect(state.errors).toEqual([null]);
  });

  it("greets the hire's only, empty conversation and holds the latch while it does", async () => {
    read.mockResolvedValue([]);
    const { env, state, latches } = setup();
    let busyDuring = false;
    greet.mockImplementation((handlers) => {
      busyDuring = latches.isBusy();
      handlers.onDone();
      return Promise.resolve();
    });

    await openSession(env, "s1");

    expect(greet).toHaveBeenCalledWith(expect.anything(), "s1", undefined);
    expect(busyDuring).toBe(true);
    expect(latches.isBusy()).toBe(false);
    expect(state.greeting).toEqual([true, false]);
  });

  it("does not greet when the hire has more than one conversation", async () => {
    read.mockResolvedValue([]);
    const { env } = setup({
      sessionsNow: () => [{ id: "s1" }, { id: "s2" }] as never,
    });

    await openSession(env, "s1");

    expect(greet).not.toHaveBeenCalled();
  });

  it("does not greet over a question the hire typed while the read was in flight", async () => {
    read.mockResolvedValue([]);
    const { env, state } = setup();
    state.messages = [{ id: "u", role: "USER", content: "hi", createdAt: "x" }];

    await openSession(env, "s1");

    expect(greet).not.toHaveBeenCalled();
    expect(state.messages.map((m) => m.id)).toEqual(["u"]);
  });

  it("drops a read for a conversation that has left the screen", async () => {
    read.mockResolvedValue([OLD]);
    const { env, state } = setup({ currentSessionNow: () => "other" });

    await openSession(env, "s1");

    expect(state.messages).toEqual([]);
    expect(state.opening).toEqual([true, false]);
  });

  it("throws a failed read to the caller and still lowers the opening flag", async () => {
    read.mockRejectedValue(new Error("down"));
    const { env, state } = setup();

    await expect(openSession(env, "s1")).rejects.toThrow("down");

    expect(state.opening).toEqual([true, false]);
  });
});

describe("ensureOpened", () => {
  it("opens the resolved hire conversation once, however often it is called", async () => {
    read.mockResolvedValue([OLD]);
    const { env } = setup();

    await ensureOpened(env);
    await ensureOpened(env);

    expect(read).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledWith("s1");
  });

  it("opens the team conversation by project and greets it while it is empty", async () => {
    read.mockResolvedValue([]);
    const { env } = setup({ teamProjectNow: () => "p1" });

    await ensureOpened(env);

    expect(read).toHaveBeenCalledWith(undefined, "p1");
    expect(greet).toHaveBeenCalledWith(expect.anything(), undefined, "p1");
  });

  it("does not merge a team read that a switch has made stale", async () => {
    read.mockResolvedValue([OLD]);
    let target: string | null = "p1";
    const { env, state } = setup({ teamProjectNow: () => target });
    read.mockImplementation(() => {
      target = "p2";
      return Promise.resolve([OLD]);
    });

    await ensureOpened(env);

    expect(state.messages).toEqual([]);
    expect(greet).not.toHaveBeenCalled();
  });

  it("does not greet a team conversation that has history", async () => {
    read.mockResolvedValue([OLD]);
    const { env } = setup({ teamProjectNow: () => "p1" });

    await ensureOpened(env);

    expect(greet).not.toHaveBeenCalled();
  });

  it("puts the banner up, forgets a stale retry and gives the latch back when the read fails", async () => {
    read.mockRejectedValue(new Error("down"));
    const { env, state, latches } = setup();
    latches.setRetryMove("newConversation");

    await ensureOpened(env);

    expect(state.errors).toEqual([null, null, HISTORY_FAILED]);
    expect(latches.retryMove()).toBeNull();
    expect(state.opening.at(-1)).toBe(false);

    read.mockResolvedValue([OLD]);
    await ensureOpened(env);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("fails the same way when the hire's conversation cannot be resolved", async () => {
    const { env, state } = setup({ resolveHireSession: () => Promise.reject(new Error("no")) });

    await ensureOpened(env);

    expect(state.errors.at(-1)).toBe(HISTORY_FAILED);
    expect(read).not.toHaveBeenCalled();
  });
});

describe("greeting failures", () => {
  it("leave the reason on the greeting when nothing arrived", async () => {
    read.mockResolvedValue([]);
    greet.mockRejectedValue(new Error("down"));
    const { env, state } = setup();

    await openSession(env, "s1");

    expect(state.messages).toHaveLength(1);
    expect(state.messages[0].error).toBe(GREETING_FAILED);
  });
});
