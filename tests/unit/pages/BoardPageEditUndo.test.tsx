import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { BoardPage } from "../../../src/pages/BoardPage";
import { ToastProvider } from "../../../src/context/ToastProvider";
import { ApiError } from "../../../src/services/apiClient";
import type { Board, BoardCard } from "../../../src/features/board/types";

vi.mock("../../../src/services/boardService", () => ({
  boardService: { fetchBoard: vi.fn(), restorePrevious: vi.fn() },
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

const REPLACED_AT = "2026-09-29T10:15:30.123Z";

/** The hire's note as their buddy left it — with the words it replaced still on the card. */
const buddyEdited = (): BoardCard => ({
  id: "c1",
  kind: "NOTE",
  owner: "HIRE",
  position: 0,
  placedAt: null,
  content: { kind: "NOTE", text: "deploys are on Fridays" },
  lastChange: { change: "EDITED", by: "BUDDY", at: REPLACED_AT },
  previous: {
    content: { kind: "NOTE", text: "deploys are on Thursdays" },
    replacedBy: "BUDDY",
    replacedAt: REPLACED_AT,
  },
});

/** The same card after an undo: the hire's words back, and this undo itself undoable. */
const restored = (): BoardCard => ({
  id: "c1",
  kind: "NOTE",
  owner: "HIRE",
  position: 0,
  placedAt: null,
  content: { kind: "NOTE", text: "deploys are on Thursdays" },
  lastChange: { change: "EDITED", by: "HIRE", at: "2026-09-29T12:00:00.000Z" },
  previous: {
    content: { kind: "NOTE", text: "deploys are on Fridays" },
    replacedBy: "HIRE",
    replacedAt: "2026-09-29T12:00:00.000Z",
  },
});

const boardWith = (card: BoardCard): Board => ({
  boardId: "b1",
  projectId: "p1",
  cards: [card],
});

function renderBoard() {
  render(
    <ToastProvider>
      <MemoryRouter>
        <BoardPage />
      </MemoryRouter>
    </ToastProvider>,
  );
}

describe("undoing a card edit", () => {
  beforeEach(() => {
    vi.mocked(boardService.fetchBoard).mockReset().mockResolvedValue(boardWith(buddyEdited()));
    vi.mocked(boardService.restorePrevious).mockReset().mockResolvedValue(restored());
  });

  it("keeps the edit's record on the card, so a reload still shows it", async () => {
    renderBoard();

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "deploys are on Fridays" })).toBeInTheDocument(),
    );

    // Rendered from the board payload alone — nothing was clicked and no toast said anything, which
    // is the point: the record cannot expire while the hire is looking elsewhere.
    expect(screen.getByTestId("card-edit-history")).toBeInTheDocument();
    expect(screen.getByText(/your buddy rewrote this/i)).toBeInTheDocument();
  });

  it("shows the words the card used to say, on request", async () => {
    renderBoard();
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "deploys are on Fridays" })).toBeInTheDocument(),
    );

    expect(screen.queryByText("deploys are on Thursdays")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show what it said before" }));

    expect(screen.getByText("deploys are on Thursdays")).toBeInTheDocument();
  });

  it("undoes the edit in one action, echoing the exact moment it saw", async () => {
    renderBoard();
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "deploys are on Fridays" })).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: /undo — put the note back/i }));

    await waitFor(() =>
      expect(boardService.restorePrevious).toHaveBeenCalledWith("c1", REPLACED_AT),
    );
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "deploys are on Thursdays" })).toBeInTheDocument(),
    );
  });

  it("stands the undo down while the note is being edited", async () => {
    renderBoard();
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "deploys are on Fridays" })).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit this note" }));

    // The draft is the editor's now: an undo underneath it would be written over by the next Save,
    // silently, so the press is not offered while the card is being worked on.
    expect(screen.getByRole("button", { name: /undo — put the note back/i })).toBeDisabled();
  });

  it("says a stale undo plainly on the card, and shows the card as it is now", async () => {
    vi.mocked(boardService.restorePrevious).mockRejectedValue(
      new ApiError(409, "That card has changed since — nothing was undone"),
    );
    // The re-read after the refusal: the card moved on, and this is its truth.
    vi.mocked(boardService.fetchBoard)
      .mockResolvedValueOnce(boardWith(buddyEdited()))
      .mockResolvedValueOnce(boardWith(restored()));

    renderBoard();
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "deploys are on Fridays" })).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: /undo — put the note back/i }));

    await waitFor(() =>
      expect(screen.getByText(/that edit was already replaced/i)).toBeInTheDocument(),
    );
    // The card on screen is no longer the one the press was about.
    expect(screen.getByRole("heading", { name: "deploys are on Thursdays" })).toBeInTheDocument();
  });
});
