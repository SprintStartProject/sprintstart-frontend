import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { NoteMarkdown } from "../../../../src/features/board/components/NoteMarkdown";
import { StepLinkTextarea } from "../../../../src/features/board/components/StepLinkTextarea";
import { BoardPathContext } from "../../../../src/features/board/hooks/boardPath";
import {
  isCardAt,
  leadsOntoPath,
  pathPhases,
  pathStages,
  resolveLink,
} from "../../../../src/features/board/layout/pathStages";
import {
  completeLink,
  deepenLink,
  linkedTitles,
  openLinkBefore,
  splitStepLinks,
} from "../../../../src/features/board/layout/stepLinks";
import type { BoardCard } from "../../../../src/features/board/types";
import type { OnboardingPathEndpoint } from "../../../../src/features/onboarding/types";
import { onboardingService } from "../../../../src/services/onboardingService";

const path = {
  id: "path",
  phases: [
    {
      id: "p1",
      title: "Setup",
      position: 1,
      steps: [{ id: "s1", title: "Set up SSH", status: "FINISHED", position: 0 }],
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

function Editor() {
  const [value, setValue] = useState("");
  return (
    <BoardPathContext.Provider value={{ path, phases }}>
      <StepLinkTextarea aria-label="Note" value={value} onValueChange={setValue} />
      <output>{value}</output>
    </BoardPathContext.Provider>
  );
}

describe("[[Phase#Step]] links in a note", () => {
  it("are read out of the text", () => {
    expect(splitStepLinks("See [[Setup#Set up SSH]] first")).toEqual([
      { text: "See ", link: false },
      { text: "Setup#Set up SSH", link: true },
      { text: " first", link: false },
    ]);
    expect(linkedTitles("[[a]] and [[ b ]]")).toEqual(["a", "b"]);
  });

  it("resolve phase first, then a step in it, then a task in that", () => {
    expect(resolveLink("setup", phases)).toEqual({ phaseId: "p1", stepId: null, task: null });
    expect(resolveLink("Setup#set up ssh", phases)).toEqual({
      phaseId: "p1",
      stepId: "s1",
      task: null,
    });
    expect(resolveLink("Ship#Open your first PR#Ask for review", phases)).toEqual({
      phaseId: "p2",
      stepId: "s2",
      task: "Ask for review",
    });
    expect(resolveLink("Setup#Nope", phases)).toBeNull();
  });

  it("still resolve a link written by step name alone", () => {
    expect(resolveLink("Open your first PR", phases)).toEqual({
      phaseId: "p2",
      stepId: "s2",
      task: null,
    });
  });

  it("tie the note to what they name, and the buddy's app links count too", () => {
    const linked = note("n", "Ask Sam before [[Ship#open your first pr]]");

    expect(isCardAt(linked, { kind: "step", id: "s2" }, phases, {})).toBe(true);
    expect(pathStages(phases, {})(note("old", "[[Setup]]"))).toBe("BEHIND");
    expect(
      isCardAt(note("u", "Try [#3](/onboarding?step=s2)"), { kind: "step", id: "s2" }, phases, {}),
    ).toBe(true);
  });

  it("are completed, or gone into, from what is typed after [[", () => {
    expect(openLinkBefore("note [[set", 10)).toEqual({ query: "set", start: 5 });
    expect(openLinkBefore("note [[set]] done", 17)).toBeNull();
    expect(completeLink("x [[se]] y", 6, "Setup")).toEqual({ text: "x [[Setup]] y", caret: 11 });
    expect(deepenLink("x [[se", 6, "Setup")).toEqual({ text: "x [[Setup#", caret: 10 });
  });
});

describe("drawing and writing them", () => {
  it("draws phases, steps and tasks as chips, and an unknown name as plain text", () => {
    render(
      <MemoryRouter>
        <BoardPathContext.Provider value={{ path, phases }}>
          <NoteMarkdown
            text={
              "## Plan\n- [[Setup]]\n- [[Setup#Set up SSH]]\n- [[Setup#Set up SSH#Generate a key]]\n- [#3](/onboarding?step=s2)\n- [[Nope]]"
            }
            marks={[]}
            cardId="n"
          />
        </BoardPathContext.Provider>
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Setup" })).toHaveAttribute(
      "href",
      "/onboarding?phase=p1",
    );
    expect(screen.getByRole("link", { name: "Set up SSH" })).toHaveAttribute(
      "href",
      "/onboarding?step=s1&open=1",
    );
    expect(screen.getByRole("link", { name: /generate a key/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open your first PR" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Nope" })).not.toBeInTheDocument();
    expect(screen.getByText("Nope")).toBeInTheDocument();
  });

  it("reads a link that leads nowhere as what it named last, and keeps the buddy's words", () => {
    render(
      <MemoryRouter>
        <BoardPathContext.Provider value={{ path: null, phases: null, settled: true }}>
          <NoteMarkdown
            text={"- [[Setup#Set up SSH#Generate a key]]\n- [Set up SSH](/onboarding?step=gone)"}
            marks={[]}
            cardId="n"
          />
        </BoardPathContext.Provider>
      </MemoryRouter>,
    );

    expect(screen.getByText("Generate a key")).toHaveAttribute(
      "title",
      "Setup › Set up SSH › Generate a key — not on your path any more",
    );
    expect(screen.getByText("Set up SSH")).toBeInTheDocument();
    expect(screen.queryByText("a step")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("knows which ways back still lead onto the path", () => {
    expect(leadsOntoPath("/onboarding?step=s1&open=1", phases)).toBe(true);
    expect(leadsOntoPath("/onboarding?step=gone", phases)).toBe(false);
    expect(leadsOntoPath("/onboarding?phase=p2", phases)).toBe(true);
    expect(leadsOntoPath("/onboarding?step=s1", null)).toBe(false);
    expect(leadsOntoPath("/chat/1", null)).toBe(true);
  });

  it("offers phases after [[, a phase's steps after Tab, and links one with Enter", async () => {
    render(<Editor />);

    await userEvent.type(screen.getByLabelText("Note"), "Before [[[[");
    expect(screen.getByRole("option", { name: /setup/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /ship.*locked/i })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Note"), "sh");
    expect(screen.queryByRole("option", { name: /setup/i })).not.toBeInTheDocument();

    await userEvent.keyboard("{Tab}");
    expect(screen.getByRole("status")).toHaveTextContent("Before [[Ship#");
    expect(screen.getByRole("option", { name: /open your first pr/i })).toBeInTheDocument();

    await userEvent.keyboard("{Enter}");
    expect(screen.getByRole("status")).toHaveTextContent("Before [[Ship#Open your first PR]]");
  });

  it("offers a step's tasks after [[Phase#Step#, fetched for that step", async () => {
    const fetchTasks = vi.spyOn(onboardingService, "fetchTasks").mockResolvedValue([
      {
        id: "t1",
        stepId: "s1",
        position: 0,
        title: "Generate a key",
        description: "",
        finished: false,
      },
    ]);
    render(<Editor />);

    await userEvent.type(screen.getByLabelText("Note"), "[[[[Setup#Set up SSH#gen");
    expect(await screen.findByRole("option", { name: /generate a key/i })).toBeInTheDocument();
    expect(fetchTasks).toHaveBeenCalledWith("s1");

    await userEvent.keyboard("{Enter}");
    expect(screen.getByRole("status")).toHaveTextContent("[[Setup#Set up SSH#Generate a key]]");
  });
});
