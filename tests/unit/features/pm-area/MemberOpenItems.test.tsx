import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { MemberOpenItems } from "../../../../src/features/pm-area/components/MemberOpenItems";
import type { TeamOverviewUser } from "../../../../src/features/team-management/types";

function member(overrides: Partial<TeamOverviewUser> = {}): TeamOverviewUser {
  return {
    userId: "u1",
    firstname: "Ada",
    lastname: "Lovelace",
    projects: [],
    roles: [],
    skills: [],
    progressPercentage: 0.5,
    currentPhase: { id: "p1", title: "Setup" },
    currentStep: {
      id: "s1",
      title: "Set up CI",
      startedAt: new Date().toISOString(),
      skip: {
        id: "skip1",
        stepId: "s1",
        reason: "Did this at my last job",
        status: "PENDING",
        reviewComment: null,
        reviewedAt: null,
      },
    },
    hasFeedback: true,
    ...overrides,
  };
}

function renderItems(props: Partial<Parameters<typeof MemberOpenItems>[0]> = {}) {
  const onReviewSkip = vi.fn();
  const onMarkRead = vi.fn();

  render(
    <MemberOpenItems
      member={member()}
      feedback={[
        { id: "f1", message: "The CI step links a dead page.", read: false },
        { id: "f2", message: "Already read this one.", read: true },
      ]}
      feedbackLoading={false}
      feedbackError={false}
      reviewingSkip={null}
      markingFeedbackId={null}
      onReviewSkip={onReviewSkip}
      onMarkRead={onMarkRead}
      {...props}
    />,
  );

  return { onReviewSkip, onMarkRead };
}

describe("MemberOpenItems", () => {
  it("puts the skip decision beside the request", async () => {
    const user = userEvent.setup();
    const { onReviewSkip } = renderItems();

    expect(screen.getByText(/Did this at my last job/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Approve" }));
    expect(onReviewSkip).toHaveBeenCalledWith("skip1", "accept");

    await user.click(screen.getByRole("button", { name: "Deny" }));
    expect(onReviewSkip).toHaveBeenCalledWith("skip1", "deny");
  });

  it("lists only unread feedback, each with a way to mark it read", async () => {
    const user = userEvent.setup();
    const { onMarkRead } = renderItems();

    expect(screen.getByText("The CI step links a dead page.")).toBeInTheDocument();
    expect(screen.queryByText("Already read this one.")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Mark read" }));
    expect(onMarkRead).toHaveBeenCalledWith("f1");
  });

  it("holds both skip buttons while one decision is being sent", () => {
    renderItems({ reviewingSkip: "accept" });

    expect(screen.getByRole("button", { name: /Approve/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Deny/ })).toBeDisabled();
  });

  it("says nothing is waiting when nothing is", () => {
    renderItems({
      member: member({ currentStep: null, hasFeedback: false }),
      feedback: [],
    });

    expect(screen.getByText("Nothing waiting on you.")).toBeInTheDocument();
  });
});
