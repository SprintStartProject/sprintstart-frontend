import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { MemoryRouter, useLocation } from "react-router-dom";
import { ProjectAnalysisLauncher } from "../../../../../src/features/pm-area/analysis/ProjectAnalysisLauncher";
import { countBySeverity } from "../../../../../src/features/pm-area/analysis/findings";
import type {
  ProjectAnalysisRun,
  SaveProjectAnalysisRun,
} from "../../../../../src/services/projectAnalysisService";

const mocks = vi.hoisted(() => ({
  industryCustom: false,
  getTeamOverviewOrThrow: vi.fn(),
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
  /** The backend's analysis history for the project, newest first. */
  runs: [] as ProjectAnalysisRun[],
  listRuns: vi.fn(),
  saveRun: vi.fn(),
}));

vi.mock("../../../../../src/services/teamManagementService", () => ({
  getTeamOverviewOrThrow: mocks.getTeamOverviewOrThrow,
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
vi.mock("../../../../../src/services/projectAnalysisService", () => ({
  projectAnalysisService: { listRuns: mocks.listRuns, saveRun: mocks.saveRun },
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

/** The button starts a run straight away: there is nothing to choose any more. */
async function runAnalysis(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: /Analyse project/ }));
  await screen.findByText(/Where the points went/, {}, { timeout: 8000 });
}

/** Like `runAnalysis`, for a run in which a check fails: its results have no points breakdown. */
async function runIncompleteAnalysis(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: /Analyse project/ }));
  await screen.findByText(/Could not run/, {}, { timeout: 8000 });
}

function storedRun() {
  return mocks.runs[0] ?? null;
}

