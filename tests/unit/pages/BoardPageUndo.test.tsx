import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { BoardPage } from "../../../src/pages/BoardPage";
import { ToastProvider } from "../../../src/context/ToastProvider";
import type { Board } from "../../../src/features/board/types";

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

const board: Board = {
  boardId: "b1",
  projectId: "p1",
  cards: [
    {
      id: "c1",
      kind: "NOTE",
      owner: "HIRE",
      position: 0,
      placedAt: null,
      content: { kind: "NOTE", text: "deploys are on Thursdays" },
    },
  ],
};

/**
 * Removal is sticky on the server and has no undo behind it, so the undo has to happen before the
 * write. These two tests are the whole contract: the card leaves at once, the server hears about
 * it only when the window closes, and pressing Undo means it never hears at all.
 */
describe("removing a card", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(boardService.fetchBoard).mockReset().mockResolvedValue(board);
    vi.mocked(boardService.dismissCard).mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => vi.useRealTimers());

  async function renderBoard() {
    // The undo lives in the toast, so the provider has to be here — without it `useToast` is
    // inert and there is no button to press.
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

  it("takes the card off the board at once but waits before telling the server", async () => {
    await renderBoard();

    fireEvent.click(screen.getByRole("button", { name: /remove the note card/i }));

    expect(
      screen.queryByRole("heading", { name: "deploys are on Thursdays" }),
    ).not.toBeInTheDocument();
    expect(boardService.dismissCard).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });
    expect(boardService.dismissCard).toHaveBeenCalledWith("c1");
  });

  it("undo puts the card back and the removal is never sent", async () => {
    await renderBoard();

    fireEvent.click(screen.getByRole("button", { name: /remove the note card/i }));
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));

    expect(screen.getByRole("heading", { name: "deploys are on Thursdays" })).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });
    expect(boardService.dismissCard).not.toHaveBeenCalled();
  });
});
