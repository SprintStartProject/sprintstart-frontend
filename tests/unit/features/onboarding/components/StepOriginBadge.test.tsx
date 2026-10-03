import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StepOriginBadge } from "../../../../../src/features/onboarding/components/StepOriginBadge";
import type { OnboardingStepEndpoint } from "../../../../../src/features/onboarding/types";

/**
 * Who put a step on the path, said on the card.
 *
 * The badge used to read this off `isAiAssisted`, which has two values and three answers to give:
 * everything not AI-generated was "Custom step by PM". So a step the hire wrote, and later a step
 * their buddy proposed, both claimed their team required it — and a hire who cannot tell what the
 * team requires from what they agreed to in a chat has lost the distinction the badge is for.
 */
describe("StepOriginBadge", () => {
  const step = (over: Partial<OnboardingStepEndpoint>) => ({ id: "s1", ...over }) as never;

  it("says the buddy added it, not a PM", () => {
    render(<StepOriginBadge step={step({ origin: "BUDDY", isAiAssisted: false })} />);

    expect(screen.getByText("Added with your buddy")).toBeInTheDocument();
    expect(screen.queryByText("Custom step by PM")).not.toBeInTheDocument();
  });

  it("says the hire added it themselves", () => {
    render(<StepOriginBadge step={step({ origin: "HIRE", isAiAssisted: false })} />);

    expect(screen.getByText("You added this")).toBeInTheDocument();
  });

  it("names the hire, not 'you', for a PM reviewing somebody else's path", () => {
    // The same badge sits on the team page, where "You added this" would read as the PM's own step.
    render(<StepOriginBadge step={step({ origin: "HIRE" })} viewer="reviewer" />);
    expect(screen.getByText("Added by the hire")).toBeInTheDocument();
    expect(screen.queryByText("You added this")).not.toBeInTheDocument();
  });

  it("says the buddy without 'your' in the reviewer view", () => {
    render(<StepOriginBadge step={step({ origin: "BUDDY" })} viewer="reviewer" />);

    expect(screen.getByText("Added with the buddy")).toBeInTheDocument();
  });

  it("keeps the PM badge for what a PM prescribed", () => {
    render(<StepOriginBadge step={step({ origin: "PM" })} />);

    expect(screen.getByText("Custom step by PM")).toBeInTheDocument();
  });

  it("wears nothing on a generated step, which is most of the path", () => {
    const { container } = render(<StepOriginBadge step={step({ origin: "GENERATED" })} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("still reads a pre-origin row off isAiAssisted", () => {
    // Rows written before the column default to GENERATED in the database, while `isAiAssisted`
    // still records that a person authored them. Their badge is the one they always had.
    render(<StepOriginBadge step={step({ isAiAssisted: false })} />);

    expect(screen.getByText("Custom step by PM")).toBeInTheDocument();
  });
});
