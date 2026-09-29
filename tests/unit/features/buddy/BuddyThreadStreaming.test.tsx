import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { BuddyThread } from "../../../../src/features/buddy/components/BuddyThread";
import type { BuddyMessageView } from "../../../../src/features/buddy/types";

/**
 * Who counts as "receiving tokens right now" — the flag the thread hands down to its rows.
 *
 * It drives the bot beside a reply: `BuddyMessage` passes it on as `SleepyBot`'s
 * `canSleep={!isStreaming}`, and a bot held awake for its whole life never does the thing it is
 * named for. The thread used to answer "is this the newest message?" rather than "is this the live
 * turn?" — the same answer only while a turn is actually running — so the newest reply's bot never
 * slept. The chat draws the line correctly in its `MessageRow` (`streamingMessageId` is null when
 * idle); this is the buddy's version of it.
 */
vi.mock("../../../../src/features/buddy/components/BuddyMessage", () => ({
  // Stands in for the bubble so the flag it receives is readable from the DOM: the subject here
  // is that flag, and the bot that reads it (`SleepyBot`'s `canSleep`) is three components down.
  BuddyMessage: ({
    speaker,
    children,
    isStreaming,
  }: {
    speaker: string;
    children?: ReactNode;
    isStreaming?: boolean;
  }) => (
    <div
      data-testid="buddy-row"
      data-speaker={speaker}
      data-streaming={String(Boolean(isStreaming))}
    >
      {children}
    </div>
  ),
}));

const MESSAGES: BuddyMessageView[] = [
  { id: "u1", role: "USER", content: "what is left?", createdAt: "2026-08-03T00:00:00Z" },
  { id: "a1", role: "ASSISTANT", content: "Two things.", createdAt: "2026-08-03T00:00:01Z" },
  { id: "u2", role: "USER", content: "which two?", createdAt: "2026-08-03T00:00:02Z" },
  {
    id: "a2",
    role: "ASSISTANT",
    content: "The packet and the review.",
    createdAt: "2026-08-03T00:00:03Z",
  },
];

const BASE_PROPS = {
  messages: MESSAGES,
  isThinking: false,
  activeTool: null,
  confirmAction: vi.fn(),
  dismissAction: vi.fn(),
  actionDrafts: {},
  setActionDraft: vi.fn(),
};

/** One flag per row, in the order they are on screen. */
function streamingFlags(): string[] {
  return screen.getAllByTestId("buddy-row").map((row) => row.getAttribute("data-streaming") ?? "?");
}

describe("the thread's streaming flag", () => {
  it("flags nothing while the conversation is at rest — the newest reply included", () => {
    render(<BuddyThread {...BASE_PROPS} isStreaming={false} />);

    // Being last is not being live. The newest reply's bot is as free to doze off as the first
    // one's; anything else is a bubble that is visibly working forever.
    expect(streamingFlags()).toEqual(["false", "false", "false", "false"]);
  });

  it("flags only the live turn, and only while it is live", () => {
    const { rerender } = render(<BuddyThread {...BASE_PROPS} isStreaming={false} />);

    rerender(<BuddyThread {...BASE_PROPS} isStreaming />);

    // The reply the tokens are landing in is the one held awake — and only that one.
    expect(streamingFlags()).toEqual(["false", "false", "false", "true"]);

    rerender(<BuddyThread {...BASE_PROPS} isStreaming={false} />);

    // And it is released the moment the turn ends: the bot settles back into the thread.
    expect(streamingFlags()).toEqual(["false", "false", "false", "false"]);
  });
});