describe("ProjectAnalysisLauncher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.runs = [];
    // An in-memory backend: what was stored is what the next mount reads.
    mocks.listRuns.mockImplementation(() => Promise.resolve([...mocks.runs]));
    mocks.saveRun.mockImplementation((_projectId: string, run: SaveProjectAnalysisRun) => {
      const saved: ProjectAnalysisRun = {
        ...run,
        id: `run-${mocks.runs.length + 1}`,
        at: new Date().toISOString(),
        counts: countBySeverity(run.findings),
        failedChecks: run.tasks.filter((task) => task.status === "failed").length,
      };
      mocks.runs = [saved, ...mocks.runs];
      return Promise.resolve(saved);
    });
    mocks.getTeamOverviewOrThrow.mockResolvedValue([
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

  it("only reads — it never asks the AI to redo work — and lists what it found", async () => {
    const user = userEvent.setup();
    renderLauncher();

    await runAnalysis(user);

    const dialog = within(screen.getByTestId("project-analysis-dialog"));
    expect(dialog.getByText("1 skip request waiting for your answer")).toBeInTheDocument();
    // The gaps and the industry update on their own after every import, so no AI call by default.
    expect(mocks.refreshKnowledgeGaps).not.toHaveBeenCalled();
    expect(mocks.evaluateProjectIndustry).not.toHaveBeenCalled();
    // Destructive, so off unless asked for.
    expect(mocks.refreshFAQGroups).not.toHaveBeenCalled();
    // Kept on the backend, for every PM of the project.
    expect(mocks.saveRun).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({ score: expect.any(Number) as number }),
    );
    // The score says what it is out of, and what it means.
    const health = within(dialog.getByRole("complementary", { name: "Project health" }));
    expect(health.getByText("/ 100")).toBeInTheDocument();
    expect(health.getByText(/means nothing is open/)).toBeInTheDocument();
  }, 20000);

  it("starts a new run straight away from the results", async () => {
    const user = userEvent.setup();
    renderLauncher();

    await runAnalysis(user);
    expect(mocks.saveRun).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: /Run again/ }));
    await screen.findByText(/Where the points went/, {}, { timeout: 8000 });

    await waitFor(() => expect(mocks.saveRun).toHaveBeenCalledTimes(2));
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

  it("has no a11y violations on its results", async () => {
    const user = userEvent.setup();
    const { baseElement } = renderLauncher();

    await runAnalysis(user);
    expect(await axe(baseElement)).toHaveNoViolations();
  }, 30000);

  it("says what it is checking while it runs, and keeps a log", async () => {
    // Held open, so the run stays in progress long enough to look at: with no artificial delay
    // any more, it is otherwise over in a moment.
    let releaseGaps: (value: { gaps: never[] }) => void = () => {};
    mocks.fetchKnowledgeGaps.mockReturnValue(
      new Promise((resolve) => {
        releaseGaps = resolve;
      }),
    );
    const user = userEvent.setup();
    const { baseElement } = renderLauncher();

    await user.click(await screen.findByRole("button", { name: /Analyse project/ }));

    const now = within(await screen.findByRole("region", { name: "Now checking" }));
    expect(await now.findByText("Reading the documentation gaps")).toBeInTheDocument();
    const log = within(screen.getByRole("region", { name: "Log" }));
    expect(await log.findByText(/Team & open items: 1 member ·/)).toBeInTheDocument();
    expect(await axe(baseElement)).toHaveNoViolations();

    releaseGaps({ gaps: [] });
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

    // Not grouped by area: one list, most pressing first, each finding naming its area.
    const all = within(dialog.getByRole("region", { name: "All areas findings" }));
    const titles = all.getAllByRole("listitem").map((item) => item.textContent ?? "");
    expect(titles[0]).toContain("1 skip request waiting for your answer");
    expect(titles.findIndex((text) => text.includes("No sources connected"))).toBeGreaterThan(0);
    expect(all.queryByRole("region", { name: "Team findings" })).not.toBeInTheDocument();

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

    // The ring beside the tabs: the score, what it means and when, and a way back to the results.
    expect(
      await screen.findByRole("button", {
        name: /Open last results: health \d+ of 100, .*last run/,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Last health score \d+ of 100/ })).toBeInTheDocument();
  }, 20000);

  it("opens the last results again later, without running anything", async () => {
    const user = userEvent.setup();
    const { unmount } = renderLauncher();

    await runAnalysis(user);
    unmount();
    vi.clearAllMocks();
    renderLauncher();

    await user.click(await screen.findByRole("button", { name: /Open last results/ }));

    const dialog = within(await screen.findByTestId("project-analysis-dialog"));
    expect(dialog.getByText("1 skip request waiting for your answer")).toBeInTheDocument();
    expect(mocks.getTeamOverviewOrThrow).not.toHaveBeenCalled();
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

  describe("when a check cannot run", () => {
    it("gives no score instead of counting the failed check as clean", async () => {
      mocks.listOpen.mockRejectedValue(new Error("Backend unavailable"));
      const user = userEvent.setup();
      renderLauncher();

      await runIncompleteAnalysis(user);

      const dialog = within(screen.getByTestId("project-analysis-dialog"));
      const health = within(dialog.getByRole("complementary", { name: "Project health" }));
      expect(health.getByText("Incomplete")).toBeInTheDocument();
      expect(health.queryByText("/ 100")).not.toBeInTheDocument();
      expect(health.queryByText(/Where the points went/)).not.toBeInTheDocument();
      // Which check failed, and why.
      expect(health.getByText("Escalation inbox")).toBeInTheDocument();
      expect(health.getByText("Backend unavailable")).toBeInTheDocument();
      // On the map, the area says it was not checked — not a green "nothing here".
      const areas = within(dialog.getByRole("navigation", { name: "Areas" }));
      expect(
        within(areas.getByRole("button", { name: /Escalations/ })).getByLabelText(
          "Could not be checked",
        ),
      ).toBeInTheDocument();
      // The checks that did run still say what they found.
      expect(dialog.getByText("1 skip request waiting for your answer")).toBeInTheDocument();
      expect(storedRun()?.score).toBeNull();
    }, 20000);

    it("does not score 100 when every read fails", async () => {
      const down = new Error("Backend unavailable");
      mocks.getTeamOverviewOrThrow.mockRejectedValue(down);
      mocks.fetchProjectMetrics.mockRejectedValue(down);
      mocks.listOpen.mockRejectedValue(down);
      mocks.fetchFAQGroups.mockRejectedValue(down);
      mocks.fetchKnowledgeGaps.mockRejectedValue(down);
      mocks.fetchIngestionSources.mockRejectedValue(down);
      mocks.getAccessibleProject.mockRejectedValue(down);
      const user = userEvent.setup();
      renderLauncher();

      await runIncompleteAnalysis(user);

      const dialog = within(screen.getByTestId("project-analysis-dialog"));
      expect(dialog.queryByText("In great shape")).not.toBeInTheDocument();
      const health = within(dialog.getByRole("complementary", { name: "Project health" }));
      expect(health.getByText(/7 checks could not run/)).toBeInTheDocument();
      expect(storedRun()?.score).toBeNull();
    }, 20000);

    it("marks the team check failed instead of reporting on made-up members", async () => {
      mocks.getTeamOverviewOrThrow.mockRejectedValue(new Error("Team overview unavailable"));
      const user = userEvent.setup();
      renderLauncher();

      await runIncompleteAnalysis(user);

      const dialog = within(screen.getByTestId("project-analysis-dialog"));
      const health = within(dialog.getByRole("complementary", { name: "Project health" }));
      expect(health.getByText("Team & open items")).toBeInTheDocument();
      expect(dialog.queryByText("1 skip request waiting for your answer")).not.toBeInTheDocument();
    }, 20000);

    it("marks the team check failed when a member's feedback cannot be read", async () => {
      mocks.getTeamOverviewOrThrow.mockResolvedValue([
        {
          userId: "u1",
          firstname: "Ada",
          lastname: "Lovelace",
          projects: [],
          roles: [],
          skills: [],
          progressPercentage: 0.5,
          currentPhase: { id: "p", title: "Setup" },
          currentStep: null,
          hasFeedback: true,
        },
      ]);
      mocks.getUserOnboardingFeedback.mockRejectedValue(new Error("Forbidden"));
      const user = userEvent.setup();
      renderLauncher();

      await runIncompleteAnalysis(user);

      const health = within(screen.getByRole("complementary", { name: "Project health" }));
      expect(health.getByText("Feedback of 1 member could not be read")).toBeInTheDocument();
    }, 20000);

    it("says so on the ring beside the tabs, not a score", async () => {
      mocks.listOpen.mockRejectedValue(new Error("Backend unavailable"));
      const user = userEvent.setup();
      const { unmount } = renderLauncher();

      await runIncompleteAnalysis(user);
      unmount();
      renderLauncher();

      expect(
        await screen.findByRole("button", {
          name: /Open last results: last run .* incomplete, 1 check could not run, no health score/,
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("img", { name: "Last run incomplete, no health score" }),
      ).toBeInTheDocument();
    }, 20000);

    it("keeps an incomplete run without a score on the backend", async () => {
      mocks.listOpen.mockRejectedValue(new Error("Backend unavailable"));
      const user = userEvent.setup();
      renderLauncher();

      await runIncompleteAnalysis(user);

      expect(mocks.saveRun).toHaveBeenCalledWith("p1", expect.objectContaining({ score: null }));
    }, 20000);

    it("still shows the results when the history cannot be stored", async () => {
      mocks.saveRun.mockRejectedValue(new Error("Backend unavailable"));
      const user = userEvent.setup();
      renderLauncher();

      await runAnalysis(user);

      const dialog = within(screen.getByTestId("project-analysis-dialog"));
      expect(dialog.getByText("1 skip request waiting for your answer")).toBeInTheDocument();
      // Said on the results, not only in the console: they are gone after a reload.
      expect(dialog.getByText(/Not saved/)).toBeInTheDocument();
    }, 20000);

    it("does not claim 'never analysed' while the history is still loading", () => {
      mocks.listRuns.mockImplementation(() => new Promise(() => {}));
      renderLauncher();

      const ring = screen.getByTestId("project-analysis-open");
      expect(ring).toBeDisabled();
      expect(ring).toHaveAccessibleName("Loading the project's health");
      expect(screen.queryByLabelText("No health score yet")).not.toBeInTheDocument();
    });

    it("does not store a new run on every press when the history cannot be read", async () => {
      mocks.listRuns.mockRejectedValue(new Error("Forbidden"));
      const user = userEvent.setup();
      renderLauncher();

      const ring = await screen.findByRole("button", { name: /could not be loaded/ });
      await user.click(ring);

      // The dialog opens on its start screen; nothing runs until the manager asks for it.
      expect(await screen.findByTestId("project-analysis-dialog")).toBeInTheDocument();
      expect(mocks.saveRun).not.toHaveBeenCalled();
      expect(mocks.getTeamOverviewOrThrow).not.toHaveBeenCalled();
    });

    it("compares the next complete run with the last complete one, not the incomplete one", async () => {
      const user = userEvent.setup();
      renderLauncher();

      // Complete, then incomplete, then complete again with the same answers.
      await runAnalysis(user);
      mocks.listOpen.mockRejectedValueOnce(new Error("Backend unavailable"));
      await user.click(screen.getByRole("button", { name: /Run again/ }));
      await screen.findByText(/Could not run/, {}, { timeout: 8000 });
      // No comparison on the incomplete run.
      expect(screen.queryByText(/since the run|Same as the run/)).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /Run again/ }));
      await screen.findByText(/Where the points went/, {}, { timeout: 8000 });

      expect(screen.getByText(/Same as the run/)).toBeInTheDocument();
    }, 40000);

    it("has no a11y violations on incomplete results", async () => {
      mocks.listOpen.mockRejectedValue(new Error("Backend unavailable"));
      const user = userEvent.setup();
      const { baseElement } = renderLauncher();

      await runIncompleteAnalysis(user);

      expect(await axe(baseElement)).toHaveNoViolations();
    }, 30000);
  });
});
