import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { MemoryRouter, useLocation } from "react-router-dom";
import { ProjectAnalysisLauncher } from "../../../../../src/features/pm-area/analysis/ProjectAnalysisLauncher";

const mocks = vi.hoisted(() => ({
  industryCustom: false,
  getTeamOverview: vi.fn(),
  getUserOnboardingFeedback: vi.fn(),
  fetchProjectMetrics: vi.fn(),
  fetchAttention: vi.fn(),
  listOpen: vi.fn(),
  fetchFAQGroups: vi.fn(),
  refreshFAQGroups: vi.fn(),
  fetchKnowledgeGaps: vi.fn(),
  refreshKnowledgeGaps: vi.fn(),
  fetchIngestionSources: vi.fn(),
  getAccessibleProject: vi.fn(),
  evaluateProjectIndustry: vi.fn(),
}));

vi.mock("../../../../../src/services/teamManagementService", () => ({
  getTeamOverview: mocks.getTeamOverview,
  getUserOnboardingFeedback: mocks.getUserOnboardingFeedback,
}));
vi.mock("../../../../../src/services/onboardingMetricsService", () => ({
  onboardingMetricsService: {
    fetchProjectMetrics: mocks.fetchProjectMetrics,
    fetchAttention: mocks.fetchAttention,
  },
}));
vi.mock("../../../../../src/services/knowledgeRequestService", () => ({
  knowledgeRequestService: { listOpen: mocks.listOpen },
}));
vi.mock("../../../../../src/services/faqService", () => ({
  insightsService: {
    fetchFAQGroups: mocks.fetchFAQGroups,
    refreshFAQGroups: mocks.refreshFAQGroups,
  },
}));
vi.mock("../../../../../src/services/knowledgeGapService", () => ({
  knowledgeGapService: {
    fetchKnowledgeGaps: mocks.fetchKnowledgeGaps,
    refreshKnowledgeGaps: mocks.refreshKnowledgeGaps,
  },
}));
vi.mock("../../../../../src/features/data-ingestion/ingestionSources", () => ({
  fetchIngestionSources: mocks.fetchIngestionSources,
}));
vi.mock("../../../../../src/services/projectService", () => ({
  projectService: {
    getAccessibleProject: mocks.getAccessibleProject,
    evaluateProjectIndustry: mocks.evaluateProjectIndustry,
  },
}));
vi.mock("../../../../../src/context/useAuth", () => ({
  useAuth: () => ({ profile: { id: "pm-1", permissionGroup: "PM" } }),
}));
vi.mock("../../../../../src/features/projects/useProjectContext", async () => {
  const { createProjectContextValue, createSelectableProject } =
    await import("../../../setup/projectContext");
  const project = createSelectableProject({ id: "p1", isManaged: true });
  return {
    useProjectContext: () =>
      createProjectContextValue({
        projects: [project],
        selectedProject: project,
        selectedProjectId: "p1",
      }),
  };
});

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

function renderLauncher() {
  return render(
    <MemoryRouter initialEntries={["/pm-dashboard"]}>
      <ProjectAnalysisLauncher />
      <LocationProbe />
    </MemoryRouter>,
  );
}

async function runAnalysis(
  user: ReturnType<typeof userEvent.setup>,
  beforeStart?: () => Promise<void>,
) {
  await user.click(screen.getByRole("button", { name: /Analyse project/ }));
  await beforeStart?.();
  await user.click(screen.getByRole("button", { name: /Start analysis/ }));
  // Each check shows for a moment on purpose, so the whole scan takes a couple of seconds.
  await screen.findByText(/Where the points went/, {}, { timeout: 8000 });
}

