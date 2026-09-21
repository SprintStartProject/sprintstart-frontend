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
    action: "claim_task_zero",
    label: "Start Task 0",
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

    await userEvent.click(screen.getByRole("button", { name: /Start Task 0/ }));

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
        actions={[action({ status: "resolved", ok: true, outcome: "Task 0 is yours." })]}
        onConfirm={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByText("Task 0 is yours.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Start Task 0/ })).not.toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: /Start Task 0/ })).toBeInTheDocument();
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
        actions={[action({ status: "resolved", ok: true, outcome: "Task 0 is yours." })]}
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

  describe("stored team proposals", () => {
    function storedAction(overrides: Partial<ProposedAction> = {}): ProposedAction {
      return {
        id: "s1",
        proposalId: "prop-9",
        label: "Shift Task 0",
        preview: "Jonas takes Task 0 instead.",
        risk: "DESTRUCTIVE",
        status: "idle",
        ...overrides,
      };
    }

    it("shows what the manager is agreeing to, and how loud the warning is", () => {
      render(
        <BuddyActionProposals
          messageId="m1"
          actions={[storedAction()]}
          onConfirm={vi.fn()}
          onDismiss={vi.fn()}
        />,
      );

      expect(screen.getByText("Jonas takes Task 0 instead.")).toBeInTheDocument();
      // Colour-blind rule: the risk badge is words next to an icon, never colour alone.
      const badge = screen.getByTestId("buddy-proposal-risk");
      expect(badge).toHaveTextContent("Cannot be undone");
      expect(badge.querySelector("svg")).toBeInTheDocument();
    });

    it("blocks confirmation when the proposal arrived without its details", async () => {
      const onConfirm = vi.fn();
      const onDismiss = vi.fn();
      render(
        <BuddyActionProposals
          messageId="m1"
          actions={[storedAction({ risk: null, preview: null })]}
          onConfirm={onConfirm}
          onDismiss={onDismiss}
        />,
      );

      // No badge, no preview, no confirm: an approval card for a project mutation must never
      // guess how loudly to warn, so it refuses to offer the confirmation at all.
      expect(screen.queryByTestId("buddy-proposal-risk")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Shift Task 0/ })).not.toBeInTheDocument();
      expect(screen.getByTestId("buddy-proposal-unsupported")).toHaveTextContent(
        "cannot be confirmed here",
      );
      // Declining is still available: a proposal you cannot verify still needs an answer.
      await userEvent.click(screen.getByRole("button", { name: /Not now/ }));
      expect(onDismiss).toHaveBeenCalledWith("m1", "s1");
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it("puts the details before the controls and describes the confirm by them", () => {
      render(
        <BuddyActionProposals
          messageId="m1"
          actions={[storedAction()]}
          onConfirm={vi.fn()}
          onDismiss={vi.fn()}
        />,
      );

      const preview = screen.getByText("Jonas takes Task 0 instead.");
      const confirm = screen.getByRole("button", { name: /Shift Task 0/ });
      // DOM order, not just visual order: a screen reader walking the card meets the offer
      // before the button that accepts it.
      expect(
        preview.compareDocumentPosition(confirm) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(confirm).toHaveAttribute("aria-describedby", preview.id);
    });

    it("tones the badge down for a standard change", () => {
      render(
        <BuddyActionProposals
          messageId="m1"
          actions={[storedAction({ risk: "STANDARD" })]}
          onConfirm={vi.fn()}
          onDismiss={vi.fn()}
        />,
      );

      expect(screen.getByTestId("buddy-proposal-risk")).toHaveTextContent("Standard change");
    });

    it("scales to bulk changes", () => {
      render(
        <BuddyActionProposals
          messageId="m1"
          actions={[storedAction({ risk: "BULK" })]}
          onConfirm={vi.fn()}
          onDismiss={vi.fn()}
        />,
      );

      expect(screen.getByTestId("buddy-proposal-risk")).toHaveTextContent("Affects everyone");
    });

    it("confirms by id — the click passes the whole stored proposal through", async () => {
      const onConfirm = vi.fn();
      render(
        <BuddyActionProposals
          messageId="m1"
          actions={[storedAction()]}
          onConfirm={onConfirm}
          onDismiss={vi.fn()}
        />,
      );

      await userEvent.click(screen.getByRole("button", { name: /Shift Task 0/ }));

      expect(onConfirm).toHaveBeenCalledWith(
        "m1",
        expect.objectContaining({ proposalId: "prop-9" }),
      );
    });

    it("dismisses without mutating", async () => {
      const onDismiss = vi.fn();
      render(
        <BuddyActionProposals
          messageId="m1"
          actions={[storedAction()]}
          onConfirm={vi.fn()}
          onDismiss={onDismiss}
        />,
      );

      await userEvent.click(screen.getByRole("button", { name: /Not now/ }));

      expect(onDismiss).toHaveBeenCalledWith("m1", "s1");
      expect(onDismiss.mock.calls[0][1]).not.toBe("prop-9");
    });

    it("hides the buttons once the outcome is known, whatever it was", () => {
      render(
        <BuddyActionProposals
          messageId="m1"
          actions={[storedAction({ status: "resolved", ok: false, outcome: "Nothing changed." })]}
          onConfirm={vi.fn()}
          onDismiss={vi.fn()}
        />,
      );

      expect(screen.getByText("Nothing changed.")).toBeInTheDocument();
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
  });
});
