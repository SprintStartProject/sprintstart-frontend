import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BuddySessionSummary } from "../../../../src/services/buddyService";
import {
  binSession,
  newConversation,
  selectSession,
  type MoveEnv,
} from "../../../../src/features/buddy/conversation/sessionMoves";
import { createOpeningLatches } from "../../../../src/features/buddy/conversation/openingLatches";
import { createTurnTracker } from "../../../../src/features/buddy/conversation/turnTracker";
import {
  BIN_MOVE_FAILED,
  CONVERSATION_FAILED,
  HISTORY_FAILED,
} from "../../../../src/features/buddy/conversation/replyMessages";
import { binSession as binApi, createSession } from "../../../../src/services/buddyService";
import { clearDraft } from "../../../../src/features/buddy/buddyDraftStorage";

vi.mock("../../../../src/services/buddyService", () => ({
  binSession: vi.fn(),
  createSession: vi.fn(),
}));
vi.mock("../../../../src/features/buddy/buddyDraftStorage", () => ({ clearDraft: vi.fn() }));

const bin = vi.mocked(binApi);
const create = vi.mocked(createSession);

const row = (id: string, title = "Named"): BuddySessionSummary => ({
  id,
  title,
  projectId: null,
  createdAt: "2026-01-01T00:00:00Z",
});

function setup(
  overrides: Partial<MoveEnv> = {},
  start = [row("a"), row("b")],
  current: string | null = "a",
) {
  const state = {
    sessions: start,
    current: current,
    cleared: 0,
    errors: [] as (string | null)[],
    binned: [] as string[],
    opened: [] as string[],
    stopped: 0,
  };
  const latches = createOpeningLatches();
  const tracker = createTurnTracker();
  const env: MoveEnv = {
    latches,
    tracker,
    blocked: () => latches.isBusy(),
    decidingNow: () => false,
    currentSessionNow: () => state.current,
    sessionsNow: () => state.sessions,
    teamProjectNow: () => null,
    applySessions: (next) => {
      state.sessions = next;
    },
    applyCurrentSession: (id) => {
      state.current = id;
    },
    markBinned: (id) => {
      state.binned.push(id);
    },
    clearThread: () => {
      state.cleared += 1;
    },
    setOpenError: (next) => {
      state.errors.push(next as string | null);
    },
    stopRunningTurn: () => {
      state.stopped += 1;
      return Promise.resolve();
    },
    openSession: (id) => {
      state.opened.push(id);
      return Promise.resolve();
    },
    userId: "u1",
    ...overrides,
  };
  return { env, state, latches, tracker };
}

