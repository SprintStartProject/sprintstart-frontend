import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import { BoardPage } from "../../../src/pages/BoardPage";
import { ToastProvider } from "../../../src/context/ToastProvider";
import { FocusModeProvider } from "../../../src/context/FocusModeProvider";
import type { Board, BoardCard } from "../../../src/features/board/types";
import { writeCardOrigins } from "../../../src/features/board/layout/cardOrigins";
import { readBehindSeen, writeBehindSeen } from "../../../src/features/board/layout/behindSeen";
import { onboardingService } from "../../../src/services/onboardingService";
import type { OnboardingPathEndpoint } from "../../../src/features/onboarding/types";

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

/** The nth control of that name, in the order the cards are on screen. */
function control(name: string | RegExp, nth = 0) {
  return screen.getAllByRole("button", { name })[nth];
}

/** Phase one is finished; phase two is where the hire is. */
const PATH: OnboardingPathEndpoint = {
  id: "path1",
  userId: "u1",
  createdAt: "2026-01-01T00:00:00Z",
  phases: [
    {
      id: "ph1",
      pathId: "path1",
      position: 1,
      title: "Phase one",
      description: "",
      locked: false,
      questions: [],
      steps: [
        {
          id: "s1",
          phaseId: "ph1",
          position: 1,
          title: "First step",
          description: "",
          type: "TASK",
          estimatedMinutes: 5,
          expectedOutcomes: [],
          tasks: [],
          resources: [],
          status: "FINISHED",
          startedAt: null,
          completedAt: null,
          feedback: null,
          skip: null,
        },
      ],
    },
    {
      id: "ph2",
      pathId: "path1",
      position: 2,
      title: "Phase two",
      description: "",
      locked: false,
      questions: [],
      steps: [
        {
          id: "s2",
          phaseId: "ph2",
          position: 1,
          title: "Second step",
          description: "",
          type: "TASK",
          estimatedMinutes: 5,
          expectedOutcomes: [],
          tasks: [],
          resources: [],
          status: "IN_PROGRESS",
          startedAt: null,
          completedAt: null,
          feedback: null,
          skip: null,
        },
      ],
    },
  ],
};

const NAMES = ["alpha", "bravo", "charlie", "delta"];
const FOUR = NAMES.map((name, index) => note(`c${index + 1}`, `${name} note`, index));

/** Cards one and two were kept from the finished phase. */
function keptFromPhaseOne() {
  writeCardOrigins("p1", {
    c1: { url: "/onboarding?phase=ph1", label: "Phase one" },
    c2: { url: "/onboarding?phase=ph1", label: "Phase one" },
  });
}

function renderAt(entry = "/board") {
  return render(
    <FocusModeProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={[entry]}>
          <LocationProbe />
          <BoardPage />
        </MemoryRouter>
      </ToastProvider>
    </FocusModeProvider>,
  );
}

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="where">{`${location.pathname}${location.search}`}</span>;
}

const where = () => screen.getByTestId("where").textContent;

function shown() {
  return screen
    .getAllByRole("heading", { level: 2 })
    .map((heading) => heading.textContent)
    .filter((text) => /note$/.test(text ?? ""));
}

beforeEach(() => {
  localStorage.clear();
  projectState.id = "p1";
  projectState.loading = false;
  vi.mocked(boardService.fetchBoard).mockReset().mockResolvedValue(boardOf(FOUR));
  vi.mocked(boardService.dismissCard).mockReset().mockResolvedValue(undefined);
  vi.mocked(boardService.reorder).mockReset().mockResolvedValue(undefined);
  vi.spyOn(onboardingService, "fetchPath").mockResolvedValue(PATH);
});

afterEach(() => vi.restoreAllMocks());

