import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { axe } from "vitest-axe";
import { BuddyActionProposals } from "../../../src/features/buddy/components/BuddyActionProposals";
import type { ProposedAction } from "../../../src/features/buddy/types";

function flag(overrides: Partial<ProposedAction> = {}): ProposedAction {
  return {
    id: "a1",
    action: "flag_to_pm",
    label: "Flag this to your PM",
    question: "How do we request staging database credentials?",
    status: "idle",
    ...overrides,
  };
}

/** Rendered the way the thread does: with a session-held store for the one field that is editable. */
function renderFlag(action: ProposedAction) {
  return render(
    <main>
      <BuddyActionProposals
        messageId="m1"
        actions={[action]}
        actionDrafts={{}}
        setActionDraft={vi.fn()}
        onConfirm={vi.fn()}
        onDismiss={vi.fn()}
      />
    </main>,
  );
}

describe("BuddyActionProposals Accessibility", () => {
  it("has no violations on the flag's own question field", async () => {
    // The one proposal that carries an editable message: the field has to be a labelled control
    // with its hint announced, exactly like every other text field in the app.
    const { baseElement } = renderFlag(flag());

    expect(await axe(baseElement)).toHaveNoViolations();
  });

  it("has no violations on a flag that came back unsent, its card still under the reason", async () => {
    const { baseElement } = renderFlag(
      flag({ status: "resolved", ok: false, outcome: "I could not send that just now." }),
    );

    expect(await axe(baseElement)).toHaveNoViolations();
  });

  it("has no violations on a flag the hire has emptied out", async () => {
    // Emptied is an *error* state, not a silent dead button: the message is announced
    // (`role="alert"`), and the field is marked invalid and described by it.
    const { baseElement } = renderFlag(flag({ question: "   " }));

    expect(await axe(baseElement)).toHaveNoViolations();
  });
});
