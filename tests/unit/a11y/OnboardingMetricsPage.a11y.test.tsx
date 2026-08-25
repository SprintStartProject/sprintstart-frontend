import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { axe } from "vitest-axe";
import { MemoryRouter } from "react-router-dom";
import { OnboardingMetricsPage } from "../../../src/features/onboarding-metrics/components/OnboardingMetricsPage";

vi.mock("../../../src/hooks/useFetch", () => ({
  useFetch: () => ({
    data: {
      projectId: "proj1",
      memberCount: 2,
      unattributableMemberCount: 0,
      hiresWithAcceptedContribution: 1,
      medianHoursToFirstAcceptedContribution: 30,
      medianHoursToFirstResponse: 4,
      p90HoursToFirstResponse: 12,
      stalledCount: 1,
      waitingOnResponseCount: 1,
      hires: [
        {
          userId: "u1",
          displayName: "Alice Smith",
          githubLogin: "alice",
          joinedAt: "2026-07-01T00:00:00.000Z",
          firstTaskClaimedAt: "2026-07-01T02:00:00.000Z",
          firstContributionOpenedAt: "2026-07-01T05:00:00.000Z",
          firstResponseAt: "2026-07-01T09:00:00.000Z",
          firstContributionAcceptedAt: "2026-07-02T06:00:00.000Z",
          hoursToFirstAcceptedContribution: 30,
          hoursToFirstResponse: 4,
          acceptedContributionCount: 1,
          openContributionCount: 0,
          longestOpenWaitHours: null,
          stalled: false,
          stalledReason: null,
        },
        {
          userId: "u2",
          displayName: "Bob Jones",
          githubLogin: null,
          joinedAt: "2026-07-01T00:00:00.000Z",
          firstTaskClaimedAt: "2026-07-01T03:00:00.000Z",
          firstContributionOpenedAt: "2026-07-01T08:00:00.000Z",
          firstResponseAt: null,
          firstContributionAcceptedAt: null,
          hoursToFirstAcceptedContribution: null,
          hoursToFirstResponse: null,
          acceptedContributionCount: 0,
          openContributionCount: 2,
          longestOpenWaitHours: 20,
          stalled: true,
          stalledReason: "No response on their first pull request",
        },
      ],
    },
    loading: false,
    error: false,
  }),
}));

vi.mock("../../../src/services/onboardingMetricsService", () => ({
  onboardingMetricsService: {
    fetchProjectMetrics: vi.fn(),
  },
}));

describe("OnboardingMetricsPage Accessibility", () => {
  it("should not have any a11y violations", async () => {
    const { baseElement } = render(
      <MemoryRouter>
        <OnboardingMetricsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument();
    });

    expect(await axe(baseElement)).toHaveNoViolations();
  });
});

// The page reads the selected project to scope its request; the hook throws
// outside a ProjectProvider, so it is stubbed rather than provider-wrapped.
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
      }),
  };
});
