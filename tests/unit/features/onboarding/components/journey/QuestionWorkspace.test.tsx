import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuestionWorkspace } from "../../../../../../src/features/onboarding/components/journey/QuestionWorkspace";
import type { OnboardingQuestionEndpoint } from "../../../../../../src/features/onboarding/types";

const mockOpenAiBuddy = vi.hoisted(() => vi.fn());

vi.mock("../../../../../../src/features/buddy/aiBuddyBus", () => ({
  openAiBuddy: mockOpenAiBuddy,
}));

vi.mock("../../../../../../src/services/onboardingService", () => ({
  onboardingService: { submitQuestionAttempt: vi.fn() },
}));

import { onboardingService } from "../../../../../../src/services/onboardingService";

const question: OnboardingQuestionEndpoint = {
  id: "q1",
  phaseId: "phase1",
  position: 1,
  type: "SHORT_TEXT",
  question: "Who runs the retro?",
  status: "OPEN",
};

function renderWorkspace(over: Partial<OnboardingQuestionEndpoint> = {}) {
  render(
    <QuestionWorkspace
      question={{ ...question, ...over }}
      phaseTitle="Meetings"
      onAnswered={vi.fn()}
      continueLabel="Next step"
      onContinue={vi.fn()}
    />,
  );
}

/** The draft the last "ask the buddy" control put in the composer. */
function lastDraft(): string {
  const calls = mockOpenAiBuddy.mock.calls as [{ draft: string }][];
  return calls[calls.length - 1][0].draft;
}

describe("QuestionWorkspace: the buddy", () => {
  beforeEach(() => vi.clearAllMocks());

  it("is offered before an attempt, asking for the material rather than the answer", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await user.click(
      screen.getByRole("button", { name: "Not sure? Ask your buddy to explain the material" }),
    );

    expect(lastDraft()).toContain("Who runs the retro?");
    expect(lastDraft()).toContain("Meetings");
    expect(lastDraft()).toContain("rather work the answer out");
  });

  it("speaks up louder on a question already answered wrong", () => {
    renderWorkspace({ status: "RETRY" });

    expect(screen.getByRole("button", { name: "Go through this with your buddy" })).toBeVisible();
  });

  it("offers to go through the material right after a wrong answer", async () => {
    vi.mocked(onboardingService.submitQuestionAttempt).mockResolvedValue({
      attemptId: "a1",
      questionId: "q1",
      correct: false,
      createdAt: "2026-09-24T10:00:00Z",
      correctOptionIds: [],
      correctAnswer: null,
      explanation: null,
      feedback: null,
      status: "RETRY",
      onboardingCompleted: false,
    });
    const user = userEvent.setup();
    renderWorkspace();

    await user.type(screen.getByRole("textbox"), "The PM");
    await user.click(screen.getByRole("button", { name: "Submit answer" }));
    await user.click(await screen.findByRole("button", { name: "Go through it with your buddy" }));

    expect(lastDraft()).toContain("wrong");
    expect(lastDraft()).toContain("Who runs the retro?");
  });
});
