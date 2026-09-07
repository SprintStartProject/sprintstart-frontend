import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { Marked } from "../../../../src/features/board/components/Marked";
import { CurrentTaskCard } from "../../../../src/features/board/components/CurrentTaskCard";
import { SuggestedTasksCard } from "../../../../src/features/board/components/SuggestedTasksCard";
import type { CardMark } from "../../../../src/features/board/marks/cardMarks";
import type { BoardCard } from "../../../../src/features/board/types";

const marks: CardMark[] = [];

vi.mock("../../../../src/features/board/marks/useCardMarks", () => ({
  useCardMarks: () => ({
    canMark: false,
    marksFor: () => marks,
    mark: () => {},
    unmark: () => {},
    labels: {},
  }),
}));

const card: Pick<BoardCard, "id" | "owner" | "placedAt"> = {
  id: "c1",
  owner: "AI",
  placedAt: null,
};

/** What is painted, in the order it appears. */
function highlighted(): string[] {
  return screen.queryAllByRole("mark").map((node) => node.textContent ?? "");
}

function setMarks(next: CardMark[]) {
  marks.length = 0;
  marks.push(...next);
}

describe("highlights on a card the board re-reads", () => {
  it("paints every occurrence, because a mark is only ever matched by its words", () => {
    render(
      <Marked
        text="deploy on Thursday, never deploy on Friday"
        marks={[{ text: "deploy", color: "yellow" }]}
      />,
    );

    // Not just the first: this text is composed again on every board read, so "the one they meant"
    // is not a question the stored words can answer.
    expect(highlighted()).toEqual(["deploy", "deploy"]);
  });

  it("lets the longer of two overlapping marks win rather than cutting it in half", () => {
    render(
      <Marked
        text="ask the platform team about this"
        marks={[
          { text: "team", color: "blue" },
          { text: "the platform team", color: "green" },
        ]}
      />,
    );

    expect(highlighted()).toEqual(["the platform team"]);
  });

  it("draws text nobody marked exactly as it was", () => {
    render(<Marked text="nothing marked here" marks={[]} />);

    expect(highlighted()).toEqual([]);
    expect(screen.getByText("nothing marked here")).toBeInTheDocument();
  });

  it("marks what the hire highlighted on the task they are on", () => {
    setMarks([{ text: "behind a feature flag", color: "pink" }]);

    render(
      <CurrentTaskCard
        content={{
          kind: "CURRENT_TASK",
          taskId: "t1",
          title: "Ship the importer",
          summary: "Roll it out behind a feature flag first.",
          url: null,
          chosen: true,
        }}
        card={card}
      />,
    );

    expect(highlighted()).toEqual(["behind a feature flag"]);
  });

  it("marks a reason a task was suggested, not only the title", () => {
    setMarks([{ text: "you have not touched the parser yet", color: "green" }]);

    render(
      <SuggestedTasksCard
        content={{
          kind: "SUGGESTED_TASKS",
          tasks: [
            {
              taskId: "t1",
              title: "Fix the parser's error message",
              url: null,
              reasons: ["you have not touched the parser yet"],
            },
          ],
        }}
        card={card}
      />,
    );

    expect(highlighted()).toEqual(["you have not touched the parser yet"]);
  });
});
