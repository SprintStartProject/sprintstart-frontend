import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Navigate, Route, Routes } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FirstWeekPage } from "../../../src/pages/FirstWeekPage";
import { arrivalService } from "../../../src/services/arrivalService";
import { starterWorkService } from "../../../src/services/starterWorkService";
import { userService } from "../../../src/services/userService";
import type { ArrivalStep, DerivableArrivalStep } from "../../../src/features/arrival/types";
import type { StarterWorkTask } from "../../../src/features/starter-work/types";

vi.mock("../../../src/services/arrivalService", () => ({
  arrivalService: {
    listSteps: vi.fn(),
    listDerivableSteps: vi.fn(),
    createStep: vi.fn(),
    updateStep: vi.fn(),
    reorderSteps: vi.fn(),
    deleteStep: vi.fn(),
  },
}));

vi.mock("../../../src/features/projects/useProjectContext", async () => {
  const { createProjectContextValue, createSelectableProject } =
    await import("../setup/projectContext");
  const project = createSelectableProject({ id: "p1", name: "Project One" });
  return {
    useProjectContext: () =>
      createProjectContextValue({
        selectedProjectId: "p1",
        projects: [project],
        selectedProject: project,
      }),
  };
});

vi.mock("../../../src/context/useAuth", () => ({
  useAuth: () => ({ profile: { id: "u1", permissionGroup: "PM" } }),
}));

function renderTab(tab: "overview" | "arrival" | "starter") {
  return render(
    <MemoryRouter initialEntries={[`/first-week?tab=${tab}`]}>
      <FirstWeekPage />
    </MemoryRouter>,
  );
}

describe("FirstWeekPage tab switching", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(arrivalService.listSteps).mockResolvedValue([]);
    vi.mocked(arrivalService.listDerivableSteps).mockResolvedValue([]);
    vi.spyOn(starterWorkService, "fetchUnreviewed").mockResolvedValue({ tasks: [] });
    vi.spyOn(starterWorkService, "fetchPool").mockResolvedValue([]);
    vi.spyOn(starterWorkService, "fetchCandidates").mockResolvedValue([]);
    vi.spyOn(userService, "getMyProjects").mockResolvedValue([]);
  });

  it("defaults to the Overview tab when no ?tab= is given", async () => {
    render(
      <MemoryRouter initialEntries={["/first-week"]}>
        <FirstWeekPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", { name: "A new hire's first week" }),
    ).toBeInTheDocument();
  });

  it("opens the Arrival tab from a ?tab=arrival deep link", async () => {
    renderTab("arrival");

    expect(await screen.findByRole("button", { name: "Add step" })).toBeInTheDocument();
  });

  it("opens the Starter work tab from a ?tab=starter deep link", async () => {
    renderTab("starter");

    expect(await screen.findByTestId("add-tasks-menu")).toBeInTheDocument();
  });

  it("switches from Arrival to Starter work through the tab bar", async () => {
    renderTab("arrival");
    await screen.findByRole("button", { name: "Add step" });

    fireEvent.click(screen.getByRole("button", { name: "Starter work" }));

    expect(await screen.findByTestId("add-tasks-menu")).toBeInTheDocument();
  });
});

function arrivalStep(over: Partial<ArrivalStep> = {}): ArrivalStep {
  return {
    key: "vpn",
    projectId: null,
    projectName: null,
    title: "Request VPN access",
    description: null,
    href: null,
    position: 0,
    settledBy: "DECLARED",
    selfConfirmable: true,
    settled: false,
    settledAt: null,
    rigor: null,
    ...over,
  };
}

function derivableStep(over: Partial<DerivableArrivalStep> = {}): DerivableArrivalStep {
  return {
    key: "github-account",
    suggestedTitle: "Add your GitHub username",
    suggestedDescription: "So work you push can be recognised as yours.",
    selfConfirmable: false,
    added: false,
    ...over,
  };
}

function starterTask(over: Partial<StarterWorkTask> = {}): StarterWorkTask {
  return {
    id: "t1",
    sourceId: "github:acme/repo:ISSUE:1",
    title: "Fix the thing",
    summary: "A clearly scoped fix.",
    rationale: null,
    sourceUrl: "https://github.com/acme/repo/issues/1",
    competencyKeys: [],
    status: "LIVE",
    reviewed: true,
    taskZeroEligible: false,
    sourceHasAssignee: null,
    sourceCheckedAt: null,
    ...over,
  };
}

/**
 * The Overview tab reads live data through the same hooks Arrival and Starter work use — no
 * summary endpoint of its own — so its tests set up the same service mocks those tabs' own tests
 * do, just with fixtures chosen to exercise the stage statuses and the "Needs you" list together.
 */
