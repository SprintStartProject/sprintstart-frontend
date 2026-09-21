import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { axe } from "vitest-axe";
import { MemoryRouter } from "react-router-dom";
import { BoardPage } from "../../../src/pages/BoardPage";
import type { Board } from "../../../src/features/board/types";

vi.mock("../../../src/services/boardService", () => ({
  boardService: { fetchBoard: vi.fn() },
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
      kind: "PATH_TO_FIRST_CONTRIBUTION",
      owner: "AI",
      position: 0,
      placedAt: null,
      content: {
        kind: "PATH_TO_FIRST_CONTRIBUTION",
        moments: [{ key: "JOINED", reachedAt: "2026-07-20T09:00:00Z" }],
        acceptedCount: 0,
        autonomyReachedAt: "2026-08-04T09:00:00Z",
        // Both lines of `BoardPathNotes` are on screen for this pass, so axe sees them.
        stalledReason: "a review has been waiting three days",
      },
    },
    {
      id: "c2",
      kind: "OPEN_PULL_REQUESTS",
      owner: "AI",
      position: 1,
      placedAt: "2026-07-27T09:00:00Z",
      content: {
        kind: "OPEN_PULL_REQUESTS",
        pullRequests: [
          {
            artifactId: "a1",
            number: 12,
            title: "Add a health endpoint",
            url: "https://example.test/pr/12",
            waitingHours: 72,
          },
        ],
        attributionMissing: false,
      },
    },
  ],
};

describe("BoardPage Accessibility", () => {
  it("has no violations with cards on the board", async () => {
    vi.mocked(boardService.fetchBoard).mockResolvedValue(board);

    const { baseElement } = render(
      <MemoryRouter>
        <BoardPage />
      </MemoryRouter>,
    );

    // Waits for real board content. `main` is there from first paint, so waiting for it would
    // let this pass with the grid entirely broken. The header strip of moments it used to wait
    // for is gone: that answered "how far through onboarding am I", which the board answers four
    // other ways -- only the two lines with no second home stayed, in `BoardPathNotes`.
    await waitFor(() => expect(screen.getByText(/Add a health endpoint/)).toBeInTheDocument());
    expect(screen.getByText(/a review has been waiting three days/)).toBeInTheDocument();
    expect(await axe(baseElement)).toHaveNoViolations();
  });

  it("has no violations when the board cannot be loaded", async () => {
    vi.mocked(boardService.fetchBoard).mockRejectedValue(new Error("nope"));

    const { baseElement } = render(
      <MemoryRouter>
        <BoardPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText(/couldn't be loaded/i)).toBeInTheDocument());
    expect(await axe(baseElement)).toHaveNoViolations();
  });
});
