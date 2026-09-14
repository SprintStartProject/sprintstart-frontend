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

  /**
   * The one action whose confirm writes the mentor's own sentences onto the hire's board. Which is
   * why the lines are on the offer: "Keep this" over words somebody else wrote is not something to
   * agree to blind.
   */
  describe("a proposed checklist", () => {
    const proposal = () =>
      action({
        action: "place_checklist",
        label: "Keep this as a checklist",
        checklistTitle: "Getting started on the skill-gap view",
        checklistItems: ["Find the component", "Run it locally", "Open a draft PR"],
      });

    it("shows what would be kept, before it is kept", () => {
      render(
        <BuddyActionProposals
          messageId="m1"
          actions={[proposal()]}
          onConfirm={vi.fn()}
          onDismiss={vi.fn()}
        />,
      );

      expect(screen.getByText("Getting started on the skill-gap view")).toBeInTheDocument();
      expect(screen.getByText(/Find the component/)).toBeInTheDocument();
      expect(screen.getByText(/Open a draft PR/)).toBeInTheDocument();
    });

    /** The lines ride back verbatim, so what is kept is what they read. */
    it("hands the lines back on confirm rather than re-deriving them", async () => {
      const onConfirm = vi.fn();
      render(
        <BuddyActionProposals
          messageId="m1"
          actions={[proposal()]}
          onConfirm={onConfirm}
          onDismiss={vi.fn()}
        />,
      );

      await userEvent.click(screen.getByRole("button", { name: /keep this as a checklist/i }));

      expect(onConfirm.mock.calls[0][1]).toMatchObject({
        checklistTitle: "Getting started on the skill-gap view",
        checklistItems: ["Find the component", "Run it locally", "Open a draft PR"],
      });
    });

    /** Every other action carries a target, not content — nothing to preview there. */
    it("previews nothing for an action that carries no list", () => {
      render(
        <BuddyActionProposals
          messageId="m1"
          actions={[action({})]}
          onConfirm={vi.fn()}
          onDismiss={vi.fn()}
        />,
      );

      expect(screen.queryByRole("list")).not.toBeInTheDocument();
    });
  });

  /** An addition to a list they already have, said as an addition. */
  describe("a proposed amendment", () => {
    it("names it as an addition and shows only the new lines", () => {
      render(
        <BuddyActionProposals
          messageId="m1"
          actions={[
            action({
              action: "amend_checklist",
              label: "Add these to the list",
              cardId: "card-7",
              checklistItems: ["Write the test", "Open a draft PR"],
            }),
          ]}
          onConfirm={vi.fn()}
          onDismiss={vi.fn()}
        />,
      );

      expect(screen.getByText(/nothing on it changes/i)).toBeInTheDocument();
      expect(screen.getByText(/Write the test/)).toBeInTheDocument();
    });

    it("carries the card it would be added to back on confirm", async () => {
      const onConfirm = vi.fn();
      render(
        <BuddyActionProposals
          messageId="m1"
          actions={[
            action({
              action: "amend_checklist",
              label: "Add these to the list",
              cardId: "card-7",
              checklistItems: ["Write the test"],
            }),
          ]}
          onConfirm={onConfirm}
          onDismiss={vi.fn()}
        />,
      );

      await userEvent.click(screen.getByRole("button", { name: /add these to the list/i }));

      expect(onConfirm.mock.calls[0][1]).toMatchObject({
        cardId: "card-7",
        checklistItems: ["Write the test"],
      });
    });
  });

  /** The label is the mentor's wording; the address is the part that has to be right. */
  describe("a proposed link", () => {
    it("shows the address as well as the label", () => {
      render(
        <BuddyActionProposals
          messageId="m1"
          actions={[
            action({
              action: "place_link",
              label: "Keep this link",
              linkUrl: "https://example.test/runbook",
              linkLabel: "The deploy runbook",
            }),
          ]}
          onConfirm={vi.fn()}
          onDismiss={vi.fn()}
        />,
      );

      expect(screen.getByText("The deploy runbook")).toBeInTheDocument();
      expect(screen.getByText("https://example.test/runbook")).toBeInTheDocument();
    });
  });

  describe("a proposed note", () => {
    it("shows the words that would be kept", () => {
      render(
        <BuddyActionProposals
          messageId="m1"
          actions={[
            action({
              action: "place_note",
              label: "Keep this as a note",
              noteText: "Deploys run on Thursdays\n\nBehind a feature flag.",
            }),
          ]}
          onConfirm={vi.fn()}
          onDismiss={vi.fn()}
        />,
      );

      expect(screen.getByText(/Deploys run on Thursdays/)).toBeInTheDocument();
    });
  });

  /**
   * A refusal is not always permanent, and the mentor is never told what became of a proposal — so
   * a spent confirm left the hire with no control while being asked to press one.
   */
  describe("an action that came back couldn't", () => {
    const refused = () =>
      action({
        action: "open_orientation",
        label: "Open the task packet",
        status: "resolved",
        ok: false,
        outcome: "I couldn't put a packet together just now.",
      });

    it("keeps the reason and offers it again under it", async () => {
      const onConfirm = vi.fn();
      render(
        <BuddyActionProposals
          messageId="m1"
          actions={[refused()]}
          onConfirm={onConfirm}
          onDismiss={vi.fn()}
        />,
      );

      expect(screen.getByText(/couldn't put a packet together/i)).toBeInTheDocument();
      await userEvent.click(
        screen.getByRole("button", { name: /try open the task packet again/i }),
      );

      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onConfirm.mock.calls[0][0]).toBe("m1");
    });

    /** Running a confirmed action twice is how somebody claims the same task twice. */
    it("offers nothing again once it worked", () => {
      render(
        <BuddyActionProposals
          messageId="m1"
          actions={[action({ status: "resolved", ok: true, outcome: "Task 0 is yours." })]}
          onConfirm={vi.fn()}
          onDismiss={vi.fn()}
        />,
      );

      expect(screen.queryByRole("button", { name: /again/i })).not.toBeInTheDocument();
    });
  });
});
