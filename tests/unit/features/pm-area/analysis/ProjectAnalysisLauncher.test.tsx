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
  await screen.findByText(
    /worth your attention|Nothing needs you right now/,
    {},
    { timeout: 8000 },
  );
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
    expect(dialog.getByRole("img", { name: /Project health \d+ of 100/ })).toBeInTheDocument();
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
    await screen.findByText(/worth your attention/, {}, { timeout: 8000 });
    expect(await axe(baseElement)).toHaveNoViolations();
  }, 30000);

  it("remembers the score for the next visit", async () => {
    const user = userEvent.setup();
    const { unmount } = renderLauncher();

    await runAnalysis(user);
    unmount();
    renderLauncher();

    expect(screen.getByText(/Last run/)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Last score \d+ of 100/ })).toBeInTheDocument();
  }, 20000);
});