describe("BoardPage: opened for one phase", () => {
  it("shows only what was kept from that phase, names the cut, and shows everything on request", async () => {
    keptFromPhaseOne();
    writeBehindSeen("b1", []);
    const user = userEvent.setup();
    renderAt("/board?phase=ph1");

    await waitFor(() => expect(shown()).toEqual(["alpha note", "bravo note"]));
    expect(screen.getByText("Showing 2 of 4 cards")).toBeInTheDocument();
    expect(screen.getByText("From “Phase one”")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show everything" }));

    await waitFor(() => expect(shown()).toHaveLength(4));
    expect(where()).toBe("/board");
  });

  it("says 'From one phase' when the phase is not on the path", async () => {
    renderAt("/board?phase=gone");

    expect(await screen.findByText("From one phase")).toBeInTheDocument();
    expect(screen.getByText(/Nothing here right now\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show all 4 cards" })).toBeInTheDocument();
  });
});

describe("BoardPage: the finished phases", () => {
  beforeEach(keptFromPhaseOne);

  it("keeps cards from a finished phase behind you, folded, on a small board too", async () => {
    renderAt();

    await screen.findByRole("heading", { name: "charlie note" });
    await waitFor(() => expect(screen.getByText("Behind you")).toBeInTheDocument());
    expect(screen.queryByRole("heading", { name: "alpha note" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "charlie note" })).toBeInTheDocument();
  });

  it("opens the band to look at them, and folds it again", async () => {
    const user = userEvent.setup();
    writeBehindSeen("b1", ["c1", "c2"]);
    renderAt();
    await screen.findByRole("heading", { name: "charlie note" });
    await screen.findByText("Behind you");

    await user.click(screen.getByRole("button", { name: /Behind you/ }));
    expect(await screen.findByRole("heading", { name: "alpha note" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Behind you/ }));
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "alpha note" })).not.toBeInTheDocument(),
    );
  });

  it("opens the band by itself when cards have moved behind since the hire last looked", async () => {
    writeBehindSeen("b1", []);
    renderAt();

    expect(await screen.findByRole("heading", { name: "alpha note" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "bravo note" })).toBeInTheDocument();
  });

  it("remembers what is behind, so it does not open again for the same cards", async () => {
    writeBehindSeen("b1", []);
    renderAt();
    await screen.findByRole("heading", { name: "alpha note" });

    await waitFor(() => expect([...(readBehindSeen("b1") ?? [])].sort()).toEqual(["c1", "c2"]));
  });

  it("starts with only the current stage open on a board past the fold threshold", async () => {
    const many = Array.from({ length: 10 }, (_, index) =>
      note(`n${index}`, `card ${index} note`, index),
    );
    writeCardOrigins("p1", {
      n0: { url: "/onboarding?phase=ph1", label: "Phase one" },
    });
    writeBehindSeen("b1", ["n0"]);
    vi.mocked(boardService.fetchBoard).mockResolvedValue(boardOf(many));
    renderAt();

    await screen.findByRole("heading", { name: "card 1 note" });

    await screen.findByText("Behind you");
    expect(screen.queryByRole("heading", { name: "card 0 note" })).not.toBeInTheDocument();
  });
});

describe("BoardPage: taking the path strip off", () => {
  it("removes it with an undo, and puts it back from the undo", async () => {
    const user = userEvent.setup();
    renderAt();
    await screen.findByRole("heading", { name: "alpha note" });
    const strip = await screen.findByRole("region", { name: "Where you are in your path" });
    expect(strip).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Take this off your board" }));

    expect(screen.queryByRole("region", { name: "Where you are in your path" })).toBeNull();
    expect(screen.getByText("Taken off your board")).toBeInTheDocument();
    expect(
      screen.getByText("You can put it back from the switches on the right."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(
      await screen.findByRole("region", { name: "Where you are in your path" }),
    ).toBeInTheDocument();
  });
});

describe("BoardPage: hiding the task pool", () => {
  it("hides the card with an undo when its own X is pressed", async () => {
    const pool: BoardCard = {
      id: "pool",
      kind: "TASK_POOL",
      owner: "AI",
      position: 9,
      placedAt: null,
      content: { kind: "TASK_POOL", currentTaskId: null, tasks: [] },
    };
    vi.mocked(boardService.fetchBoard).mockResolvedValue(boardOf([...FOUR, pool]));
    const user = userEvent.setup();
    renderAt();
    await screen.findByRole("heading", { name: "alpha note" });

    await user.click(screen.getByRole("button", { name: /Remove the task pool card/i }));

    expect(await screen.findByText("Task pool hidden")).toBeInTheDocument();
    expect(boardService.dismissCard).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByRole("button", { name: /Remove the task pool card/i })).toBeInTheDocument();
  });
});

describe("BoardPage: planning", () => {
  async function plan() {
    const user = userEvent.setup();
    renderAt();
    await screen.findByRole("heading", { name: "alpha note" });
    await user.click(screen.getByRole("button", { name: "Plan the board" }));
    return user;
  }

  it("counts a move as a change, and keeps it on Done", async () => {
    const user = await plan();

    control(/Move the note card/, 0).focus();
    await user.keyboard("{ArrowDown}");

    expect(boardService.reorder).toHaveBeenCalledWith("p1", ["c2", "c1", "c3", "c4"]);
    expect(await screen.findByText("1 change")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByText("1 change")).not.toBeInTheDocument();
    expect(boardService.reorder).toHaveBeenCalledTimes(1);
  });

  it("undoes everything on Cancel, sending the old order again", async () => {
    const user = await plan();
    control(/Move the note card/, 0).focus();
    await user.keyboard("{ArrowDown}");
    await screen.findByText("1 change");
    await waitFor(() =>
      expect(shown()).toEqual(["bravo note", "alpha note", "charlie note", "delta note"]),
    );

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() =>
      expect(boardService.reorder).toHaveBeenLastCalledWith("p1", ["c1", "c2", "c3", "c4"]),
    );
    expect(screen.queryByText("1 change")).not.toBeInTheDocument();
  });

  it("opens every pile and band while planning", async () => {
    keptFromPhaseOne();
    writeBehindSeen("b1", ["c1", "c2"]);
    const user = userEvent.setup();
    renderAt();
    await screen.findByText("Behind you");
    expect(screen.queryByRole("heading", { name: "alpha note" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Plan the board" }));

    expect(await screen.findByRole("heading", { name: "alpha note" })).toBeInTheDocument();
  });
});
