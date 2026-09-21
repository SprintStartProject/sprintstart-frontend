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

  /**
   * Differs from an amendment by one line of copy, and that line is the whole point: confirming
   * the wrong one changes a card in a way the hire did not mean. A copy-paste that made a tick
   * say "Added to the end of that list" is exactly the bug this pins.
   */
  describe("proposed ticks", () => {
    const ticks = () =>
      action({
        action: "tick_checklist_items",
        label: "Tick these off",
        cardId: "card-7",
        checklistItems: ["Run it locally"],
      });

    it("says it ticks, and never that it adds", () => {
      render(
        <BuddyActionProposals
          messageId="m1"
          actions={[ticks()]}
          onConfirm={vi.fn()}
          onDismiss={vi.fn()}
        />,
      );

      expect(screen.getByText(/ticked off on that list/i)).toBeInTheDocument();
      expect(screen.queryByText(/added to the end/i)).not.toBeInTheDocument();
      expect(screen.getByText(/Run it locally/)).toBeInTheDocument();
    });

    it("carries the card and the lines back on confirm", async () => {
      const onConfirm = vi.fn();
      render(
        <BuddyActionProposals
          messageId="m1"
          actions={[ticks()]}
          onConfirm={onConfirm}
          onDismiss={vi.fn()}
        />,
      );

      await userEvent.click(screen.getByRole("button", { name: /tick these off/i }));

      expect(onConfirm.mock.calls[0][1]).toMatchObject({
        cardId: "card-7",
        checklistItems: ["Run it locally"],
      });
    });
  });

  /** The one offer that replaces something, so it has to say which wording is leaving. */
  describe("a proposed rewording", () => {
    const reword = (overrides: Partial<ProposedAction> = {}) =>
      action({
        action: "reword_checklist_item",
        label: "Reword this line",
        cardId: "card-7",
        lineBefore: "Fix it",
        lineAfter: "Fix the redirect so it keeps the query string",
        ...overrides,
      });

    it("marks the old wording as removed and the new one as added", () => {
      const { container } = render(
        <BuddyActionProposals
          messageId="m1"
          actions={[reword()]}
          onConfirm={vi.fn()}
          onDismiss={vi.fn()}
        />,
      );

      // The elements carry the meaning; the spoken labels carry it where they are not announced.
      expect(container.querySelector("del")?.textContent).toBe("Currently: Fix it");
      expect(container.querySelector("ins")?.textContent).toBe(
        "Would become: Fix the redirect so it keeps the query string",
      );
    });

    it("carries both wordings back on confirm", async () => {
      const onConfirm = vi.fn();
      render(
        <BuddyActionProposals
          messageId="m1"
          actions={[reword()]}
          onConfirm={onConfirm}
          onDismiss={vi.fn()}
        />,
      );

      await userEvent.click(screen.getByRole("button", { name: /reword this line/i }));

      expect(onConfirm.mock.calls[0][1]).toMatchObject({
        cardId: "card-7",
        lineBefore: "Fix it",
        lineAfter: "Fix the redirect so it keeps the query string",
      });
    });

    it("renders no rewording for another action that happens to carry both fields", () => {
      render(
        <BuddyActionProposals
          messageId="m1"
          actions={[reword({ action: "amend_checklist", label: "Add these to the list" })]}
          onConfirm={vi.fn()}
          onDismiss={vi.fn()}
        />,
      );

      // By the words, not by the elements: keyed off the fields alone, this rendered both
      // wordings as plain paragraphs, so asserting "no <del>" would have passed either way.
      expect(screen.queryByText(/Fix the redirect/)).not.toBeInTheDocument();
      expect(screen.queryByText("Fix it")).not.toBeInTheDocument();
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
        screen.getByRole("button", { name: /try again: open the task packet/i }),
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
