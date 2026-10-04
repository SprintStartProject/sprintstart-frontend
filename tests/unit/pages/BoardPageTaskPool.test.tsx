import { render, screen, fireEvent, act, waitFor, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { BoardPage } from "../../../src/pages/BoardPage";
import { ToastProvider } from "../../../src/context/ToastProvider";
import type { Board, BoardCard } from "../../../src/features/board/types";

vi.mock("../../../src/services/boardService", () => ({
  boardService: { fetchBoard: vi.fn(), dismissCard: vi.fn() },
}));

vi.mock("../../../src/context/useAuth", () => ({
  useAuth: () => ({ profile: { permissionGroup: "USER" } }),
}));

vi.mock("../../../src/features/projects/useProjectContext", async () => {
  const { createProjectContextValue, createSelectableProject } =
    await import("../setup/projectContext");
  return {
    useProjectContext: () =>
      createProjectContextValue({
        selectedProjectId: "p1",
        projects: [createSelectableProject({ id: "p1", name: "Project One" })],
        selectedProject: createSelectableProject({ id: "p1", name: "Project One" }),
      }),
  };
});

import { boardService } from "../../../src/services/boardService";

const note: BoardCard = {
  id: "c1",
  kind: "NOTE",
  owner: "HIRE",
  position: 0,
  placedAt: null,
  content: { kind: "NOTE", text: "deploys are on Thursdays" },
};

const pool: BoardCard = {
  id: "c2",
  kind: "TASK_POOL",
  owner: "AI",
  position: 1,
  placedAt: null,
  content: {
    kind: "TASK_POOL",
    currentTaskId: null,
    tasks: [
      {
        taskId: "t1",
        title: "Fix the flaky login test",
        summary: null,
        rationale: null,
        url: null,
        taskType: "BUG",
        reasons: [],
        bestFit: true,
        sourceHasAssignee: null,
      },
    ],
  },
};

function boardWith(...cards: BoardCard[]): Board {
  return { boardId: "b1", projectId: "p1", cards };
}

async function renderBoard() {
  render(
    <ToastProvider>
      <MemoryRouter>
        <BoardPage />
      </MemoryRouter>
    </ToastProvider>,
  );
  await waitFor(() =>
    expect(screen.getByRole("heading", { name: "deploys are on Thursdays" })).toBeInTheDocument(),
  );
}

/**
 * The pool is the one way to grab a task without the buddy, so it is a switch rather than a
 * dismissal: a server-side dismissal is sticky and neither the hire nor the buddy could undo it.
 */
describe("the task pool on the board", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(boardService.fetchBoard).mockReset().mockResolvedValue(boardWith(note, pool));
    vi.mocked(boardService.dismissCard).mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => vi.useRealTimers());

  it("hides on its X and never tells the server", async () => {
    await renderBoard();
    expect(screen.getByText("Fix the flaky login test")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /remove the task pool card/i }));
    expect(screen.queryByText("Fix the flaky login test")).not.toBeInTheDocument();

    // Well past the undo window every other card waits out before it dismisses.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });
    expect(boardService.dismissCard).not.toHaveBeenCalled();
  });

  it("comes back with Undo", async () => {
    await renderBoard();

    fireEvent.click(screen.getByRole("button", { name: /remove the task pool card/i }));
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));

    expect(screen.getByText("Fix the flaky login test")).toBeInTheDocument();
  });

  /**
   * Two copies of the switch: the rail in the margin from `lg` up, and the row above the cards
   * below that, where the rail is hidden. jsdom applies no media queries, so both are present
   * here — and both have to work, since each is the only one on screen at its widths.
   */
  it.each([
    ["the rail", 0],
    ["the toolbar shown below lg", 1],
  ])("is switched off and on again from %s", async (_where, index) => {
    await renderBoard();
    const toolbar = () => screen.getAllByRole("toolbar", { name: "Board tools" })[index];

    fireEvent.click(within(toolbar()).getByRole("button", { name: "Hide the task pool" }));
    expect(screen.queryByText("Fix the flaky login test")).not.toBeInTheDocument();

    fireEvent.click(within(toolbar()).getByRole("button", { name: "Show the task pool" }));
    expect(screen.getByText("Fix the flaky login test")).toBeInTheDocument();
    expect(boardService.dismissCard).not.toHaveBeenCalled();
  });

  it("offers no switch on a board without a pool card", async () => {
    vi.mocked(boardService.fetchBoard).mockResolvedValue(boardWith(note));
    await renderBoard();

    expect(screen.queryByRole("button", { name: /the task pool/i })).not.toBeInTheDocument();
  });
});
