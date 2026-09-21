import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { axe } from "vitest-axe";
import { MemoryRouter } from "react-router-dom";
import { PmDashboardPage } from "../../../src/pages/PmDashboardPage";

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
  getUserOnboardingFeedback: vi.fn(() => Promise.resolve([])),
  getTeamOverview: vi.fn(() =>
    Promise.resolve([
      {
        userId: "bob",
        firstname: "Bob",
        lastname: "Builder",
        projects: [],
        roles: [],
        skills: [],
        progressPercentage: 0.5,
        currentPhase: { id: "p1", title: "Setup" },
        currentStep: {
          id: "s1",
          title: "Set up CI",
          startedAt: new Date().toISOString(),
          skip: null,
        },
        hasFeedback: true,
      },
    ]),
  ),
}));

vi.mock("../../../src/services/onboardingMetricsService", () => ({
  onboardingMetricsService: {
    fetchProjectMetrics: vi.fn(() =>
      Promise.resolve({ medianHoursToFirstAcceptedContribution: 30, hires: [], memberCount: 1 }),
    ),
  },
}));

vi.mock("../../../src/features/onboarding-metrics/hooks/useAttention", () => ({
  useAttention: () => ({ attention: null, isLoading: false, error: null, reload: vi.fn() }),
}));

vi.mock("../../../src/features/knowledge-request/useOpenEscalationCount", () => ({
  useOpenEscalationCount: () => 2,
}));

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

describe("PmDashboardPage Accessibility", () => {
  it("should not have any a11y violations", async () => {
    const { baseElement } = render(
      <MemoryRouter>
        <PmDashboardPage />
      </MemoryRouter>,
    );

    expect((await screen.findAllByText("Bob Builder")).length).toBeGreaterThan(0);

    expect(await axe(baseElement)).toHaveNoViolations();
  });
});
