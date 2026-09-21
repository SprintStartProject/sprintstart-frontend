import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
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
    <MemoryRouter initialEntries={["/board"]}>
      <Routes>
        <Route path="/board" element={<PathStepCard content={content(over)} card={card} />} />
        <Route path="/onboarding/:stepId" element={<p>The full step page</p>} />
      </Routes>
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

  it("opens the full step from its header button", () => {
    renderCard();

    fireEvent.click(screen.getByRole("button", { name: "Open the full step" }));

    expect(screen.getByText("The full step page")).toBeInTheDocument();
  });

  it("ticks a task immediately and writes it back through the board's own endpoint", async () => {
    tickPathStepTask.mockResolvedValue(undefined);

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

  it("ignores a second click on a task while its tick is still in flight", async () => {
    let release: (value: void) => void = () => {};
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

    // The three clicks above land on true, false, true — the same value already in flight — so
    // settling it should not re-issue a fourth call.
    await act(async () => {
      release();
      await Promise.resolve();
    });
    expect(tickPathStepTask).toHaveBeenCalledTimes(1);
  });

  it("re-issues a tick once the in-flight write settles if a later click disagreed with it", async () => {
    let release: (value: void) => void = () => {};
    tickPathStepTask.mockReturnValueOnce(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    tickPathStepTask.mockResolvedValueOnce(undefined);

    renderCard();
    const checkbox = screen.getByRole("checkbox", { name: "Clone the repo" });
    fireEvent.click(checkbox); // -> true, in flight
    fireEvent.click(checkbox); // -> false, queued while true is in flight

    expect(tickPathStepTask).toHaveBeenCalledTimes(1);

    await act(async () => {
      release();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(tickPathStepTask).toHaveBeenCalledTimes(2);
    });
    expect(tickPathStepTask).toHaveBeenNthCalledWith(2, "card-1", "task-1", false);
  });

  it("shows the reason and offers no checkboxes or full-step button once the step is gone", () => {
    renderCard({ reason: "This step is no longer on the hire's path." });

    expect(screen.getByText("This step is no longer on the hire's path.")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open the full step" })).not.toBeInTheDocument();
  });
});
