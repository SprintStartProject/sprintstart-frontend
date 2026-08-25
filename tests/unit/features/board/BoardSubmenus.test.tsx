import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BoardGrid } from "../../../../src/features/board/components/BoardGrid";
import type { Board, BoardCard, BoardCardContent } from "../../../../src/features/board/types";

vi.mock("../../../../src/features/buddy/aiBuddyBus", () => ({
  openAiBuddy: vi.fn(),
}));

import { openAiBuddy } from "../../../../src/features/buddy/aiBuddyBus";

function board(cards: BoardCardContent[]): Board {
  return {
    boardId: "b1",
    projectId: "p1",
    cards: cards.map((content, index): BoardCard => ({
      id: `c${index}`,
      kind: content.kind,
      owner: "AI",
      position: index,
      placedAt: null,
      content,
    })),
  };
}

/** The draft the last "ask the buddy" control put in the composer. */
function lastDraft(): string {
  const calls = vi.mocked(openAiBuddy).mock.calls;
  return calls[calls.length - 1][0]?.draft ?? "";
}

describe("taking a card into the conversation", () => {
  beforeEach(() => vi.mocked(openAiBuddy).mockReset());

  it("seeds the composer rather than sending, so the question stays the hire own", () => {
    render(
      <BoardGrid
        board={board([
          {
            kind: "COMPETENCY_PROGRESS",
            held: [{ competencyKey: "kotlin", label: "Kotlin", level: 3, targetLevel: 2 }],
            inProgress: [],
          },
        ])}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /ask your buddy about this/i }));

    // Pre-filled, not sent: a card that speaks for somebody is a card they stop trusting.
    expect(openAiBuddy).toHaveBeenCalledTimes(1);
    expect(lastDraft()).toMatch(/where do I stand/i);
  });

  it("a stalled path asks about the thing that is actually stuck", () => {
    render(
      <BoardGrid
        board={board([
          {
            kind: "PATH_TO_FIRST_CONTRIBUTION",
            moments: [],
            acceptedCount: 0,
            autonomyReachedAt: null,
            stalledReason: "no response in 5 days",
          },
        ])}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /ask your buddy about this/i }));

    expect(lastDraft()).toContain("no response in 5 days");
  });

  it("claiming a suggested task goes through the buddy, not around the confirm gate", () => {
    render(
      <BoardGrid
        board={board([
          {
            kind: "SUGGESTED_TASKS",
            tasks: [
              {
                taskId: "t1",
                title: "Fix the flaky login test",
                url: null,
                reasons: [],
              },
            ],
          },
        ])}
      />,
    );

    // No claim button on the card: claiming changes what the hire's whole plan aims at.
    expect(screen.queryByRole("button", { name: /^claim/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /i want to work on this/i }));
    expect(lastDraft()).toContain("Fix the flaky login test");
  });

  it("the current-task card asks how to start, which is what offers the orientation packet", () => {
    render(
      <BoardGrid
        board={board([
          {
            kind: "CURRENT_TASK",
            taskId: "t1",
            title: "Fix the flaky login test",
            summary: null,
            url: null,
            chosen: true,
          },
        ])}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /ask your buddy about this/i }));

    expect(lastDraft()).toMatch(/how do I get started/i);
  });

  it("offers nothing to ask about pull requests it cannot attribute", () => {
    render(
      <BoardGrid
        board={board([{ kind: "OPEN_PULL_REQUESTS", pullRequests: [], attributionMissing: true }])}
      />,
    );

    // The hire fixes that on their profile; asking the buddy would not help.
    expect(
      screen.queryByRole("button", { name: /ask your buddy about this/i }),
    ).not.toBeInTheDocument();
  });
});

describe("the cards the mentor places about progress", () => {
  beforeEach(() => vi.mocked(openAiBuddy).mockReset());

  it("shows competencies as two lists, never as a percentage", () => {
    render(
      <BoardGrid
        board={board([
          {
            kind: "COMPETENCY_PROGRESS",
            held: [{ competencyKey: "kotlin", label: "Kotlin", level: 3, targetLevel: 2 }],
            inProgress: [{ competencyKey: "testing", label: "Testing", level: 1, targetLevel: 2 }],
          },
        ])}
      />,
    );

    expect(screen.getByText("Shown")).toBeInTheDocument();
    expect(screen.getByText("Started")).toBeInTheDocument();
    // "1 of 2" says what is left; a percentage invites reading a person as a completion figure.
    expect(screen.getByText("1 of 2")).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it("an empty record reads as the shape of a first week, not as a verdict", () => {
    render(
      <BoardGrid board={board([{ kind: "COMPETENCY_PROGRESS", held: [], inProgress: [] }])} />,
    );

    expect(screen.getByText(/normal shape of a first week/i)).toBeInTheDocument();
  });

  it("attributes the memory to the buddy and invites correction", () => {
    render(
      <BoardGrid
        board={board([
          {
            kind: "MEMORY_RECAP",
            memory: "Ada is working through the login refactor.",
            messagesRemembered: 12,
          },
        ])}
      />,
    );

    expect(screen.getByText(/login refactor/)).toBeInTheDocument();
    // The mentor's own notes, attributed — not a record presented in the app's voice.
    expect(screen.getByText(/your buddy's own notes, not a record/i)).toBeInTheDocument();
    expect(screen.getByText(/if something here is wrong, tell it/i)).toBeInTheDocument();
    expect(screen.getByText("From 12 messages so far")).toBeInTheDocument();
  });

  it("says plainly when the buddy remembers nothing yet", () => {
    render(
      <BoardGrid board={board([{ kind: "MEMORY_RECAP", memory: null, messagesRemembered: 0 }])} />,
    );

    expect(
      screen.getByText(/starts remembering after your first conversation/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start a conversation/i })).toBeInTheDocument();
  });
});
