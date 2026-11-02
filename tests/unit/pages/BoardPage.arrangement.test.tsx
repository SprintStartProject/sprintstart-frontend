import { render, screen, fireEvent, act, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { BoardPage } from "../../../src/pages/BoardPage";
import { ToastProvider } from "../../../src/context/ToastProvider";
import { FocusModeProvider } from "../../../src/context/FocusModeProvider";
import type { Board, BoardCard } from "../../../src/features/board/types";
import {
  readCollapsedCards,
  writeCollapsedCards,
} from "../../../src/features/board/layout/collapsedCards";
import { readPinnedCards, writePinnedCards } from "../../../src/features/board/layout/pinnedCards";
import { readCardSizes, writeCardSizes } from "../../../src/features/board/layout/cardSizes";
import {
  readBoardGroups,
  writeBoardGroups,
  type BoardGroup,
} from "../../../src/features/board/layout/boardGroups";
import { notifyBoardStorageReplaced } from "../../../src/features/board/layout/boardStorage";

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

function boardOf(cards: BoardCard[]): Board {
  return { boardId: "b1", projectId: "p1", cards };
}

function renderBoard() {
  return render(
    <FocusModeProvider>
      <ToastProvider>
        <MemoryRouter>
          <BoardPage />
        </MemoryRouter>
      </ToastProvider>
    </FocusModeProvider>,
  );
}

/** The nth control of that name, in the order the cards are on screen. */
function control(name: string | RegExp, nth = 0) {
  return screen.getAllByRole("button", { name })[nth];
}

const FOUR = [
  note("c1", "alpha note", 0),
  note("c2", "bravo note", 1),
  note("c3", "charlie note", 2),
  note("c4", "delta note", 3),
];

async function renderFour(cards: BoardCard[] = FOUR) {
  vi.mocked(boardService.fetchBoard).mockResolvedValue(boardOf(cards));
  const view = renderBoard();
  await screen.findByRole("heading", {
    name: cards[0].content.kind === "NOTE" ? "alpha note" : "",
  });
  return view;
}

/** The cards on screen, top to bottom. */
function order() {
  return screen
    .getAllByRole("heading", { level: 2 })
    .map((heading) => heading.textContent)
    .filter((text) => /note$/.test(text ?? ""));
}

beforeEach(() => {
  localStorage.clear();
  projectState.id = "p1";
  projectState.loading = false;
  vi.mocked(boardService.fetchBoard).mockReset();
  vi.mocked(boardService.dismissCard).mockReset().mockResolvedValue(undefined);
  vi.mocked(boardService.reorder).mockReset().mockResolvedValue(undefined);
});

describe("BoardPage: folding a card", () => {
  it("folds a card and unfolds it again, remembering the fold for this board", async () => {
    const user = userEvent.setup();
    await renderFour();

    await user.click(control("Fold the note card", 0));

    expect(readCollapsedCards("b1").has("c1")).toBe(true);
    const unfold = control("Unfold the note card", 0);
    await user.click(unfold);

    expect(readCollapsedCards("b1").has("c1")).toBe(false);
    expect(control("Fold the note card", 0)).toBeInTheDocument();
  });

  it("opens with the cards folded that were folded last time", async () => {
    writeCollapsedCards("b1", new Set(["c2"]));

    await renderFour();

    expect(control("Unfold the note card", 0)).toBeInTheDocument();
    expect(control("Fold the note card", 0)).toBeInTheDocument();
  });

  it("picks up an arrangement that was replaced underneath the page", async () => {
    await renderFour();
    expect(screen.queryByRole("button", { name: "Unfold the note card" })).toBeNull();

    act(() => {
      writeCollapsedCards("b1", new Set(["c2"]));
      notifyBoardStorageReplaced();
    });

    expect(await screen.findByRole("button", { name: "Unfold the note card" })).toBeInTheDocument();
  });
});

describe("BoardPage: pinning a card", () => {
  it("lifts a pinned card to the top, and puts it back when unpinned", async () => {
    const user = userEvent.setup();
    await renderFour();
    expect(order()).toEqual(["alpha note", "bravo note", "charlie note", "delta note"]);

    await user.click(control("Pin the note card to the top", 2));

    expect(order()).toEqual(["charlie note", "alpha note", "bravo note", "delta note"]);
    expect(readPinnedCards("b1").has("c3")).toBe(true);

    await user.click(control("Unpin the note card", 0));

    expect(order()).toEqual(["alpha note", "bravo note", "charlie note", "delta note"]);
    expect(readPinnedCards("b1").has("c3")).toBe(false);
  });

  it("opens with the cards pinned that were pinned last time", async () => {
    writePinnedCards("b1", new Set(["c4"]));

    await renderFour();

    expect(order()[0]).toBe("delta note");
    expect(control("Unpin the note card", 0)).toBeInTheDocument();
  });
});

describe("BoardPage: resizing a card", () => {
  it("steps a card wider with the arrow keys and back to the default, which is not stored", async () => {
    const user = userEvent.setup();
    await renderFour();
    const handle = control(/Resize the note card/, 0);

    handle.focus();
    await user.keyboard("{ArrowRight}");

    expect(readCardSizes("b1").c1).toEqual({ width: "wide" });

    await user.keyboard("{ArrowLeft}");

    expect(readCardSizes("b1").c1).toBeUndefined();
  });

  it("opens with the sizes the hire pulled their cards to", async () => {
    writeCardSizes("b1", { c2: { width: "narrow" } });

    await renderFour();

    expect(readCardSizes("b1").c2).toEqual({ width: "narrow" });
    expect(control(/Resize the note card/, 1)).toBeInTheDocument();
  });
});

const PAPERWORK: BoardGroup = {
  id: "g1",
  name: "Paperwork",
  cardIds: ["c1", "c2"],
  collapsed: false,
};

const sectionBar = () => screen.getByRole("group", { name: "Which section of the board to show" });

describe("BoardPage: areas", () => {
  beforeEach(() => writeBoardGroups("b1", [PAPERWORK]));

  it("offers a tab for each area and one for what is in none, counting what is left to do", async () => {
    await renderFour();

    const tabs = within(sectionBar());
    expect(tabs.getByRole("button", { name: /All sections/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(tabs.getByRole("button", { name: /Paperwork/ })).toBeInTheDocument();
    expect(tabs.getByRole("button", { name: /Not in an area/ })).toBeInTheDocument();
  });

  it("narrows the board to one area, says so, and shows everything again on request", async () => {
    const user = userEvent.setup();
    await renderFour();

    await user.click(within(sectionBar()).getByRole("button", { name: /Paperwork/ }));

    expect(order()).toEqual(["alpha note", "bravo note"]);
    expect(screen.getByText("Showing 2 of 4 cards")).toBeInTheDocument();
    expect(screen.getByText("Paperwork", { selector: "span.before\\:mr-2" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show everything" }));

    expect(order()).toHaveLength(4);
    expect(screen.queryByText(/Showing \d of/)).not.toBeInTheDocument();
  });

  it("says nothing is here when the open area has no cards, and offers all of them", async () => {
    writeBoardGroups("b1", [PAPERWORK, { id: "g2", name: "Empty", cardIds: [], collapsed: false }]);
    const user = userEvent.setup();
    await renderFour();

    await user.click(within(sectionBar()).getByRole("button", { name: /Empty/ }));

    expect(screen.getByText(/Nothing here right now\./)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show all 4 cards" }));
    expect(order()).toHaveLength(4);
  });

  it("renames an area", async () => {
    const user = userEvent.setup();
    await renderFour();

    await user.click(screen.getByTitle("Rename this area"));
    const name = screen.getByLabelText("Name of the Paperwork area");
    await user.clear(name);
    await user.type(name, "Forms{Enter}");

    expect(readBoardGroups("b1")[0].name).toBe("Forms");
    expect(await within(sectionBar()).findByRole("button", { name: /Forms/ })).toBeInTheDocument();
  });

  it("paints an area", async () => {
    const user = userEvent.setup();
    await renderFour();

    const paint = screen.getAllByRole("button", { name: /^Paint the Paperwork area/ })[1];
    await user.click(paint);

    expect(readBoardGroups("b1")[0].accent).toBeDefined();
  });

  it("folds an area and unfolds it", async () => {
    const user = userEvent.setup();
    await renderFour();

    await user.click(screen.getByRole("button", { name: "Fold the Paperwork area" }));
    expect(readBoardGroups("b1")[0].collapsed).toBe(true);

    await user.click(screen.getByRole("button", { name: "Unfold the Paperwork area" }));
    expect(readBoardGroups("b1")[0].collapsed).toBe(false);
  });

  it("takes an area away, leaves its cards, and falls back to everything if it was open", async () => {
    const user = userEvent.setup();
    await renderFour();
    await user.click(within(sectionBar()).getByRole("button", { name: /Paperwork/ }));
    expect(order()).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Take the Paperwork area away" }));

    expect(readBoardGroups("b1")).toEqual([]);
    expect(order()).toHaveLength(4);
    expect(screen.queryByRole("group", { name: "Which section of the board to show" })).toBeNull();
  });

  it("goes back to everything when the open area is dissolved somewhere else", async () => {
    const user = userEvent.setup();
    await renderFour();
    await user.click(within(sectionBar()).getByRole("button", { name: /Paperwork/ }));
    expect(order()).toHaveLength(2);

    act(() => {
      writeBoardGroups("b1", []);
      notifyBoardStorageReplaced();
    });

    await waitFor(() => expect(order()).toHaveLength(4));
  });
});

describe("BoardPage: focusing a big board", () => {
  const MANY = Array.from({ length: 10 }, (_, index) =>
    note(`n${index}`, `card ${index} note`, index),
  );

  it("offers the focus tab only above the fold threshold", async () => {
    writeBoardGroups("b1", [{ id: "g1", name: "Paperwork", cardIds: ["n0"], collapsed: false }]);
    vi.mocked(boardService.fetchBoard).mockResolvedValue(boardOf(MANY));
    renderBoard();
    await screen.findByRole("heading", { name: "card 0 note" });

    expect(within(sectionBar()).getAllByRole("button").length).toBeGreaterThan(2);
  });
});

describe("BoardPage: leaving mid-undo", () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it("keeps the card, and never tells the server, when the page is left before the window closes", async () => {
    vi.mocked(boardService.fetchBoard).mockResolvedValue(boardOf(FOUR));
    const view = renderBoard();
    await screen.findByRole("heading", { name: "alpha note" });

    fireEvent.click(control(/remove the note card/i, 0));
    view.unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });

    expect(boardService.dismissCard).not.toHaveBeenCalled();
  });

  it("forgets the card for good once the server has been told", async () => {
    vi.mocked(boardService.fetchBoard)
      .mockResolvedValueOnce(boardOf(FOUR))
      .mockResolvedValue(boardOf(FOUR.slice(1)));
    renderBoard();
    await screen.findByRole("heading", { name: "alpha note" });

    fireEvent.click(control(/remove the note card/i, 0));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });

    expect(boardService.dismissCard).toHaveBeenCalledWith("c1");
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "alpha note" })).not.toBeInTheDocument(),
    );
  });
});
