import { render, screen, fireEvent, act, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { BoardPage } from "../../../src/pages/BoardPage";
import { ToastProvider } from "../../../src/context/ToastProvider";
import { FocusModeProvider } from "../../../src/context/FocusModeProvider";
import { useFocusMode } from "../../../src/context/useFocusMode";
import type { Board, BoardCard } from "../../../src/features/board/types";
import { readPathWindowShown } from "../../../src/features/board/layout/pathWindowFold";
import { readTaskPoolShown } from "../../../src/features/board/layout/taskPoolShown";

vi.mock("../../../src/services/boardService", () => ({
  boardService: {
    fetchBoard: vi.fn(),
    dismissCard: vi.fn(),
    addCard: vi.fn(),
    reorder: vi.fn(),
    editCard: vi.fn(),
    restorePrevious: vi.fn(),
  },
}));

vi.mock("../../../src/context/useAuth", () => ({
  useAuth: () => ({ profile: { permissionGroup: "USER" } }),
}));

const projectState = vi.hoisted(() => ({ id: "p1", loading: false }));

vi.mock("../../../src/features/projects/useProjectContext", async () => {
  const { createProjectContextValue, createSelectableProject } =
    await import("../setup/projectContext");
  return {
    useProjectContext: () =>
      createProjectContextValue({
        selectedProjectId: projectState.id,
        isLoading: projectState.loading,
        projects: [createSelectableProject({ id: "p1", name: "Project One" })],
        selectedProject: projectState.id
          ? createSelectableProject({ id: "p1", name: "Project One" })
          : null,
      }),
  };
});

import { boardService } from "../../../src/services/boardService";

const note = (id: string, text: string, position: number): BoardCard => ({
  id,
  kind: "NOTE",
  owner: "HIRE",
  position,
  placedAt: null,
  content: { kind: "NOTE", text },
});

const pool: BoardCard = {
  id: "pool",
  kind: "TASK_POOL",
  owner: "AI",
  position: 9,
  placedAt: null,
  content: { kind: "TASK_POOL", currentTaskId: null, tasks: [] },
};

function boardOf(cards: BoardCard[]): Board {
  return { boardId: "b1", projectId: "p1", cards };
}

/** Reports whether the app is in focus mode, so a test can see what the page did to it. */
function FocusProbe() {
  const { isFocused } = useFocusMode();
  return <span data-testid="focus">{isFocused ? "focused" : "normal"}</span>;
}

function renderBoard(options: { withProbe?: boolean } = {}) {
  return render(
    <FocusModeProvider>
      <ToastProvider>
        <MemoryRouter>
          {options.withProbe ? <FocusProbe /> : null}
          <BoardPage />
        </MemoryRouter>
      </ToastProvider>
    </FocusModeProvider>,
  );
}

const rail = () => screen.getByRole("group", { name: "Board tools" });

beforeEach(() => {
  localStorage.clear();
  projectState.id = "p1";
  projectState.loading = false;
  vi.mocked(boardService.fetchBoard)
    .mockReset()
    .mockResolvedValue(boardOf([note("c1", "deploys are on Thursdays", 0)]));
  vi.mocked(boardService.dismissCard).mockReset().mockResolvedValue(undefined);
  vi.mocked(boardService.addCard).mockReset();
  vi.mocked(boardService.reorder).mockReset().mockResolvedValue(undefined);
});

describe("BoardPage: what the page shows", () => {
  it("says there is no project, and offers no tools, when the hire is not on one", async () => {
    projectState.id = "";

    renderBoard();

    expect(await screen.findByText("No project yet")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Board tools" })).not.toBeInTheDocument();
    expect(boardService.fetchBoard).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeDisabled();
  });

  it("does not say there is no project while projects are still loading", () => {
    projectState.id = "";
    projectState.loading = true;

    renderBoard();

    expect(screen.queryByText("No project yet")).not.toBeInTheDocument();
  });

  it("shows a spinner until the board for this project has arrived", () => {
    vi.mocked(boardService.fetchBoard).mockReturnValue(new Promise<never>(() => {}));

    renderBoard();

    expect(screen.getByText("Loading your board")).toBeInTheDocument();
  });

  it("says the board could not be loaded and tries again on request", async () => {
    vi.mocked(boardService.fetchBoard).mockRejectedValueOnce(new Error("down"));
    const user = userEvent.setup();

    renderBoard();

    expect(await screen.findByRole("alert")).toHaveTextContent("Your board couldn't be loaded.");
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("heading", { name: "deploys are on Thursdays" })).toBeVisible();
    expect(boardService.fetchBoard).toHaveBeenCalledTimes(2);
  });

  it("explains an empty board and points to the onboarding page", async () => {
    vi.mocked(boardService.fetchBoard).mockResolvedValue(boardOf([]));

    renderBoard();

    expect(await screen.findByText("Nothing on your board yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Onboarding page" })).toHaveAttribute(
      "href",
      "/onboarding",
    );
  });

  it("shows the board under its title, and reads it again on Refresh", async () => {
    const user = userEvent.setup();

    renderBoard();

    expect(await screen.findByRole("heading", { name: "Board", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Where your work stays put between conversations.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Refresh" }));

    await waitFor(() => expect(boardService.fetchBoard).toHaveBeenCalledTimes(2));
    expect(boardService.fetchBoard).toHaveBeenCalledWith("p1");
  });
});

describe("BoardPage: focus mode", () => {
  it("expands the board, takes the header away and offers the way back", async () => {
    const user = userEvent.setup();
    renderBoard({ withProbe: true });
    await screen.findByRole("heading", { name: "deploys are on Thursdays" });

    await user.click(within(rail()).getByRole("button", { name: "Expand the board" }));

    expect(screen.getByTestId("focus")).toHaveTextContent("focused");
    expect(screen.queryByRole("heading", { name: "Board", level: 1 })).not.toBeInTheDocument();
    const back = within(rail()).getByRole("button", { name: "Back to the app" });
    expect(back).toHaveAttribute("aria-pressed", "true");

    await user.click(back);
    expect(screen.getByTestId("focus")).toHaveTextContent("normal");
    expect(screen.getByRole("heading", { name: "Board", level: 1 })).toBeInTheDocument();
  });

  it("gives the app back on Escape, and only while expanded", async () => {
    const user = userEvent.setup();
    renderBoard({ withProbe: true });
    await screen.findByRole("heading", { name: "deploys are on Thursdays" });

    await user.keyboard("{Escape}");
    expect(screen.getByTestId("focus")).toHaveTextContent("normal");

    await user.click(within(rail()).getByRole("button", { name: "Expand the board" }));
    await user.keyboard("a");
    expect(screen.getByTestId("focus")).toHaveTextContent("focused");
    await user.keyboard("{Escape}");

    expect(screen.getByTestId("focus")).toHaveTextContent("normal");
  });

  it("does not leave the app expanded when the page is left", async () => {
    const user = userEvent.setup();
    const view = render(
      <FocusModeProvider>
        <ToastProvider>
          <MemoryRouter>
            <FocusProbe />
            <BoardPage />
          </MemoryRouter>
        </ToastProvider>
      </FocusModeProvider>,
    );
    await screen.findByRole("heading", { name: "deploys are on Thursdays" });
    await user.click(within(rail()).getByRole("button", { name: "Expand the board" }));
    expect(screen.getByTestId("focus")).toHaveTextContent("focused");

    view.rerender(
      <FocusModeProvider>
        <ToastProvider>
          <MemoryRouter>
            <FocusProbe />
          </MemoryRouter>
        </ToastProvider>
      </FocusModeProvider>,
    );

    // The provider above was replaced with a fresh one, which starts normal: what matters is that
    // unmounting ran the page's own clean-up without throwing.
    expect(screen.getByTestId("focus")).toHaveTextContent("normal");
  });
});

describe("BoardPage: the switches on the rail", () => {
  it("hides and shows the path strip, and remembers it for this board", async () => {
    const user = userEvent.setup();
    renderBoard();
    await screen.findByRole("heading", { name: "deploys are on Thursdays" });

    const hide = within(rail()).getByRole("button", { name: "Hide where you are in your path" });
    expect(hide).toHaveAttribute("aria-pressed", "true");
    await user.click(hide);

    const show = within(rail()).getByRole("button", { name: "Show where you are" });
    expect(show).toHaveAttribute("aria-pressed", "false");
    expect(readPathWindowShown("b1")).toBe(false);

    await user.click(show);
    expect(readPathWindowShown("b1")).toBe(true);
  });

  it("has no task pool switch on a board without a pool", async () => {
    renderBoard();
    await screen.findByRole("heading", { name: "deploys are on Thursdays" });

    expect(within(rail()).queryByRole("button", { name: /task pool/i })).not.toBeInTheDocument();
  });

  it("hides and shows the task pool from the rail, and remembers it", async () => {
    vi.mocked(boardService.fetchBoard).mockResolvedValue(
      boardOf([note("c1", "deploys are on Thursdays", 0), pool]),
    );
    const user = userEvent.setup();
    renderBoard();
    await screen.findByRole("heading", { name: "deploys are on Thursdays" });

    await user.click(within(rail()).getByRole("button", { name: "Hide the task pool" }));

    expect(readTaskPoolShown("b1")).toBe(false);
    const show = within(rail()).getByRole("button", { name: "Show the task pool" });
    expect(show).toHaveAttribute("aria-pressed", "false");

    await user.click(show);
    expect(readTaskPoolShown("b1")).toBe(true);
  });

  it("offers the filters only once the board has more than two cards", async () => {
    vi.mocked(boardService.fetchBoard).mockResolvedValue(
      boardOf([note("c1", "one", 0), note("c2", "two", 1)]),
    );
    const { unmount } = renderBoard();
    await screen.findByRole("heading", { name: "one" });
    expect(screen.queryByRole("group", { name: "Which cards to show" })).not.toBeInTheDocument();
    unmount();

    vi.mocked(boardService.fetchBoard).mockResolvedValue(
      boardOf([note("c1", "one", 0), note("c2", "two", 1), note("c3", "three", 2)]),
    );
    renderBoard();
    await screen.findByRole("heading", { name: "three" });

    expect(screen.getByRole("group", { name: "Which cards to show" })).toBeInTheDocument();
  });
});

describe("BoardPage: adding something of your own", () => {
  it("opens the note form over the board and closes it again", async () => {
    const user = userEvent.setup();
    renderBoard();
    await screen.findByRole("heading", { name: "deploys are on Thursdays" });

    await user.click(within(rail()).getByRole("button", { name: "Add a note" }));
    expect(screen.getByRole("button", { name: "Cancel adding a card" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel adding a card" }));
    expect(screen.queryByRole("button", { name: "Cancel adding a card" })).not.toBeInTheDocument();
  });

  it("offers nothing to add while the board is being planned", async () => {
    const user = userEvent.setup();
    renderBoard();
    await screen.findByRole("heading", { name: "deploys are on Thursdays" });
    expect(within(rail()).getByRole("button", { name: "Add a link" })).toBeInTheDocument();

    await user.click(within(rail()).getByRole("button", { name: "Plan the board" }));

    expect(within(rail()).queryByRole("button", { name: "Add a link" })).not.toBeInTheDocument();
  });

  it("tells the hire when a card could not be saved", async () => {
    vi.mocked(boardService.addCard).mockRejectedValue(new Error("nope"));
    const user = userEvent.setup();
    renderBoard();
    await screen.findByRole("heading", { name: "deploys are on Thursdays" });

    await user.click(within(rail()).getByRole("button", { name: "Add a link" }));
    await user.type(screen.getByPlaceholderText("https://…"), "https://example.com");
    await user.click(screen.getByRole("button", { name: "Add to my board" }));

    expect(await screen.findByText("That change didn't save")).toBeInTheDocument();
    expect(screen.getByText("Your board is as it was — try again.")).toBeInTheDocument();
  });
});

describe("BoardPage: making an area", () => {
  it("opens the naming form, creates the area and opens it as a tab", async () => {
    const user = userEvent.setup();
    renderBoard();
    await screen.findByRole("heading", { name: "deploys are on Thursdays" });

    await user.click(within(rail()).getByRole("button", { name: "New area" }));
    expect(within(rail()).getByRole("button", { name: "New area" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.type(screen.getByLabelText(/Name this area/), "Paperwork");
    await user.click(screen.getByRole("button", { name: "Create area" }));

    const sections = await screen.findByRole("group", {
      name: "Which section of the board to show",
    });
    expect(within(sections).getByRole("button", { name: /Paperwork/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.queryByLabelText(/Name this area/)).not.toBeInTheDocument();
    expect(localStorage.length).toBeGreaterThan(0);
  });

  it("closes the naming form without making anything", async () => {
    const user = userEvent.setup();
    renderBoard();
    await screen.findByRole("heading", { name: "deploys are on Thursdays" });

    await user.click(within(rail()).getByRole("button", { name: "New area" }));
    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.queryByLabelText(/Name this area/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Paperwork/ })).not.toBeInTheDocument();
  });
});

describe("BoardPage: planning", () => {
  it("opens planning with no changes, and leaves it with Done", async () => {
    const user = userEvent.setup();
    renderBoard();
    await screen.findByRole("heading", { name: "deploys are on Thursdays" });

    await user.click(within(rail()).getByRole("button", { name: "Plan the board" }));

    expect(
      screen.getByText("Put cards into piles and areas, and move them where they belong."),
    ).toBeInTheDocument();
    expect(screen.getByText("No changes yet")).toBeInTheDocument();
    expect(within(rail()).getByRole("button", { name: "Done planning" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "Done" }));

    expect(screen.queryByText("No changes yet")).not.toBeInTheDocument();
    expect(within(rail()).getByRole("button", { name: "Plan the board" })).toBeInTheDocument();
  });

  it("cancels planning from the header and from the rail", async () => {
    const user = userEvent.setup();
    renderBoard();
    await screen.findByRole("heading", { name: "deploys are on Thursdays" });

    await user.click(within(rail()).getByRole("button", { name: "Plan the board" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("No changes yet")).not.toBeInTheDocument();

    await user.click(within(rail()).getByRole("button", { name: "Plan the board" }));
    await user.click(within(rail()).getByRole("button", { name: "Cancel planning" }));
    expect(screen.queryByText("No changes yet")).not.toBeInTheDocument();
  });
});

describe("BoardPage: a card that could not be removed", () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it("says so, and that the card is still there", async () => {
    vi.mocked(boardService.dismissCard).mockRejectedValue(new Error("nope"));
    renderBoard();
    await screen.findByRole("heading", { name: "deploys are on Thursdays" });

    fireEvent.click(screen.getByRole("button", { name: /remove the note card/i }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });

    expect(await screen.findByText("That card couldn't be removed")).toBeInTheDocument();
    expect(screen.getByText("It's still here — try again.")).toBeInTheDocument();
  });
});