describe("ProjectAnalysisLauncher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    mocks.getTeamOverview.mockResolvedValue([
      {
        userId: "u1",
        firstname: "Ada",
        lastname: "Lovelace",
        projects: [],
        roles: [],
        skills: [],
        progressPercentage: 0.5,
        currentPhase: { id: "p", title: "Setup" },
        currentStep: {
          id: "s1",
          title: "Set up CI",
          startedAt: new Date().toISOString(),
          skip: {
            id: "k1",
            stepId: "s1",
            reason: "Done it before",
            status: "PENDING",
            reviewComment: null,
            reviewedAt: null,
          },
        },
        hasFeedback: false,
      },
    ]);
    mocks.fetchProjectMetrics.mockResolvedValue({
      projectId: "p1",
      memberCount: 1,
      unattributableMemberCount: 0,
      hiresWithAcceptedContribution: 0,
      medianHoursToFirstAcceptedContribution: null,
      medianHoursToFirstResponse: null,
      p90HoursToFirstResponse: null,
      stalledCount: 0,
      waitingOnResponseCount: 0,
      hires: [],
    });
    mocks.fetchAttention.mockResolvedValue({ projectId: "p1", memberCount: 1, items: [] });
    mocks.listOpen.mockResolvedValue([]);
    mocks.fetchFAQGroups.mockResolvedValue({ groups: [] });
    mocks.refreshFAQGroups.mockResolvedValue({ groupCount: 0 });
    mocks.fetchKnowledgeGaps.mockResolvedValue({ gaps: [] });
    mocks.refreshKnowledgeGaps.mockResolvedValue({ gapCount: 0 });
    mocks.fetchIngestionSources.mockResolvedValue([]);
    // Read at call time, so a test can flip `industryCustom` after this runs.
    mocks.getAccessibleProject.mockImplementation(() =>
      Promise.resolve({
        id: "p1",
        industry: "Fintech",
        industryConfidence: "high",
        industryCustom: mocks.industryCustom,
      }),
    );
    mocks.evaluateProjectIndustry.mockResolvedValue({
      industry: "Fintech",
      confidence: "high",
      evidence: [],
    });
    mocks.industryCustom = false;
  });

  it("refreshes everything at once and lists what it found", async () => {
    const user = userEvent.setup();
    renderLauncher();

    await runAnalysis(user);

    const dialog = within(screen.getByTestId("project-analysis-dialog"));
    expect(dialog.getByText("1 skip request waiting for your answer")).toBeInTheDocument();
    expect(mocks.refreshKnowledgeGaps).toHaveBeenCalledWith("p1");
    expect(mocks.evaluateProjectIndustry).toHaveBeenCalledWith("p1");
    // Destructive, so off unless asked for.
    expect(mocks.refreshFAQGroups).not.toHaveBeenCalled();
    // The score says what it is out of, and what it means.
    const health = within(dialog.getByRole("complementary", { name: "Project health" }));
    expect(health.getByText("/ 100")).toBeInTheDocument();
    expect(health.getByText(/means nothing is open/)).toBeInTheDocument();
  }, 20000);

  it("asks what to refresh again before running again", async () => {
    const user = userEvent.setup();
    renderLauncher();

    await runAnalysis(user);
    expect(mocks.refreshKnowledgeGaps).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: /Run again/ }));

    // The same first step as the strip's button: the options and a start button, no run yet.
    expect(await screen.findByLabelText(/Rescan knowledge gaps/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Start analysis/ })).toBeInTheDocument();
    expect(mocks.refreshKnowledgeGaps).toHaveBeenCalledTimes(1);
  }, 20000);

  it("never re-evaluates an industry somebody set by hand", async () => {
    mocks.industryCustom = true;
    const user = userEvent.setup();
    renderLauncher();

    await runAnalysis(user);

    expect(mocks.evaluateProjectIndustry).not.toHaveBeenCalled();
  }, 20000);

  it("regroups the recurring questions only when asked to", async () => {
    const user = userEvent.setup();
    renderLauncher();

    await runAnalysis(user, async () => {
      await user.click(screen.getByLabelText(/Regroup recurring questions/));
    });

    expect(mocks.refreshFAQGroups).toHaveBeenCalledWith("p1");
  }, 20000);

  it("takes the manager to where a finding can be acted on", async () => {
    const user = userEvent.setup();
    renderLauncher();

    await runAnalysis(user);
    await user.click(
      screen.getByRole("button", { name: "Open: 1 skip request waiting for your answer" }),
    );

    expect(screen.getByTestId("location")).toHaveTextContent("/team/u1");
    await waitFor(() => {
      expect(screen.queryByTestId("project-analysis-dialog")).not.toBeInTheDocument();
    });
  }, 20000);

  it("has no a11y violations, before the scan or on its results", async () => {
    const user = userEvent.setup();
    const { baseElement } = renderLauncher();

    await user.click(screen.getByRole("button", { name: /Analyse project/ }));
    expect(await axe(baseElement)).toHaveNoViolations();

    await user.click(screen.getByRole("button", { name: /Start analysis/ }));
    await screen.findByText(/Where the points went/, {}, { timeout: 8000 });
    expect(await axe(baseElement)).toHaveNoViolations();
  }, 30000);

  it("says what it is checking while it runs, and keeps a log", async () => {
    const user = userEvent.setup();
    const { baseElement } = renderLauncher();

    await user.click(screen.getByRole("button", { name: /Analyse project/ }));
    await user.click(screen.getByRole("button", { name: /Start analysis/ }));

    const now = within(await screen.findByRole("region", { name: "Now checking" }));
    expect(
      await now.findByText("Asking the AI to rescan every component's documentation"),
    ).toBeInTheDocument();
    const log = within(screen.getByRole("region", { name: "Log" }));
    expect(await log.findByText(/Team & open items: 1 member ·/)).toBeInTheDocument();
    expect(await axe(baseElement)).toHaveNoViolations();

    await screen.findByText(/Where the points went/, {}, { timeout: 8000 });
  }, 30000);

  it("opens on every area at once, and narrows to one on request", async () => {
    const user = userEvent.setup();
    renderLauncher();

    await runAnalysis(user);
    const dialog = within(screen.getByTestId("project-analysis-dialog"));
    const areas = within(dialog.getByRole("navigation", { name: "Areas" }));

    // Nothing chosen: every area's findings at once.
    expect(
      areas.getAllByRole("button").every((area) => area.getAttribute("aria-pressed") === "false"),
    ).toBe(true);
    expect(dialog.getByText("1 skip request waiting for your answer")).toBeInTheDocument();
    expect(dialog.getByText("No sources connected")).toBeInTheDocument();

    const sources = areas.getByRole("button", { name: /Data sources/ });
    await user.click(sources);
    expect(dialog.queryByText("1 skip request waiting for your answer")).not.toBeInTheDocument();
    expect(dialog.getByText("No sources connected")).toBeInTheDocument();

    // The area already shown, chosen again, goes back to all of them.
    await user.click(sources);
    expect(dialog.getByText("1 skip request waiting for your answer")).toBeInTheDocument();
  }, 20000);

  it("remembers the score for the next visit", async () => {
    const user = userEvent.setup();
    const { unmount } = renderLauncher();

    await runAnalysis(user);
    unmount();
    renderLauncher();

    expect(screen.getByText(/Last run/)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Last health score \d+ of 100/ })).toBeInTheDocument();
  }, 20000);

  it("opens the last results again later, without running anything", async () => {
    const user = userEvent.setup();
    const { unmount } = renderLauncher();

    await runAnalysis(user);
    unmount();
    vi.clearAllMocks();
    renderLauncher();

    await user.click(screen.getByRole("button", { name: /Open last results/ }));

    const dialog = within(await screen.findByTestId("project-analysis-dialog"));
    expect(dialog.getByText("1 skip request waiting for your answer")).toBeInTheDocument();
    expect(mocks.getTeamOverview).not.toHaveBeenCalled();
  }, 20000);

  it("shows every finding in one list, with no filter bar on top", async () => {
    const user = userEvent.setup();
    renderLauncher();

    await runAnalysis(user);
    const dialog = within(screen.getByTestId("project-analysis-dialog"));

    expect(dialog.getByText("1 skip request waiting for your answer")).toBeInTheDocument();
    expect(dialog.queryByRole("group", { name: "Show findings" })).not.toBeInTheDocument();
  }, 20000);

  it("tells the overview after every finished run, so the cards outside the cache read again", async () => {
    const user = userEvent.setup();
    const onRefreshed = vi.fn();
    render(
      <MemoryRouter initialEntries={["/pm-dashboard"]}>
        <ProjectAnalysisLauncher onRefreshed={onRefreshed} />
      </MemoryRouter>,
    );

    await runAnalysis(user);

    await waitFor(() => expect(onRefreshed).toHaveBeenLastCalledWith(1));
  }, 20000);
});