beforeEach(() => {
  bin.mockReset().mockResolvedValue(undefined);
  create.mockReset().mockResolvedValue("created");
  vi.mocked(clearDraft).mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("selectSession", () => {
  it("is already there for the conversation on screen", async () => {
    const { env, state } = setup();

    expect(await selectSession(env, "a")).toBe(true);
    expect(state.opened).toEqual([]);
  });

  it("refuses in team mode and while something is in flight", async () => {
    expect(await selectSession(setup({ teamProjectNow: () => "p" }).env, "b")).toBe(false);
    expect(await selectSession(setup({ blocked: () => true }).env, "b")).toBe(false);
  });

  it("switches, clears the thread and opens the conversation, holding the latch meanwhile", async () => {
    const { env, state, latches } = setup();
    let busyDuring = false;
    env.openSession = (id) => {
      busyDuring = latches.isBusy();
      state.opened.push(id);
      return Promise.resolve();
    };

    expect(await selectSession(env, "b")).toBe(true);

    expect(state.current).toBe("b");
    expect(state.cleared).toBe(1);
    expect(state.opened).toEqual(["b"]);
    expect(busyDuring).toBe(true);
    expect(latches.isBusy()).toBe(false);
  });

  it("cuts a running answer short first and goes on when nothing else moved", async () => {
    const { env, state, tracker } = setup();
    tracker.begin();
    env.stopRunningTurn = () => {
      state.stopped += 1;
      tracker.end(tracker.begin());
      return Promise.resolve();
    };

    expect(await selectSession(env, "b")).toBe(true);
    expect(state.stopped).toBe(1);
    expect(state.current).toBe("b");
  });

  it("yields to whoever is ahead after the wait", async () => {
    const { env, state, tracker } = setup();
    tracker.begin();
    env.stopRunningTurn = () => {
      state.stopped += 1;
      return Promise.resolve();
    };

    expect(await selectSession(env, "b")).toBe(false);
    expect(state.current).toBe("a");
    expect(state.cleared).toBe(0);
  });

  it("reports true without switching when the wait landed on the conversation asked for", async () => {
    const { env, state, tracker } = setup();
    tracker.begin();
    env.stopRunningTurn = () => {
      tracker.end(tracker.begin());
      state.current = "b";
      return Promise.resolve();
    };

    expect(await selectSession(env, "b")).toBe(true);
    expect(state.opened).toEqual([]);
  });

  it("keeps the switch and puts the banner up when the read fails", async () => {
    const { env, state, latches } = setup();
    latches.setRetryMove("newConversation");
    latches.claimLoad();
    env.openSession = () => Promise.reject(new Error("down"));

    expect(await selectSession(env, "b")).toBe(true);

    expect(state.current).toBe("b");
    expect(state.errors).toEqual([HISTORY_FAILED]);
    expect(latches.retryMove()).toBeNull();
    expect(latches.claimLoad()).toBe(true);
    expect(latches.isBusy()).toBe(false);
  });
});

describe("newConversation", () => {
  it("does nothing in team mode or while something is in flight", async () => {
    await newConversation(setup({ teamProjectNow: () => "p" }).env);
    await newConversation(setup({ blocked: () => true }).env);

    expect(create).not.toHaveBeenCalled();
  });

  it("brings an untouched conversation back instead of creating a second", async () => {
    const { env, state } = setup({}, [row("blank", ""), row("a")], "a");

    await newConversation(env);

    expect(create).not.toHaveBeenCalled();
    expect(state.current).toBe("blank");
  });

  it("creates one, puts it first and clears the thread", async () => {
    const { env, state, latches } = setup();

    await newConversation(env);

    expect(state.sessions.map((s) => s.id)).toEqual(["created", "a", "b"]);
    expect(state.current).toBe("created");
    expect(state.cleared).toBe(1);
    expect(latches.isBusy()).toBe(false);
  });

  it("does not adopt the new conversation when a send began during the create", async () => {
    const { env, state, tracker } = setup();
    create.mockImplementation(() => {
      tracker.end(tracker.begin());
      return Promise.resolve("created");
    });

    await newConversation(env);

    expect(state.current).toBe("a");
    expect(state.cleared).toBe(0);
  });

  it.each([
    ["a decision started", { decidingNow: () => true }],
    ["team mode was entered", { teamProjectNow: () => "p" }],
  ])("does not adopt the new conversation when %s during the create", async (_name, patch) => {
    const { env, state } = setup();
    create.mockImplementation(() => {
      Object.assign(env, patch);
      return Promise.resolve("created");
    });

    await newConversation(env);

    expect(state.current).toBe("a");
    expect(state.sessions.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("does not adopt the new conversation when the hire moved during the create", async () => {
    const { env, state } = setup();
    create.mockImplementation(() => {
      state.current = "b";
      return Promise.resolve("created");
    });

    await newConversation(env);

    expect(state.current).toBe("b");
    expect(state.cleared).toBe(0);
  });

  it("makes Try again redo the create when it fails", async () => {
    create.mockRejectedValue(new Error("down"));
    const { env, state, latches } = setup();

    await newConversation(env);

    expect(latches.retryMove()).toBe("newConversation");
    expect(state.errors).toEqual([CONVERSATION_FAILED]);
    expect(latches.isBusy()).toBe(false);
  });
});

describe("binSession", () => {
  it("throws in team mode and while something is in flight, without calling the backend", async () => {
    await expect(binSession(setup({ teamProjectNow: () => "p" }).env, "b")).rejects.toThrow(
      "team mode",
    );
    await expect(binSession(setup({ blocked: () => true }).env, "b")).rejects.toThrow(
      "still working",
    );
    expect(bin).not.toHaveBeenCalled();
  });

  it("bins another conversation: tombstone, draft, list; the screen stays", async () => {
    const { env, state } = setup();

    await binSession(env, "b");

    expect(bin).toHaveBeenCalledWith("b");
    expect(state.binned).toEqual(["b"]);
    expect(clearDraft).toHaveBeenCalledWith("u1", "b");
    expect(state.sessions.map((s) => s.id)).toEqual(["a"]);
    expect(state.current).toBe("a");
    expect(state.cleared).toBe(0);
  });

  it("treats a 404 as settled and any other failure as the caller's", async () => {
    bin.mockRejectedValueOnce(Object.assign(new Error("gone"), { status: 404 }));
    const gone = setup();
    await binSession(gone.env, "b");
    expect(gone.state.binned).toEqual(["b"]);

    bin.mockRejectedValueOnce(new Error("boom"));
    const failed = setup();
    await expect(binSession(failed.env, "b")).rejects.toThrow("boom");
    expect(failed.state.binned).toEqual([]);
  });

  it("moves to the next newest when the conversation on screen is binned", async () => {
    const { env, state } = setup();

    await binSession(env, "a");

    expect(state.current).toBe("b");
    expect(state.opened).toEqual(["b"]);
  });

  it("starts a fresh conversation when none is left", async () => {
    const { env, state } = setup({}, [row("a")], "a");

    await binSession(env, "a");

    expect(state.current).toBe("created");
  });

  it("cuts a running answer in the binned conversation short, once", async () => {
    const { env, state, tracker } = setup();
    tracker.begin();
    env.stopRunningTurn = () => {
      state.stopped += 1;
      tracker.end(tracker.begin());
      return Promise.resolve();
    };

    await binSession(env, "a");

    expect(state.stopped).toBe(1);
    expect(state.current).toBe("b");
  });

  it("tells the caller when the move off the binned conversation did not happen", async () => {
    create.mockRejectedValue(new Error("down"));
    const { env } = setup({}, [row("a")], "a");

    await expect(binSession(env, "a")).rejects.toThrow(BIN_MOVE_FAILED);
  });
});
