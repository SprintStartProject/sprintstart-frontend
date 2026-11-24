import { describe, expect, it } from "vitest";
import {
  addActions,
  addCitation,
  appendChunk,
  appendToken,
  clearContent,
  greetingPlaceholder,
  markStopped,
  patchAction,
  setError,
  settleGreeting,
  withHistory,
  withTurn,
} from "../../../../src/features/buddy/conversation/messageReducers";
import type {
  BuddyMessage,
  BuddyMessageView,
  ProposedAction,
} from "../../../../src/features/buddy/types";

const message = (id: string, over: Partial<BuddyMessageView> = {}): BuddyMessageView => ({
  id,
  role: "ASSISTANT",
  content: "",
  createdAt: "2026-01-01T00:00:00Z",
  ...over,
});

const action = (id: string): ProposedAction => ({
  id,
  action: "claim_goal",
  label: "Work on it",
  status: "idle",
});

describe("greetingPlaceholder", () => {
  it("is an empty assistant turn marked as the greeting", () => {
    expect(greetingPlaceholder("g", "t")).toEqual({
      id: "g",
      role: "ASSISTANT",
      content: "",
      createdAt: "t",
      citations: [],
      isGreeting: true,
    });
  });
});

describe("changing one message", () => {
  const list = [message("a", { content: "x" }), message("b", { content: "y" })];

  it("appends a token to the message it names only", () => {
    const next = appendToken(list, "b", "!");

    expect(next.map((m) => m.content)).toEqual(["x", "y!"]);
    expect(next[0]).toBe(list[0]);
  });

  it("leaves the list alone when no message has the id", () => {
    expect(appendToken(list, "zzz", "!").map((m) => m.content)).toEqual(["x", "y"]);
  });

  it("appends a chunk of words and of thoughts", () => {
    const next = appendChunk([message("a", { content: "x", reasoning: "r" })], "a", {
      content: "yz",
      reasoning: "s",
    });

    expect(next[0]).toMatchObject({ content: "xyz", reasoning: "rs" });
  });

  it("starts the reasoning when the message had none, and leaves it out when the chunk has none", () => {
    const first = appendChunk([message("a")], "a", { content: "", reasoning: "r" });
    expect(first[0].reasoning).toBe("r");

    const none = appendChunk([message("a")], "a", { content: "w", reasoning: "" });
    expect(none[0]).not.toHaveProperty("reasoning");
  });

  it("throws away the words so far and keeps everything else", () => {
    const next = clearContent([message("a", { content: "x", reasoning: "r" })], "a");

    expect(next[0]).toMatchObject({ content: "", reasoning: "r" });
  });

  it("adds citations in the order they arrive", () => {
    const one = addCitation([message("a")], "a", { id: "1" } as never);
    const two = addCitation(one, "a", { id: "2" } as never);

    expect(two[0].citations?.map((c) => (c as { id: string }).id)).toEqual(["1", "2"]);
  });

  it("adds proposed actions after the ones already there", () => {
    const one = addActions([message("a")], "a", [action("p1")]);
    const two = addActions(one, "a", [action("p2")]);

    expect(two[0].actions?.map((a) => a.id)).toEqual(["p1", "p2"]);
  });

  it("marks a turn stopped", () => {
    expect(markStopped([message("a")], "a")[0].stopped).toBe(true);
  });

  it("puts the reason on a failed reply", () => {
    expect(setError([message("a")], "a", "nope")[0].error).toBe("nope");
  });
});

describe("withTurn", () => {
  it("puts the question and its empty answer at the end", () => {
    const next = withTurn([message("a")], message("u", { role: "USER" }), message("r"));

    expect(next.map((m) => m.id)).toEqual(["a", "u", "r"]);
  });
});

describe("withHistory", () => {
  const read = (over: Partial<BuddyMessage> = {}): BuddyMessage => ({
    id: "h1",
    role: "USER",
    content: "hello",
    createdAt: "t",
    ...over,
  });

  it("puts history in front of what the conversation already holds", () => {
    const next = withHistory([message("live")], [read({ id: "h1" }), read({ id: "h2" })]);

    expect(next.map((m) => m.id)).toEqual(["h1", "h2", "live"]);
  });

  it("gives a message the server did not id a local one", () => {
    const next = withHistory([], [read({ id: undefined })]);

    expect(next[0].id).toEqual(expect.any(String));
    expect(next[0].id).not.toBe("");
  });

  it("marks a lone assistant message as the greeting nobody answered", () => {
    expect(withHistory([], [read({ role: "ASSISTANT" })])[0].isGreeting).toBe(true);
  });

  it("does not mark a lone message from the hire, or a longer window", () => {
    expect(withHistory([], [read({ role: "USER" })])[0].isGreeting).toBe(false);
    expect(
      withHistory([], [read({ role: "ASSISTANT" }), read({ id: "h2", role: "ASSISTANT" })])[0]
        .isGreeting,
    ).toBe(false);
  });
});

describe("settleGreeting", () => {
  const thread = [message("earlier", { role: "USER" }), message("g", { isGreeting: true })];

  it("keeps a greeting that wrote something", () => {
    expect(settleGreeting(thread, "g", { wroteSomething: true, failure: null })).toBe(thread);
  });

  it("drops a greeting that wrote nothing and failed nothing", () => {
    const next = settleGreeting(thread, "g", { wroteSomething: false, failure: null });

    expect(next.map((m) => m.id)).toEqual(["earlier"]);
  });

  it("says why a greeting broke off after it wrote something", () => {
    const next = settleGreeting(thread, "g", { wroteSomething: true, failure: "cut" });

    expect(next.find((m) => m.id === "g")?.error).toBe("cut");
  });

  it("does not report a failed greeting under a thread the hire can already read", () => {
    const next = settleGreeting(thread, "g", { wroteSomething: false, failure: "cut" });

    expect(next.map((m) => m.id)).toEqual(["earlier"]);
  });

  it("explains an empty thread whose only message is the failed greeting", () => {
    const only = [message("g", { isGreeting: true })];

    const next = settleGreeting(only, "g", { wroteSomething: false, failure: "cut" });

    expect(next).toHaveLength(1);
    expect(next[0].error).toBe("cut");
  });
});

describe("patchAction", () => {
  const withActions = [
    message("m", { actions: [action("a1"), action("a2")] }),
    message("other", { actions: [action("a1")] }),
  ];

  it("changes the one action on the one message", () => {
    const next = patchAction(withActions, "m", "a2", { status: "confirming" });

    expect(next[0].actions?.map((a) => a.status)).toEqual(["idle", "confirming"]);
    expect(next[1].actions?.[0].status).toBe("idle");
  });

  it("leaves a message with no actions without any", () => {
    const next = patchAction([message("m")], "m", "a1", { status: "confirming" });

    expect(next[0].actions).toBeUndefined();
  });
});
