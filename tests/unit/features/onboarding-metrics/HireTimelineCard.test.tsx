import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { HireTimelineCard } from "../../../../src/features/onboarding-metrics/components/HireTimelineCard";
import type { HireTimeline } from "../../../../src/features/onboarding-metrics/types";

const hire = (over: Partial<HireTimeline> = {}): HireTimeline => ({
  userId: "h1",
  displayName: "Ada",
  githubLogin: "ada",
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

describe("HireTimelineCard", () => {
  it("names the moments as the work, not as the mechanism carrying it", () => {
    render(<HireTimelineCard hire={hire()} />);

    expect(screen.getByText("Change started")).toBeInTheDocument();
    expect(screen.getByText("Merged")).toBeInTheDocument();
  });

  it("counts accepted work, and uses the singular for one", () => {
    render(<HireTimelineCard hire={hire({ acceptedContributionCount: 1 })} />);
    expect(screen.getByText(/1 change merged/)).toBeInTheDocument();
  });

  it("frames a wait as owed by somebody else, whatever the work is", () => {
    render(
      <HireTimelineCard
        hire={hire({
          firstResponseAt: null,
          firstContributionAcceptedAt: null,
          openContributionCount: 1,
          longestOpenWaitHours: 72,
        })}
      />,
    );

    // "Receiving a response" is the barrier the research names; the fix is a conversation with
    // whoever owes it, so the card must not read as the hire being slow.
    expect(screen.getByText(/Waiting .* on a response/)).toBeInTheDocument();
  });

  it("says work cannot be attributed when there is no GitHub login", () => {
    render(<HireTimelineCard hire={hire({ githubLogin: null })} />);

    expect(screen.getByText(/can't be attributed/)).toBeInTheDocument();
  });
});
