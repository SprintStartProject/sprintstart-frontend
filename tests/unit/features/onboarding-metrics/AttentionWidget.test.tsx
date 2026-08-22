import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AttentionWidget } from "../../../../src/features/onboarding-metrics/components/AttentionWidget";
import type { ProjectAttention } from "../../../../src/features/onboarding-metrics/types";

vi.mock("../../../../src/services/onboardingMetricsService", () => ({
  onboardingMetricsService: {
    fetchAttention: vi.fn(),
  },
}));

import { onboardingMetricsService } from "../../../../src/services/onboardingMetricsService";

const attention: ProjectAttention = {
  projectId: "p1",
  memberCount: 3,
  items: [
    {
      hireId: "h1",
      hireName: "Ada",
      reason: "A pull request has been waiting 3 days for a response",
      severity: "BLOCKED",
      days: 3,
    },
    {
      hireId: "h2",
      hireName: "Grace",
      reason: "No activity since joining",
      severity: "DRIFTING",
      days: 6,
    },
  ],
};

describe("AttentionWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders stalls and waiting PRs with whose move it is — and nothing else", async () => {
    vi.mocked(onboardingMetricsService.fetchAttention).mockResolvedValue(attention);

    render(<AttentionWidget projectId="p1" />);

    expect(await screen.findByText("Ada")).toBeInTheDocument();
    expect(screen.getByText("Grace")).toBeInTheDocument();
    expect(screen.getByText("Waiting")).toBeInTheDocument();
    expect(screen.getByText("Drifting")).toBeInTheDocument();
    expect(screen.getByText(/waiting 3 days for a response/)).toBeInTheDocument();

    // The retired human-buddy loop leaves no affordances behind.
    expect(screen.queryByRole("button", { name: /log contact/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /assign/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /manage buddies/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/paired/)).not.toBeInTheDocument();
    expect(screen.queryByText(/buddy/i)).not.toBeInTheDocument();
  });

  it("reads the attention list from the metrics endpoint", async () => {
    vi.mocked(onboardingMetricsService.fetchAttention).mockResolvedValue(attention);

    render(<AttentionWidget projectId="p1" />);

    await screen.findByText("Ada");
    expect(onboardingMetricsService.fetchAttention).toHaveBeenCalledWith("p1");
  });

  it("says so when nobody is waiting or drifting", async () => {
    vi.mocked(onboardingMetricsService.fetchAttention).mockResolvedValue({
      projectId: "p1",
      memberCount: 2,
      items: [],
    });

    render(<AttentionWidget projectId="p1" />);

    expect(await screen.findByText(/Nobody is waiting or drifting right now/)).toBeInTheDocument();
  });
});
