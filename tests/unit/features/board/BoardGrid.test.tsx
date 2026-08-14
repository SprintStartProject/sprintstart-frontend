import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BoardGrid } from "../../../../src/features/board/components/BoardGrid";
import type {
  Board,
  BoardCard,
  CurrentTaskContent,
  OpenPullRequestsContent,
  PathToFirstContributionContent,
  SuggestedTasksContent,
} from "../../../../src/features/board/types";

const pathContent = (
  over: Partial<PathToFirstContributionContent> = {},
): PathToFirstContributionContent => ({
  kind: "PATH_TO_FIRST_CONTRIBUTION",
  moments: [
    { key: "JOINED", reachedAt: "2026-07-20T09:00:00Z" },
    { key: "TASK_CLAIMED", reachedAt: null },
    { key: "WORK_SUBMITTED", reachedAt: null },
    { key: "FIRST_RESPONSE", reachedAt: null },
    { key: "WORK_ACCEPTED", reachedAt: null },
  ],
  acceptedCount: 0,
  autonomyReachedAt: null,
  stalledReason: null,
  ...over,
});

const pullRequestContent = (
  over: Partial<OpenPullRequestsContent> = {},
): OpenPullRequestsContent => ({
  kind: "OPEN_PULL_REQUESTS",
  pullRequests: [],
  attributionMissing: false,
  ...over,
});

const currentTaskContent = (over: Partial<CurrentTaskContent> = {}): CurrentTaskContent => ({
  kind: "CURRENT_TASK",
  taskId: "t1",
  title: "Fix the flaky login test",
  summary: "It fails about one run in five.",
  url: null,
  chosen: true,
  ...over,
});

const suggestedTasksContent = (
  over: Partial<SuggestedTasksContent> = {},
): SuggestedTasksContent => ({
  kind: "SUGGESTED_TASKS",
  tasks: [],
  ...over,
});

function board(cards: BoardCard["content"][], placedAt: string | null = null): Board {
  return {
    boardId: "b1",
    projectId: "p1",
    cards: cards.map((content, index) => ({
      id: `c${index}`,
      kind: content.kind,
      owner: "AI",
      position: index,
      placedAt,
      content,
    })),
  };
}

