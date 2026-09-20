import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { PathStepCard } from "../../../../src/features/board/components/PathStepCard";
import { boardService } from "../../../../src/services/boardService";
import type { BoardCard, PathStepContent } from "../../../../src/features/board/types";

vi.mock("../../../../src/services/boardService", () => ({
  boardService: { tickPathStepTask: vi.fn() },
}));

const tickPathStepTask = vi.mocked(boardService.tickPathStepTask);

const card: Pick<BoardCard, "id" | "owner" | "placedAt"> = {
  id: "card-1",
  owner: "AI",
  placedAt: "2026-07-27T10:00:00Z",
};

const content = (over: Partial<PathStepContent> = {}): PathStepContent => ({
  kind: "PATH_STEP",
  stepId: "step-1",
  phaseTitle: "Getting oriented",
  title: "Set up your local environment",
  description: "Install the tools you need and get the project running.",
  status: "IN_PROGRESS",
  isAiAssisted: true,
  expectedOutcomes: ["You can run the project locally"],
  tasks: [
    {
      id: "task-2",
      stepId: "step-1",
      position: 2,
      title: "Run the seed script",
      description: "",
      finished: false,
    },
    {
      id: "task-1",
      stepId: "step-1",
      position: 1,
      title: "Clone the repo",
      description: "git clone the project and open it in your editor",
      finished: false,
    },
  ],
  resources: [
    {
      id: "resource-1",
      stepId: "step-1",
      title: "Setup guide",
      description: "The onboarding doc",
      url: "https://example.test/setup",
    },
  ],
  reason: null,
  ...over,
});

function renderCard(over: Partial<PathStepContent> = {}) {
  return render(
    <MemoryRouter>
      <PathStepCard content={content(over)} card={card} />
    </MemoryRouter>,
  );
}

describe("PathStepCard", () => {
  beforeEach(() => {
    tickPathStepTask.mockReset();
  });

  it("shows the title, ordered tasks, expected outcomes and resources", () => {
    renderCard();

    expect(screen.getByText("Set up your local environment")).toBeInTheDocument();

    // Position order, not wire order: "Clone the repo" is position 1 and comes first even
    // though the fixture lists "Run the seed script" (position 2) ahead of it.
    const taskNames = screen
      .getAllByRole("checkbox")
      .map((checkbox) => checkbox.getAttribute("aria-label"));
    expect(taskNames).toEqual(["Clone the repo", "Run the seed script"]);

    expect(screen.getByText("You can run the project locally")).toBeInTheDocument();
    expect(screen.getByText("Setup guide")).toBeInTheDocument();
  });

  it("names every task's checkbox by the task's own title", () => {
    renderCard();

    expect(screen.getByRole("checkbox", { name: "Clone the repo" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Run the seed script" })).toBeInTheDocument();
  });

  it("links to the full step", () => {
    renderCard();

    expect(screen.getByRole("link", { name: /Open the full step/ })).toHaveAttribute(
      "href",
      "/onboarding/step-1",
    );
  });

  it("ticks a task immediately and writes it back through the board's own endpoint", async () => {
    tickPathStepTask.mockResolvedValue(content());

    renderCard();
    const checkbox = screen.getByRole("checkbox", { name: "Clone the repo" });
    fireEvent.click(checkbox);

    expect(checkbox).toHaveAttribute("aria-checked", "true");
    await waitFor(() => {
      expect(tickPathStepTask).toHaveBeenCalledWith("card-1", "task-1", true);
    });
  });

  it("springs the box back and says so when the write fails", async () => {
    tickPathStepTask.mockRejectedValue(new Error("offline"));

    renderCard();
    const checkbox = screen.getByRole("checkbox", { name: "Clone the repo" });
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(screen.getByText(/didn't save/i)).toBeInTheDocument();
    });
    expect(checkbox).toHaveAttribute("aria-checked", "false");
  });

  it("ignores a second click on a task while its tick is still in flight", () => {
    let release: (value: PathStepContent) => void = () => {};
    tickPathStepTask.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );

    renderCard();
    const checkbox = screen.getByRole("checkbox", { name: "Clone the repo" });
    fireEvent.click(checkbox);
    fireEvent.click(checkbox);
    fireEvent.click(checkbox);

    expect(tickPathStepTask).toHaveBeenCalledTimes(1);
    release(content());
  });

  it("shows the reason and offers no checkboxes or link once the step is gone", () => {
    renderCard({ reason: "This step is no longer on the hire's path." });

    expect(screen.getByText("This step is no longer on the hire's path.")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Open the full step/ })).not.toBeInTheDocument();
  });
});
