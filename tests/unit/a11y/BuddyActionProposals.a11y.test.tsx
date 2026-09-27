import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { axe } from "vitest-axe";
import { BuddyActionProposals } from "../../../src/features/buddy/components/BuddyActionProposals";
import type { ProposedAction } from "../../../src/features/buddy/types";

describe("BuddyActionProposals Accessibility", () => {
  it("has no violations on a flag whose question is edited before it is sent", async () => {
    // The one proposal that carries an editable message: the field has to be a labelled control
    // with its hint announced, exactly like every other text field in the app.
    const flag: ProposedAction = {
      id: "a1",
      action: "flag_to_pm",
      label: "Flag this to your PM",
      question: "How do we request staging database credentials?",
      status: "idle",
    };

    const { baseElement } = render(
      <main>
        <BuddyActionProposals
          messageId="m1"
          actions={[flag]}
          onConfirm={vi.fn()}
          onDismiss={vi.fn()}
        />
      </main>,
    );

    expect(await axe(baseElement)).toHaveNoViolations();
  });
});
