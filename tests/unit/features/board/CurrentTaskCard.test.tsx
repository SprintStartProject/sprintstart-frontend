import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { CurrentTaskCard } from "../../../../src/features/board/components/CurrentTaskCard";
import type { BoardCard, CurrentTaskContent } from "../../../../src/features/board/types";

vi.mock("../../../../src/features/board/marks/useCardMarks", () => ({
  useCardMarks: () => ({
    canMark: false,
    marksFor: () => [],
    mark: () => {},
    unmark: () => {},
    labels: {},
  }),
}));

vi.mock("../../../../src/features/buddy/aiBuddyBus", () => ({
  openAiBuddy: vi.fn(),
}));

import { openAiBuddy } from "../../../../src/features/buddy/aiBuddyBus";

const card: Pick<BoardCard, "id" | "owner" | "placedAt"> = {
  id: "c1",
  owner: "AI",
  placedAt: null,
};

function currentTaskContent(over: Partial<CurrentTaskContent> = {}): CurrentTaskContent {
  return {
    kind: "CURRENT_TASK",
    taskId: "t1",
    title: "Fix the flaky login test",
    summary: "It fails about one run in five.",
    url: null,
    closedAtSource: false,
    ...over,
  };
}

/** The draft the last "ask the buddy" control put in the composer. */
function lastDraft(): string {
  const calls = vi.mocked(openAiBuddy).mock.calls;
  return calls[calls.length - 1][0]?.draft ?? "";
}

describe("the current-task card when the issue behind it was closed", () => {
  beforeEach(() => vi.mocked(openAiBuddy).mockReset());

  it("shows the warning and points at the good-next-tasks card", () => {
    render(<CurrentTaskCard content={currentTaskContent({ closedAtSource: true })} card={card} />);

    expect(screen.getByText(/this issue was closed where it lives/i)).toBeInTheDocument();
    expect(screen.getByText(/good next tasks/i)).toBeInTheDocument();
  });

  it("keeps the card and the task on screen rather than falling back to the empty state", () => {
    render(<CurrentTaskCard content={currentTaskContent({ closedAtSource: true })} card={card} />);

    expect(screen.getByText("What you're working on")).toBeInTheDocument();
    expect(screen.getByText("Fix the flaky login test")).toBeInTheDocument();
    expect(screen.queryByText(/nothing claimed yet/i)).not.toBeInTheDocument();
  });

  it("seeds the buddy composer with a question about picking a different task", () => {
    render(<CurrentTaskCard content={currentTaskContent({ closedAtSource: true })} card={card} />);

    fireEvent.click(screen.getByRole("button", { name: /help me pick another one/i }));

    expect(lastDraft()).toContain("Fix the flaky login test");
    expect(lastDraft()).toContain("closed");
  });

  it("renders as today when the issue is still open", () => {
    render(<CurrentTaskCard content={currentTaskContent({ closedAtSource: false })} card={card} />);

    expect(screen.queryByText(/closed where it lives/i)).not.toBeInTheDocument();
    expect(screen.getByText("You picked this one")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /ask your buddy about this/i }));
    expect(lastDraft()).toMatch(/how do I get started/i);
  });

  it("still shows the empty state when there is no task, closedAtSource notwithstanding", () => {
    render(
      <CurrentTaskCard
        content={currentTaskContent({
          taskId: null,
          title: null,
          summary: null,
          closedAtSource: false,
        })}
        card={card}
      />,
    );

    expect(screen.getByText(/nothing claimed yet/i)).toBeInTheDocument();
  });
});