describe("BoardGrid", () => {
  it("shows an unreached moment as a dash, never as a zero", () => {
    render(<BoardGrid board={board([pathContent()])} />);

    // Four moments unreached, one (joined) reached.
    expect(screen.getAllByText("—")).toHaveLength(4);
  });

  it("says nothing has been merged yet without making it sound like a failure", () => {
    render(<BoardGrid board={board([pathContent()])} />);

    expect(screen.getByText(/normal early on/i)).toBeInTheDocument();
  });

  it("counts accepted work with the plural", () => {
    render(<BoardGrid board={board([pathContent({ acceptedCount: 2 })])} />);

    expect(screen.getByText("2 changes merged")).toBeInTheDocument();
  });

  it("tells the hire about their own stall, and points at a person", () => {
    render(<BoardGrid board={board([pathContent({ stalledReason: "no response in 5 days" })])} />);

    expect(screen.getByText(/no response in 5 days/)).toBeInTheDocument();
    // Points at a person rather than leaving the hire with a diagnosis they cannot act on.
    expect(screen.getByText(/a person unblocks in a minute/i)).toBeInTheDocument();
  });

  it("dates the end of onboarding rather than scoring it", () => {
    render(
      <BoardGrid board={board([pathContent({ autonomyReachedAt: "2026-07-25T09:00:00Z" })])} />,
    );

    expect(screen.getByText(/worked unsupervised here/i)).toBeInTheDocument();
  });

  it("flags a long wait as the review being outstanding, not the hire being slow", () => {
    render(
      <BoardGrid
        board={board([
          pullRequestContent({
            pullRequests: [
              {
                artifactId: "a1",
                number: 12,
                title: "Add a health endpoint",
                url: "https://example.test/pr/12",
                waitingHours: 72,
              },
            ],
          }),
        ])}
      />,
    );

    expect(screen.getByText(/waiting 3d for a first review/i)).toBeInTheDocument();
    expect(screen.getByText(/worth a nudge/i)).toBeInTheDocument();
  });

  it("says nothing about waiting once somebody has responded", () => {
    render(
      <BoardGrid
        board={board([
          pullRequestContent({
            pullRequests: [
              {
                artifactId: "a1",
                number: 12,
                title: "Add a health endpoint",
                url: null,
                waitingHours: null,
              },
            ],
          }),
        ])}
      />,
    );

    expect(screen.queryByText(/waiting/i)).not.toBeInTheDocument();
  });

  it('separates "nothing open" from "I cannot tell what is yours"', () => {
    const { rerender } = render(<BoardGrid board={board([pullRequestContent()])} />);
    expect(screen.getByText(/nothing open right now/i)).toBeInTheDocument();

    rerender(<BoardGrid board={board([pullRequestContent({ attributionMissing: true })])} />);
    expect(screen.getByText(/no github username on your profile/i)).toBeInTheDocument();
  });

  it("renders an unknown card kind visibly rather than dropping it", () => {
    const unknown = { kind: "SOMETHING_NEWER" } as unknown as BoardCard["content"];

    render(<BoardGrid board={board([unknown])} />);

    // A card that silently vanishes is indistinguishable from one never placed.
    expect(screen.getByText(/needs a newer version/i)).toBeInTheDocument();
  });

  it("claims the buddy added a card only when the buddy actually placed it", () => {
    const { rerender } = render(<BoardGrid board={board([pathContent()])} />);
    expect(screen.getByText("Kept for you")).toBeInTheDocument();
    expect(screen.queryByText("Buddy added this")).not.toBeInTheDocument();

    rerender(<BoardGrid board={board([pathContent()], "2026-07-27T09:00:00Z")} />);
    // Attribution the hire cannot check is attribution they cannot trust, so the stronger
    // label is reserved for cards that carry a placement.
    expect(screen.getByText("Buddy added this")).toBeInTheDocument();
  });

  it("offers to remove a card, and says the buddy will not put it back", () => {
    const onDismiss = vi.fn();
    render(<BoardGrid board={board([pathContent()])} onDismiss={onDismiss} />);

    const remove = screen.getByRole("button", { name: /remove the your path here card/i });
    expect(remove).toHaveAttribute("title", expect.stringMatching(/won't put it back/i));

    fireEvent.click(remove);
    expect(onDismiss).toHaveBeenCalledWith("c0");
  });

  it("has no remove control when removing is not offered", () => {
    render(<BoardGrid board={board([pathContent()])} />);

    expect(screen.queryByRole("button", { name: /remove the/i })).not.toBeInTheDocument();
  });

  it("separates a task the hire picked from one they were handed", () => {
    const { rerender } = render(
      <BoardGrid board={board([currentTaskContent({ chosen: true })])} />,
    );
    expect(screen.getByText("You picked this one")).toBeInTheDocument();

    rerender(<BoardGrid board={board([currentTaskContent({ chosen: false })])} />);
    // Only one of the two is theirs to change their mind about.
    expect(screen.getByText("Handed to you as a first task")).toBeInTheDocument();
  });

  it("keeps the current-task card when there is no task, and says so", () => {
    render(
      <BoardGrid
        board={board([currentTaskContent({ taskId: null, title: null, summary: null })])}
      />,
    );

    // Vanishing when the goal is cleared would read as the board losing things.
    expect(screen.getByText(/nothing claimed yet/i)).toBeInTheDocument();
  });

  it("shows why each task was suggested, and never a score", () => {
    render(
      <BoardGrid
        board={board([
          suggestedTasksContent({
            tasks: [
              {
                taskId: "t1",
                title: "Fix the flaky login test",
                url: null,
                reasons: ["You have worked in this repository before"],
              },
            ],
          }),
        ])}
      />,
    );

    expect(screen.getByText(/you have worked in this repository before/i)).toBeInTheDocument();
    expect(screen.getByText("Best fit first")).toBeInTheDocument();
  });

  it("explains an empty suggestions card as a PM step, not a dead end", () => {
    render(<BoardGrid board={board([suggestedTasksContent()])} />);

    expect(screen.getByText(/your pm approves the ones that fit your role/i)).toBeInTheDocument();
  });
});
