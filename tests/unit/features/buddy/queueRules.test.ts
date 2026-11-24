import { describe, expect, it } from "vitest";
import {
  questionBefore,
  withQueued,
  withoutQueued,
} from "../../../../src/features/buddy/conversation/queueRules";
import type { BuddyMessageView } from "../../../../src/features/buddy/types";

const message = (id: string, role: "USER" | "ASSISTANT", content = id): BuddyMessageView => ({
  id,
  role,
  content,
  createdAt: "2026-01-01T00:00:00Z",
});

describe("withQueued", () => {
  it("adds to the back and leaves the original alone", () => {
    const queue = [{ id: "1", text: "first" }];

    const next = withQueued(queue, { id: "2", text: "second" });

    expect(next.map((item) => item.id)).toEqual(["1", "2"]);
    expect(queue).toHaveLength(1);
  });
});

describe("withoutQueued", () => {
  it("drops only the named message, wherever it stood", () => {
    const queue = [
      { id: "1", text: "a" },
      { id: "2", text: "b" },
      { id: "3", text: "c" },
    ];

    expect(withoutQueued(queue, "2").map((item) => item.id)).toEqual(["1", "3"]);
    expect(withoutQueued(queue, "missing")).toHaveLength(3);
  });
});

describe("questionBefore", () => {
  const thread = [
    message("greeting", "ASSISTANT"),
    message("q1", "USER", "first question"),
    message("a1", "ASSISTANT"),
    message("q2", "USER", "second question"),
    message("a2", "ASSISTANT"),
  ];

  it("finds the hire's message nearest above the reply", () => {
    expect(questionBefore(thread, "a1")).toBe("first question");
    expect(questionBefore(thread, "a2")).toBe("second question");
  });

  it("skips other assistant turns between the question and the reply", () => {
    const withExtra = [
      message("q", "USER", "ask"),
      message("x", "ASSISTANT"),
      message("y", "ASSISTANT"),
    ];

    expect(questionBefore(withExtra, "y")).toBe("ask");
  });

  it("has nothing to re-ask for a reply with no question above it", () => {
    expect(questionBefore(thread, "greeting")).toBeNull();
  });

  it("has nothing for a reply that is not in the thread", () => {
    expect(questionBefore(thread, "missing")).toBeNull();
  });

  it("does not mistake a question below the reply for its own", () => {
    expect(questionBefore([message("a", "ASSISTANT"), message("q", "USER")], "a")).toBeNull();
  });
});
