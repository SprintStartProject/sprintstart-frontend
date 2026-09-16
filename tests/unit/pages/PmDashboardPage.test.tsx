import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { PmDashboardPage } from "../../../src/pages/PmDashboardPage";
import type { TeamOverviewUser } from "../../../src/features/team-management/types";

const mocks = vi.hoisted(() => ({
  roster: [] as unknown[],
  attentionItems: [] as unknown[],
  openEscalations: 0,
}));

vi.mock("../../../src/features/projects/useProjectContext", async () => {
  const { createProjectContextValue, createSelectableProject } =
    await import("../setup/projectContext");
  const project = createSelectableProject({ id: "proj1" });
  return {
    useProjectContext: () =>
      createProjectContextValue({
        projects: [project],
        selectedProject: project,
        selectedProjectId: "proj1",
        canManageSelected: true,
      }),
  };
});

vi.mock("../../../src/services/teamManagementService", () => ({
  getTeamOverview: vi.fn(() => Promise.resolve(mocks.roster)),
}));

vi.mock("../../../src/services/onboardingMetricsService", () => ({
  onboardingMetricsService: {
    fetchProjectMetrics: vi.fn(() =>
      Promise.resolve({ medianHoursToFirstAcceptedContribution: 30, hires: [], memberCount: 3 }),
    ),
  },
}));

vi.mock("../../../src/features/onboarding-metrics/hooks/useAttention", () => ({
  useAttention: () => ({
    attention: { projectId: "proj1", memberCount: 3, items: mocks.attentionItems },
    isLoading: false,
    error: null,
    reload: vi.fn(),
  }),
}));

vi.mock("../../../src/features/knowledge-request/useOpenEscalationCount", () => ({
  useOpenEscalationCount: () => mocks.openEscalations,
}));

// The insight cards and the project-setup cards read their own endpoints and have nothing to do
// with what this page composes; each is a stand-in here.
vi.mock("../../../src/features/pm-area/components/overview/InsightCards", () => ({
  OnboardingHealthCard: () => <section aria-label="Onboarding health" />,
  QuestionsCard: () => <section aria-label="Recurring questions" />,
  KnowledgeGapsCard: () => <section aria-label="Knowledge gaps" />,
}));

vi.mock("../../../src/features/data-ingestion/components/IngestionStatusWidget", () => ({
  IngestionStatusWidget: () => <section aria-label="Data ingestion" />,
}));

vi.mock("../../../src/features/projects/industry/ProjectIndustryWidget", () => ({
  ProjectIndustryWidget: () => <section aria-label="Industry" />,
}));

function member(overrides: Partial<TeamOverviewUser>): TeamOverviewUser {
  return {
    userId: "u0",
    firstname: "Test",
    lastname: "Member",
    projects: [],
    roles: [],
    skills: [],
    progressPercentage: 0,
    currentPhase: { id: "p1", title: "Setup" },
    currentStep: null,
    hasFeedback: false,
    ...overrides,
  };
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.search}</output>;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/pm-dashboard"]}>
      <Routes>
        <Route
          path="/pm-dashboard"
          element={
            <>
              <PmDashboardPage />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

const recently = new Date().toISOString();

describe("PmDashboardPage", () => {
  beforeEach(() => {
    mocks.roster = [
      // `progressPercentage` is a fraction: 1 is a finished onboarding, not 1%.
      member({ userId: "ada", firstname: "Ada", lastname: "Lovelace", progressPercentage: 1 }),
      member({
        userId: "bob",
        firstname: "Bob",
        lastname: "Builder",
        progressPercentage: 0.4,
        currentStep: {
          id: "s1",
          title: "Set up CI",
          startedAt: recently,
          skip: {
            id: "skip1",
            stepId: "s1",
            reason: "Already done this",
            status: "PENDING",
            reviewComment: null,
            reviewedAt: null,
          },
        },
      }),
      member({ userId: "cleo", firstname: "Cleo", lastname: "Park", hasFeedback: true }),
    ];
    mocks.attentionItems = [
      {
        hireId: "dan",
        hireName: "Dan Brown",
        reason: "Waiting 3 days on a review",
        severity: "BLOCKED",
        days: 3,
      },
    ];
    mocks.openEscalations = 4;
  });

  it("leads with the figures a manager acts on", async () => {
    renderPage();

    const figures = within(await screen.findByRole("region", { name: "Key figures" }));
    expect((await figures.findByRole("link", { name: /Team members/ })).textContent).toContain(
      "1 through onboarding",
    );
    expect(figures.getByRole("link", { name: /Team members/ })).toHaveTextContent("3");
    expect(figures.getByRole("link", { name: /Waiting on you/ })).toHaveTextContent("2");
    expect(figures.getByRole("link", { name: /Open escalations/ })).toHaveTextContent("4");
    expect(figures.getByRole("link", { name: /Open escalations/ })).toHaveAttribute(
      "href",
      "/insights/knowledge-requests",
    );
  });

  it("lists everybody who needs the manager in one queue, most blocking first", async () => {
    renderPage();

    const queue = within(await screen.findByRole("region", { name: "Needs you" }));
    const rows = await queue.findAllByRole("button");

    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Bob Builder"),
      expect.stringContaining("Cleo Park"),
      expect.stringContaining("Dan Brown"),
    ]);
    expect(rows[0]).toHaveTextContent("Skip request");
    expect(rows[1]).toHaveTextContent("Feedback");
    expect(rows[2]).toHaveTextContent("Waiting on review");
  });

  it("opens a person in the member panel rather than on another page", async () => {
    const user = userEvent.setup();
    renderPage();

    const queue = within(await screen.findByRole("region", { name: "Needs you" }));
    await user.click(await queue.findByRole("button", { name: /Bob Builder/ }));

    expect(screen.getByTestId("location")).toHaveTextContent("?member=bob");
  });

  it("says so when nobody needs anything", async () => {
    mocks.roster = [member({ userId: "ada", firstname: "Ada", progressPercentage: 1 })];
    mocks.attentionItems = [];
    renderPage();

    expect(await screen.findByText("All clear")).toBeInTheDocument();
  });
});