describe("FirstWeekPage Overview tab", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Company: one ordinary step plus one the system checks itself. Project: one addition, so the
    // merged count (3) differs from the company list's own count (2).
    vi.mocked(arrivalService.listSteps).mockImplementation((projectId) =>
      Promise.resolve(
        projectId
          ? [arrivalStep({ key: "staging-db", title: "Get staging DB access", projectId: "p1" })]
          : [
              arrivalStep({ key: "vpn" }),
              arrivalStep({
                key: "github-account",
                title: "Add your GitHub username",
                settledBy: "OBSERVED",
                selfConfirmable: false,
              }),
            ],
      ),
    );
    vi.mocked(arrivalService.listDerivableSteps).mockResolvedValue([
      derivableStep({ key: "github-account", added: true }),
      derivableStep({
        key: "environment-ready",
        suggestedTitle: "Development environment works",
        added: false,
      }),
    ]);
    vi.spyOn(starterWorkService, "fetchUnreviewed").mockResolvedValue({
      tasks: [starterTask({ id: "unseen-1", reviewed: false })],
    });
    vi.spyOn(starterWorkService, "fetchPool").mockResolvedValue([
      starterTask({ id: "pool-1", taskZeroEligible: false }),
      starterTask({ id: "pool-2", taskZeroEligible: false }),
    ]);
    vi.spyOn(starterWorkService, "fetchCandidates").mockResolvedValue([]);
    vi.spyOn(userService, "getMyProjects").mockResolvedValue([]);
  });

  it("shows each stage's readiness status and its open checks", async () => {
    renderTab("overview");

    // 2 company steps + 1 project addition, none overridden — 3, not the company list's own 2.
    // Only the missing "environment-ready" derivable is open, and it's info-only, so the stage
    // itself is still "ready".
    const arrivalCard = await screen.findByTestId("overview-stage-arrival");
    expect(arrivalCard).toHaveAttribute("data-status", "ready");
    expect(within(arrivalCard).getByText("3 steps")).toBeInTheDocument();
    expect(
      within(arrivalCard).getByText("1 automatic check isn't on the list"),
    ).toBeInTheDocument();

    // No pool task is Task 0 eligible — critical, so the stage is "missing".
    const taskZeroCard = screen.getByTestId("overview-stage-task0");
    expect(taskZeroCard).toHaveAttribute("data-status", "missing");
    expect(within(taskZeroCard).getByText("No Task 0 yet")).toBeInTheDocument();
    expect(within(taskZeroCard).getByText("0 Task 0")).toBeInTheDocument();

    // Unseen task and a pool under the minimum both warn, so the stage is "attention". Its third
    // check (never synced) is info-only and exactly fills the 3-item cap, so there's no "+more" —
    // there's deliberately no "closed in tracker" check at all; see `starterChecks`.
    const starterCard = screen.getByTestId("overview-stage-starter");
    expect(starterCard).toHaveAttribute("data-status", "attention");
    expect(within(starterCard).getByText("1 task nobody has looked at yet")).toBeInTheDocument();
    expect(within(starterCard).getByText("2 in the pool")).toBeInTheDocument();
    expect(within(starterCard).queryByText(/more$/)).not.toBeInTheDocument();
  });

  it("lists open readiness checks worst-first, capped at four with a 'Show all' toggle", async () => {
    renderTab("overview");

    // Five checks fire from this fixture: 1 critical, 2 warnings, 2 info. Only the first four show.
    expect(await screen.findByTestId("overview-needs-task0-none")).toHaveTextContent(
      "No Task 0 yet",
    );
    expect(screen.getByTestId("overview-needs-pool-unseen")).toHaveTextContent(
      "1 task nobody has looked at yet",
    );
    expect(screen.getByTestId("overview-needs-pool-small")).toBeInTheDocument();
    expect(screen.getByTestId("overview-needs-arrival-derivable")).toHaveTextContent(
      "1 automatic check isn't on the list",
    );
    expect(screen.queryByTestId("overview-needs-pool-sync")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show all" }));

    expect(screen.getByTestId("overview-needs-pool-sync")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show less" }));

    expect(screen.queryByTestId("overview-needs-pool-sync")).not.toBeInTheDocument();
  });

  it("does not list an item once its underlying condition is gone", async () => {
    vi.spyOn(starterWorkService, "fetchPool").mockResolvedValue([
      starterTask({ id: "pool-1", taskZeroEligible: true }),
    ]);
    vi.mocked(arrivalService.listDerivableSteps).mockResolvedValue([
      derivableStep({ key: "github-account", added: true }),
    ]);

    renderTab("overview");
    await screen.findByTestId("overview-stage-arrival");

    expect(screen.queryByTestId("overview-needs-task0-none")).not.toBeInTheDocument();
    expect(screen.queryByTestId("overview-needs-arrival-derivable")).not.toBeInTheDocument();
    // Still unseen, so "Needs you" itself is not empty.
    expect(screen.getByTestId("overview-needs-pool-unseen")).toBeInTheDocument();
  });

  it("jumps to the Starter work tab and opens the triage from 'Go through them'", async () => {
    renderTab("overview");

    fireEvent.click(
      within(await screen.findByTestId("overview-needs-pool-unseen")).getByRole("button", {
        name: "Go through them",
      }),
    );

    expect(await screen.findByTestId("add-tasks-menu")).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "Go through tasks nobody has looked at" }),
    ).toBeInTheDocument();
  });

  it("jumps to Starter work's Closed filter from 'Review closed'", async () => {
    // A distinct STALE list this time: the Task 0 task itself went stale, which is the one
    // "closed" case that is actually actionable — it means no live task can serve as Task 0.
    vi.spyOn(starterWorkService, "fetchPool").mockImplementation((status) =>
      Promise.resolve(
        status === "STALE"
          ? [starterTask({ id: "stale-1", taskZeroEligible: true })]
          : [
              starterTask({ id: "pool-1", taskZeroEligible: false }),
              starterTask({ id: "pool-2", taskZeroEligible: false }),
            ],
      ),
    );

    renderTab("overview");

    fireEvent.click(
      within(await screen.findByTestId("overview-needs-task0-closed")).getByRole("button", {
        name: "Review closed",
      }),
    );

    expect(await screen.findByTestId("add-tasks-menu")).toBeInTheDocument();
    expect(
      screen
        .getByRole("group", { name: "Filter pool tasks" })
        .querySelector('[aria-pressed="true"]'),
    ).toHaveTextContent("Closed");
  });

  it("jumps to Starter work and syncs the pool from 'Sync now'", async () => {
    const reconcileSpy = vi.spyOn(starterWorkService, "reconcile").mockResolvedValue({
      examined: 0,
      markedStale: 0,
      revived: 0,
      assigneeChanged: 0,
      skipped: 0,
    });

    renderTab("overview");

    fireEvent.click(await screen.findByRole("button", { name: "Show all" }));
    fireEvent.click(
      within(await screen.findByTestId("overview-needs-pool-sync")).getByRole("button", {
        name: "Sync now",
      }),
    );

    expect(await screen.findByTestId("add-tasks-menu")).toBeInTheDocument();
    await waitFor(() => expect(reconcileSpy).toHaveBeenCalledTimes(1));
  });

  it("jumps to the Starter work tab's pool with Task 0 already filtered from 'Choose Task 0'", async () => {
    renderTab("overview");

    fireEvent.click(await screen.findByTestId("overview-stage-task0"));

    expect(await screen.findByTestId("add-tasks-menu")).toBeInTheDocument();
    // Landed on the dedicated Pool section (not Overview), filter chips visible with Task 0 pressed.
    expect(
      screen
        .getByRole("group", { name: "Filter pool tasks" })
        .querySelector('[aria-pressed="true"]'),
    ).toHaveTextContent("Task 0");
  });

  it("jumps to the Arrival tab and opens the add wizard from a readiness check", async () => {
    renderTab("overview");

    fireEvent.click(
      within(await screen.findByTestId("overview-needs-arrival-derivable")).getByRole("button", {
        name: "Add them",
      }),
    );

    // The wizard opens on its own — no need to click "Add step" first, unlike a plain tab switch.
    expect(await screen.findByRole("dialog", { name: "Add a step" })).toBeInTheDocument();
  });

  it("jumps to the Arrival tab from the Arrive stage card itself without opening the wizard", async () => {
    renderTab("overview");

    fireEvent.click(await screen.findByTestId("overview-stage-arrival"));

    expect(await screen.findByRole("button", { name: "Add step" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("old First Week routes", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(arrivalService.listSteps).mockResolvedValue([]);
    vi.mocked(arrivalService.listDerivableSteps).mockResolvedValue([]);
    vi.spyOn(starterWorkService, "fetchUnreviewed").mockResolvedValue({ tasks: [] });
    vi.spyOn(starterWorkService, "fetchPool").mockResolvedValue([]);
    vi.spyOn(starterWorkService, "fetchCandidates").mockResolvedValue([]);
    vi.spyOn(userService, "getMyProjects").mockResolvedValue([]);
  });

  function renderRedirect(path: string) {
    return render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/arrival-steps"
            element={<Navigate to="/first-week?tab=arrival" replace />}
          />
          <Route path="/starter-work" element={<Navigate to="/first-week?tab=starter" replace />} />
          <Route path="/first-week" element={<FirstWeekPage />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it("redirects /arrival-steps to the Arrival tab", async () => {
    renderRedirect("/arrival-steps");

    expect(await screen.findByRole("button", { name: "Add step" })).toBeInTheDocument();
  });

  it("redirects /starter-work to the Starter work tab", async () => {
    renderRedirect("/starter-work");

    expect(await screen.findByTestId("add-tasks-menu")).toBeInTheDocument();
  });
});
