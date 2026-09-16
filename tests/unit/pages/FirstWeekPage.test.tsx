import { fireEvent, render, screen, within } from "@testing-library/react";
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

    expect(await screen.findByRole("heading", { name: "Arrival" })).toBeInTheDocument();
  });

  it("opens the Starter work tab from a ?tab=starter deep link", async () => {
    renderTab("starter");

    expect(await screen.findByRole("heading", { name: "Starter Work" })).toBeInTheDocument();
  });

  it("switches from Arrival to Starter work through the tab bar", async () => {
    renderTab("arrival");
    await screen.findByRole("heading", { name: "Arrival" });

    fireEvent.click(screen.getByRole("button", { name: "Starter work" }));

    expect(await screen.findByRole("heading", { name: "Starter Work" })).toBeInTheDocument();
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
    ...over,
  };
}

/**
 * The Overview tab reads live data through the same hooks Arrival and Starter work use — no
 * summary endpoint of its own — so its tests set up the same service mocks those tabs' own tests
 * do, just with fixtures chosen to exercise the counts and the "Up next" list together.
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

  it("counts the merged arrival list, Task 0 and the pool", async () => {
    renderTab("overview");

    const arrivalCard = await screen.findByTestId("overview-stage-arrival");
    // 2 company steps + 1 project addition, none overridden — 3, not the company list's own 2.
    expect(within(arrivalCard).getByText("3")).toBeInTheDocument();
    expect(within(arrivalCard).getByText("1 checked automatically")).toBeInTheDocument();
    expect(within(arrivalCard).getByText("1 added by Project One")).toBeInTheDocument();

    const taskZeroCard = screen.getByTestId("overview-stage-task0");
    expect(within(taskZeroCard).getByText("0")).toBeInTheDocument();
    expect(within(taskZeroCard).getByText("No Task 0 yet")).toBeInTheDocument();

    const starterCard = screen.getByTestId("overview-stage-starter");
    expect(within(starterCard).getByText("2")).toBeInTheDocument();
    expect(within(starterCard).getByText("1 not looked at yet")).toBeInTheDocument();
  });

  it("lists up to three things worth a PM's attention, built from the same data", async () => {
    renderTab("overview");

    // Unseen tasks, no Task 0, and the missing derivable step — all three fire from this fixture.
    expect(await screen.findByTestId("overview-upnext-unseen")).toHaveTextContent(
      "1 task nobody has looked at yet",
    );
    expect(screen.getByTestId("overview-upnext-no-task-zero")).toHaveTextContent("No Task 0 yet");
    expect(screen.getByTestId("overview-upnext-derivable")).toHaveTextContent(
      "Development environment works",
    );
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

    expect(screen.queryByTestId("overview-upnext-no-task-zero")).not.toBeInTheDocument();
    expect(screen.queryByTestId("overview-upnext-derivable")).not.toBeInTheDocument();
    // Still unseen, so "Up next" itself is not empty.
    expect(screen.getByTestId("overview-upnext-unseen")).toBeInTheDocument();
  });

  it("jumps to the Starter work tab and opens the triage from 'Go through them'", async () => {
    renderTab("overview");

    fireEvent.click(
      within(await screen.findByTestId("overview-upnext-unseen")).getByRole("button", {
        name: "Go through them",
      }),
    );

    expect(await screen.findByRole("heading", { name: "Starter Work" })).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "Go through tasks nobody has looked at" }),
    ).toBeInTheDocument();
  });

  it("jumps to the Starter work tab's pool with Task 0 already filtered from 'Choose Task 0'", async () => {
    renderTab("overview");

    fireEvent.click(await screen.findByTestId("overview-stage-task0"));

    expect(await screen.findByRole("heading", { name: "Starter Work" })).toBeInTheDocument();
    // Landed on the dedicated Pool section (not Overview), filter chips visible with Task 0 pressed.
    expect(
      screen
        .getByRole("group", { name: "Filter pool tasks" })
        .querySelector('[aria-pressed="true"]'),
    ).toHaveTextContent("Task 0");
  });

  it("jumps to the Arrival tab from the missing derivable step", async () => {
    renderTab("overview");

    fireEvent.click(
      within(await screen.findByTestId("overview-upnext-derivable")).getByRole("button", {
        name: "Add it",
      }),
    );

    expect(await screen.findByRole("heading", { name: "Arrival" })).toBeInTheDocument();
  });

  it("jumps to the Arrival tab from the Arrive stage card itself", async () => {
    renderTab("overview");

    fireEvent.click(await screen.findByTestId("overview-stage-arrival"));

    expect(await screen.findByRole("heading", { name: "Arrival" })).toBeInTheDocument();
  });
});

/**
 * Every other page's header rule sits at the same height; Arrival's ran a line lower because its
 * subtitle was the longest in the app and wrapped where the others do not.
 */
describe("Arrival section header", () => {
  beforeEach(() => {
    vi.mocked(arrivalService.listSteps).mockResolvedValue([]);
    vi.mocked(arrivalService.listDerivableSteps).mockResolvedValue([]);
  });

  it("keeps the subtitle inside the band the other pages sit in", async () => {
    renderTab("arrival");

    // Measured against the built stylesheet: at `max-w-2xl` and `text-sm` the subtitle wraps
    // past 105 characters, and every other page in the app is under that.
    const subtitle = await screen.findByText(/What somebody needs before they can start/);
    expect(subtitle.textContent.length).toBeLessThanOrEqual(105);
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

    expect(await screen.findByRole("heading", { name: "Arrival" })).toBeInTheDocument();
  });

  it("redirects /starter-work to the Starter work tab", async () => {
    renderRedirect("/starter-work");

    expect(await screen.findByRole("heading", { name: "Starter Work" })).toBeInTheDocument();
  });
});
