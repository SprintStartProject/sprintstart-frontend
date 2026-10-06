import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CheckQuestionCard } from "../../../../src/features/onboarding/components/CheckQuestionCard";
import type {
  OnboardingQuestionEndpoint,
  QuestionAttemptResult,
} from "../../../../src/features/onboarding/types";

const question: OnboardingQuestionEndpoint = {
  id: "q1",
  phaseId: "p1",
  position: 1,
  type: "MULTIPLE_CHOICE",
  question: "Where do changes go first?",
  status: "RETRY",
  options: [
    { id: "a", position: 1, label: "A feature branch" },
    { id: "b", position: 2, label: "Straight into main" },
  ],
};

const wrongResult: QuestionAttemptResult = {
  attemptId: "att1",
  questionId: "q1",
  correct: false,
  createdAt: "2026-01-01T00:00:00Z",
  correctOptionIds: ["a"],
  correctAnswer: null,
  explanation: null,
  feedback: null,
  status: "RETRY",
  onboardingCompleted: false,
};

describe("CheckQuestionCard grading", () => {
  // The green and red tint on a graded option is the only thing that says which one was right, so
  // each option also says it in words and with an icon (WCAG 1.4.1).
  it("says which option is right and which one was picked wrong, in words", () => {
    render(
      <CheckQuestionCard
        question={question}
        index={0}
        draft={{ selectedOptionIds: ["b"], textAnswer: "" }}
        result={wrongResult}
        onToggleOption={vi.fn()}
        onTextChange={vi.fn()}
      />,
    );

    const right = screen.getByText("A feature branch").closest("label")!;
    const wrong = screen.getByText("Straight into main").closest("label")!;

    expect(right).toHaveTextContent("Correct answer");
    expect(wrong).toHaveTextContent("Your pick");
    expect(right).not.toHaveTextContent("Your pick");
  });

  it("marks nothing before the question has been graded", () => {
    render(
      <CheckQuestionCard
        question={question}
        index={0}
        draft={{ selectedOptionIds: ["b"], textAnswer: "" }}
        result={null}
        onToggleOption={vi.fn()}
        onTextChange={vi.fn()}
      />,
    );

    expect(screen.queryByText("Correct answer")).toBeNull();
    expect(screen.queryByText("Your pick")).toBeNull();
  });
});
