import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { HireTimeline } from "../../../../src/features/onboarding-metrics/types";

// The page reads the selected project; the hook throws outside a provider, so stub it.
vi.mock("../../../../src/features/projects/useProjectContext", async () => {
  const { createProjectContextValue, createSelectableProject } =
    await import("../../setup/projectContext");
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

vi.mock("../../../../src/context/useToast", () => ({
  useToast: () => ({ error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() }),
}));

const hire = (over: Partial<HireTimeline>): HireTimeline => ({
  userId: "x",
  displayName: "Someone",
  githubLogin: "someone",
  joinedAt: "2026-07-01T09:00:00Z",
  firstTaskClaimedAt: "2026-07-02T09:00:00Z",
  firstContributionOpenedAt: "2026-07-03T09:00:00Z",
  firstResponseAt: "2026-07-03T15:00:00Z",
  firstContributionAcceptedAt: "2026-07-04T09:00:00Z",
  hoursToFirstAcceptedContribution: 72,
  hoursToFirstResponse: 6,
  acceptedContributionCount: 2,
  openContributionCount: 0,
  longestOpenWaitHours: null,
  stalled: false,
  stalledReason: null,
  ...over,
});

const metrics = {
  projectId: "proj1",
  memberCount: 2,
  unattributableMemberCount: 0,
  hiresWithAcceptedContribution: 1,
  medianHoursToFirstAcceptedContribution: 72,
  medianHoursToFirstResponse: 6,
  p90HoursToFirstResponse: 12,
  stalledCount: 1,
  waitingOnResponseCount: 0,
  hires: [
    hire({
      userId: "a",
      displayName: "Ada",
      githubLogin: "ada",
      stalled: true,
      stalledReason: "x",
    }),
    hire({ userId: "b", displayName: "Bob", githubLogin: "bob" }),
    // Healthy active contributor: has open work in flight but already gets
    // responses. Must NOT count as needing attention (the old criterion wrongly
    // flagged anyone with an open contribution).
    hire({
      userId: "c",
      displayName: "Cleo",
      githubLogin: "cleo",
      openContributionCount: 3,
      firstResponseAt: "2026-07-03T15:00:00Z",
      acceptedContributionCount: 50,
    }),
  ],
};

// Return the metrics synchronously — the filter is client-side, so the fetch shape
// is irrelevant to what this test proves.
vi.mock("../../../../src/hooks/useFetch", () => ({
  useFetch: () => ({ data: metrics, loading: false, error: false }),
}));

import { OnboardingMetricsPage } from "../../../../src/features/onboarding-metrics/components/OnboardingMetricsPage";

describe("OnboardingMetricsPage — per-hire filter", () => {
  it("updates the visible list when the filter changes to needs-attention-only", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <OnboardingMetricsPage />
      </MemoryRouter>,
    );

    // All hires show under the default "all" filter.
    expect(await screen.findByText("Ada")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Cleo")).toBeInTheDocument();

    // Open the filter dropdown and choose "needs attention only".
    await user.click(screen.getByRole("combobox", { name: "Filter hires" }));
    await user.click(screen.getByRole("option", { name: "Needs attention only" }));

    // Bob and Cleo (healthy) drop out; only Ada (stalled) stays.
    await waitFor(() => {
      expect(screen.queryByText("Bob")).not.toBeInTheDocument();
    });
    expect(screen.queryByText("Cleo")).not.toBeInTheDocument();
    expect(screen.getByText("Ada")).toBeInTheDocument();
  });

  it("narrows the list by the search box", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <OnboardingMetricsPage />
      </MemoryRouter>,
    );

    await screen.findByText("Ada");
    await user.type(screen.getByRole("textbox", { name: "Search hires by name" }), "bob");

    await waitFor(() => {
      expect(screen.queryByText("Ada")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });
});
