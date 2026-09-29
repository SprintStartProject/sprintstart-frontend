import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { BuddyThread } from "../../../../src/features/buddy/components/BuddyThread";
import type { BuddyMessageView } from "../../../../src/features/buddy/types";

/**
 * Where the greeting's suggested next step lands, and where it steps aside.
 *
 * `lastMessageFooter` is the opener action's button — shown only while nobody has spoken — so it
 * belongs under the newest reply rather than an older one. Two rules decide where it goes, and
 * both are easy to lose in a refactor of the row selection: it follows the *newest* reply even
 * when that reply has no prose (a proposal-only turn is still a turn), and it yields to a reply
 * that brings a next step of its own, because two offers under one bubble read as two competing
 * ones.
 *
 * The overlap the second rule guards cannot happen today — `streamOpenBuddy` has no
 * `action_proposal` case and never writes `actions` onto the greeting — which is exactly why it
 * is worth a test rather than only a comment: the day a greeting can carry a proposal, this file
 * fails instead of the page quietly showing both.
 *
 * The bubble is stood in for (its avatar wants an auth provider, and its drawing has its own
 * tests); what this file reads is the order of what lands inside it.
 */
vi.mock("../../../../src/features/buddy/components/BuddyMessage", () => ({
  BuddyMessage: ({ children, footer }: { children?: ReactNode; footer?: ReactNode }) => (
    <div data-testid="buddy-row">
      {children}
      {footer}
    </div>
  ),
}));

const OPENING = "Welcome. Let's get you set up.";
const REPLY = "Step one is the packet.";

function message(overrides: Partial<BuddyMessageView> & { id: string }): BuddyMessageView {
  return {
    role: "ASSISTANT",
    content: "",
    createdAt: "2026-08-03T00:00:00Z",
    ...overrides,
  };
}

const BASE_PROPS = {
  isThinking: false,
  isStreaming: false,
  activeTool: null,
  confirmAction: vi.fn(),
  dismissAction: vi.fn(),
};

const SUGGESTED_STEP = <button type="button">Start with the packet</button>;

describe("the opener suggestion's place in the thread", () => {
  it("hangs under the newest reply, not under an older one", () => {
    render(
      <BuddyThread
        {...BASE_PROPS}
        messages={[message({ id: "a1", content: OPENING }), message({ id: "a2", content: REPLY })]}
        lastMessageFooter={SUGGESTED_STEP}
      />,
    );

    const footer = screen.getByRole("button", { name: "Start with the packet" });
    const newest = screen.getByText(REPLY);

    expect(newest.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("steps aside for a reply that brings its own next step", () => {
    render(
      <BuddyThread
        {...BASE_PROPS}
        messages={[
          message({ id: "a1", content: OPENING }),
          message({
            id: "a2",
            actions: [
              { id: "act1", action: "claim_task_zero", label: "Start Task 0", status: "idle" },
            ],
          }),
        ]}
        lastMessageFooter={SUGGESTED_STEP}
      />,
    );

    // The reply's own offer is there…
    expect(screen.getByRole("button", { name: /Start Task 0/ })).toBeInTheDocument();

    // …and the opener's is not, anywhere: not doubled up under that reply, and not pushed back
    // onto the greeting above it either.
    expect(screen.queryByRole("button", { name: "Start with the packet" })).not.toBeInTheDocument();
  });
});
