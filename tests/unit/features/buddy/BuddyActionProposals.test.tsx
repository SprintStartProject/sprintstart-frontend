import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { BuddyActionProposals } from "../../../../src/features/buddy/components/BuddyActionProposals";
import type { ProposedAction } from "../../../../src/features/buddy/types";

// The card has its own test file; here we only assert *whether* it renders.
vi.mock("../../../../src/features/buddy/components/BuddyOrientationCard", () => ({
  BuddyOrientationCard: () => <div data-testid="buddy-orientation-card" />,
}));

function action(overrides: Partial<ProposedAction> = {}): ProposedAction {
  return {
    id: "a1",
    action: "claim_goal",
    label: "Work toward this task",
    status: "idle",
    ...overrides,
  };
}

describe("BuddyActionProposals", () => {
  it("confirms only when the hire clicks — the proposal itself mutates nothing", async () => {
    const onConfirm = vi.fn();
    render(
      <BuddyActionProposals
        messageId="m1"
        actions={[action()]}
        onConfirm={onConfirm}
        onDismiss={vi.fn()}
      />,
    );

    // Rendering the offer must not fire the action.
    expect(onConfirm).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /Work toward this task/ }));

    expect(onConfirm).toHaveBeenCalledWith("m1", expect.objectContaining({ id: "a1" }));
  });

  it("declines without mutating", async () => {
    const onDismiss = vi.fn();
    const onConfirm = vi.fn();
    render(
      <BuddyActionProposals
        messageId="m1"
        actions={[action()]}
        onConfirm={onConfirm}
        onDismiss={onDismiss}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /Not now/ }));

    expect(onDismiss).toHaveBeenCalledWith("m1", "a1");
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("shows the outcome line once resolved instead of the buttons", () => {
    render(
      <BuddyActionProposals
        messageId="m1"
        actions={[
          action({ status: "resolved", ok: true, outcome: "You are now working toward it." }),
        ]}
        onConfirm={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByText("You are now working toward it.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Work toward this task/ })).not.toBeInTheDocument();
  });

  it("offers a retry on a transport error", () => {
    render(
      <BuddyActionProposals
        messageId="m1"
        actions={[action({ status: "error" })]}
        onConfirm={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByText(/try again/i)).toBeInTheDocument();
    // The confirm button is still there to retry.
    expect(screen.getByRole("button", { name: /Work toward this task/ })).toBeInTheDocument();
  });

  it("renders the orientation packet in the thread once open_orientation resolves", () => {
    // The conversation is the surface now: confirming must not navigate anywhere.
    render(
      <BuddyActionProposals
        messageId="m1"
        actions={[
          action({
            action: "open_orientation",
            label: "Open the task packet",
            status: "resolved",
            ok: true,
            outcome: "Here is your task orientation.",
          }),
        ]}
        onConfirm={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByTestId("buddy-orientation-card")).toBeInTheDocument();
  });

  it("renders no orientation card for other actions, or when open_orientation could not", () => {
    const { rerender } = render(
      <BuddyActionProposals
        messageId="m1"
        actions={[
          action({ status: "resolved", ok: true, outcome: "You are now working toward it." }),
        ]}
        onConfirm={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("buddy-orientation-card")).not.toBeInTheDocument();

    rerender(
      <BuddyActionProposals
        messageId="m1"
        actions={[
          action({
            action: "open_orientation",
            label: "Open the task packet",
            status: "resolved",
            ok: false,
            outcome: "There is no current task to open a packet for yet.",
          }),
        ]}
        onConfirm={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("buddy-orientation-card")).not.toBeInTheDocument();
  });

  it("shows the question a flag will send, not just the button", () => {
    // The button only says that something will be flagged. What lands in the PM's inbox is
    // the question the buddy composed, and the hire sends it in their name.
    render(
      <BuddyActionProposals
        messageId="m1"
        actions={[
          action({
            action: "flag_to_pm",
            label: "Flag this to your PM",
            question: "Who owns the staging database credentials?",
          }),
        ]}
        onConfirm={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(
      screen.getByText("Sends to your PM: “Who owns the staging database credentials?”"),
    ).toBeInTheDocument();
  });

  it("shows no message line for an action that sends nobody anything", () => {
    render(
      <BuddyActionProposals
        messageId="m1"
        actions={[action({ action: "claim_goal", label: "Work toward this task", taskId: "t1" })]}
        onConfirm={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.queryByText(/Sends to your PM/)).not.toBeInTheDocument();
  });

  it("shows the whole skip reason before the hire sends it in their name", () => {
    render(
      <BuddyActionProposals
        messageId="m1"
        actions={[
          action({
            action: "request_skip",
            label: "Ask your PM to skip “Set up the VPN”",
            stepId: "s1",
            reason: "I already have VPN access from my last team.",
          }),
        ]}
        onConfirm={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(
      screen.getByText("Your reason: “I already have VPN access from my last team.”"),
    ).toBeInTheDocument();
  });
});
