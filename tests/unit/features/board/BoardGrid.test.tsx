import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BoardGrid } from "../../../../src/features/board/components/BoardGrid";
import type { BoardStage, CardState } from "../../../../src/features/board/layout/boardStructure";
import type { CardStack } from "../../../../src/features/board/layout/cardStacks";
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
    // The mark is an icon in the header; the sentence lives in its screen-reader text, which is
    // what this asserts on — the fact is what matters, not how wide it is drawn.
    const { rerender } = render(<BoardGrid board={board([pathContent()])} />);
    expect(screen.getByText("Kept up to date for you")).toBeInTheDocument();
    expect(screen.queryByText("Your buddy added this card")).not.toBeInTheDocument();

    rerender(<BoardGrid board={board([pathContent()], "2026-07-27T09:00:00Z")} />);
    // Attribution the hire cannot check is attribution they cannot trust, so the stronger
    // label is reserved for cards that carry a placement.
    expect(screen.getByText("Your buddy added this card")).toBeInTheDocument();
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

describe("the stage bands", () => {
  /** Every card open, in the stage it is given, keyed the way the grid reads them. */
  function states(...stages: BoardStage[]): Map<string, CardState> {
    return new Map(
      stages.map((stage, index) => [
        `c${index}`,
        {
          status: "OPEN",
          stage,
          blockedBy: [],
          predecessorId: null,
          predecessorSource: null,
          progress: null,
        },
      ]),
    );
  }

  const twoStages = () => board([currentTaskContent(), suggestedTasksContent()]);

  it("files the board under its stages and counts what is left in each", () => {
    render(
      <BoardGrid
        board={twoStages()}
        states={states("NOW", "LATER")}
        openStages={new Set<BoardStage>(["NOW", "LATER"])}
        onToggleStage={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /now/i })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: /later/i })).toBeInTheDocument();
  });

  it("folds a band without taking it off the page", () => {
    render(
      <BoardGrid
        board={twoStages()}
        states={states("NOW", "LATER")}
        openStages={new Set<BoardStage>(["NOW"])}
        onToggleStage={vi.fn()}
      />,
    );

    // The heading still says what is filed under it — a fold is not a disappearance, which is the
    // whole difference between this and the focus mode it replaced.
    const later = screen.getByRole("button", { name: /later/i });
    expect(later).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Fix the flaky login test")).toBeInTheDocument();
  });

  it("draws no bands at all when everything sits in one stage", () => {
    render(
      <BoardGrid
        board={twoStages()}
        states={states("NOW", "NOW")}
        openStages={new Set<BoardStage>(["NOW"])}
        onToggleStage={vi.fn()}
      />,
    );

    // One band is a heading over the whole board saying what the board already says.
    expect(screen.queryByRole("button", { name: /^now/i })).not.toBeInTheDocument();
  });

  it("folds an area's own stages inside it rather than filing the area under one", () => {
    render(
      <BoardGrid
        board={twoStages()}
        groups={[{ id: "g1", name: "From your team", cardIds: ["c0", "c1"], collapsed: false }]}
        states={states("NOW", "LATER")}
        openStages={new Set<BoardStage>(["NOW", "LATER"])}
        onToggleStage={vi.fn()}
      />,
    );

    // A team's blueprints are one set somebody wrote in one sitting, deliberately spread across
    // the stages. It keeps its name and folds by stage within itself.
    expect(screen.getByText("From your team")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /now/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /later/i })).toBeInTheDocument();
  });

  it("lays the board out flat while it is being arranged", () => {
    render(
      <BoardGrid
        board={twoStages()}
        states={states("NOW", "LATER")}
        openStages={new Set<BoardStage>(["NOW"])}
        onToggleStage={vi.fn()}
        isArranging
      />,
    );

    // Arranging is about the board's own order; a fold hiding a third of it mid-drag would be the
    // surface arguing with the gesture.
    expect(screen.queryByRole("button", { name: /^later/i })).not.toBeInTheDocument();
  });
});

describe("a closed pile", () => {
  const chain: CardStack = {
    rootId: "c0",
    memberIds: ["c0", "c1"],
    topId: "c0",
    remaining: 2,
    members: new Map([
      ["c0", { name: "Fix the flaky login test", kind: "CURRENT_TASK" as const }],
      ["c1", { name: "Read the runbook", kind: "NOTE" as const }],
    ]),
  };

  /** The board as the page hands it over: the members behind the top card are folded away. */
  const closed = (onToggleStack = vi.fn()) => {
    render(
      <BoardGrid
        board={board([currentTaskContent()])}
        stacks={new Map([["c0", chain] as const])}
        expandedStackIds={new Set()}
        onToggleStack={onToggleStack}
      />,
    );

    return onToggleStack;
  };

  it("names the card behind the top one instead of only counting it", () => {
    closed();

    // "There are two more" is a worse answer than saying what the next one is — a pile that only
    // admitted to a count made you open it to find out whether it was worth opening. The name
    // comes off the stack, because the card itself is folded away and not on this board at all.
    expect(screen.getByText("Read the runbook")).toBeInTheDocument();
  });

  it("shows what kind of card is underneath, not just its name", () => {
    closed();

    // A name with the right glyph beside it is recognisable a good deal faster than a name alone,
    // and the strip is the one place the card itself is not there to draw its own.
    const strip = screen.getByText("Read the runbook").closest("button");

    expect(strip?.querySelector("svg")).toBeInTheDocument();
  });

  it("opens the pile when the named card behind it is pressed", () => {
    const onToggleStack = closed();

    fireEvent.click(screen.getByText("Read the runbook"));

    expect(onToggleStack).toHaveBeenCalledWith("c0");
  });
});
