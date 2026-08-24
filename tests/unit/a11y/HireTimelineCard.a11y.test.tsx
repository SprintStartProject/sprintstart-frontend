import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { axe } from "vitest-axe";
import { HireTimelineCard } from "../../../src/features/onboarding-metrics/components/HireTimelineCard";
import type { HireTimeline } from "../../../src/features/onboarding-metrics/types";

vi.mock("../../../src/components/common/UserAvatar", () => ({
  UserAvatar: () => <svg role="img" aria-label="User Avatar" width="40" height="40" />,
}));

const hire: HireTimeline = {
  userId: "u1",
  displayName: "Alice Smith",
  githubLogin: "alice",
  joinedAt: "2026-07-01T00:00:00.000Z",
  firstTaskClaimedAt: "2026-07-01T02:00:00.000Z",
  firstContributionOpenedAt: "2026-07-01T05:00:00.000Z",
  firstResponseAt: null,
  firstContributionAcceptedAt: null,
  hoursToFirstAcceptedContribution: null,
  hoursToFirstResponse: null,
  acceptedContributionCount: 0,
  openContributionCount: 2,
  longestOpenWaitHours: 20,
  stalled: false,
  stalledReason: null,
};

describe("HireTimelineCard Accessibility", () => {
  it("should not have any a11y violations", async () => {
    const { baseElement } = render(
      <main>
        <HireTimelineCard hire={hire} />
      </main>,
    );

    expect(screen.getByText("Alice Smith")).toBeInTheDocument();

    expect(await axe(baseElement)).toHaveNoViolations();
  });
});
