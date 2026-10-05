import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { NoteMarkdown } from "../../../../src/features/board/components/NoteMarkdown";
import { StepLinkTextarea } from "../../../../src/features/board/components/StepLinkTextarea";
import { BoardPathContext } from "../../../../src/features/board/hooks/boardPath";
import { isCardAt, pathPhases, pathStages } from "../../../../src/features/board/layout/pathStages";
import {
  completeLink,
  linkedTitles,
  openLinkBefore,
  splitStepLinks,
} from "../../../../src/features/board/layout/stepLinks";
import type { BoardCard } from "../../../../src/features/board/types";
import type { OnboardingPathEndpoint } from "../../../../src/features/onboarding/types";

const path = {
  id: "path",
  phases: [
    {
      id: "p1",
      title: "Setup",
      position: 1,
      steps: [{ id: "s1", title: "Set up SSH", status: "IN_PROGRESS", position: 0 }],
      questions: [],
    },
    {
      id: "p2",
      title: "Ship",
      position: 2,
      locked: true,
      steps: [{ id: "s2", title: "Open your first PR", status: "WAITING", position: 0 }],
      questions: [],
    },
  ],
} as unknown as OnboardingPathEndpoint;
const phases = pathPhases(path);

const note = (id: string, text: string) =>
  ({
    id,
    kind: "NOTE",
    owner: "HIRE",
    position: 0,
    placedAt: null,
    content: { kind: "NOTE", text },
  }) as BoardCard;

describe("[[step]] links in a note", () => {
  it("are read out of the text", () => {
    expect(splitStepLinks("See [[Set up SSH]] first")).toEqual([
      { text: "See ", link: false },
      { text: "Set up SSH", link: true },
      { text: " first", link: false },
    ]);
    expect(linkedTitles("[[a]] and [[ b ]]")).toEqual(["a", "b"]);
  });

  it("tie the note to the step they name, case aside", () => {
    const card = note("n", "Ask Sam before [[open your first pr]]");

    expect(pathStages(phases, {})(card)).toBe("LATER");
    expect(isCardAt(card, { kind: "step", id: "s2" }, phases, {})).toBe(true);
    expect(isCardAt(card, { kind: "step", id: "s1" }, phases, {})).toBe(false);
  });

  it("are completed from what is typed after [[", () => {
    expect(openLinkBefore("note [[set", 10)).toEqual({ query: "set", start: 5 });
    expect(openLinkBefore("note [[set]] done", 17)).toBeNull();
    expect(completeLink("x [[se]] y", 6, "Set up SSH")).toEqual({
      text: "x [[Set up SSH]] y",
      caret: 16,
    });
  });
});

describe("drawing and writing them", () => {
  it("draws a link as the step, and an unknown title as plain text", () => {
    render(
      <MemoryRouter>
        <BoardPathContext.Provider value={{ path, phases }}>
          <NoteMarkdown
            text={"## Plan\n- do [[Set up SSH]]\n- then [[Nope]]"}
            marks={[]}
            cardId="n"
          />
        </BoardPathContext.Provider>
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Set up SSH" })).toHaveAttribute(
      "href",
      "/onboarding?step=s1&open=1",
    );
    expect(screen.queryByRole("link", { name: "Nope" })).not.toBeInTheDocument();
    expect(screen.getByText("Nope")).toBeInTheDocument();
  });

  it("offers the path's steps after [[ and fills one in", async () => {
    function Editor() {
      const [value, setValue] = useState("");
      return (
        <BoardPathContext.Provider value={{ path, phases }}>
          <StepLinkTextarea aria-label="Note" value={value} onValueChange={setValue} />
          <output>{value}</output>
        </BoardPathContext.Provider>
      );
    }
    render(<Editor />);

    await userEvent.type(screen.getByLabelText("Note"), "Before [[[[first");
    expect(screen.getByRole("option", { name: /open your first pr/i })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /set up ssh/i })).not.toBeInTheDocument();

    await userEvent.keyboard("{Enter}");
    expect(screen.getByRole("status")).toHaveTextContent("Before [[Open your first PR]]");
  });
});
