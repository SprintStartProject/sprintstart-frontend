import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuestionWorkspace } from "../../../../../../src/features/onboarding/components/journey/QuestionWorkspace";
import type {
  OnboardingQuestionEndpoint,
  QuestionAttemptResult,
} from "../../../../../../src/features/onboarding/types";
import {
  COPIED_SAMPLE_WARNING,
  readRevealed,
  shuffleOptions,
} from "../../../../../../src/features/onboarding/questionIntegrity";

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

function attempt(over: Partial<QuestionAttemptResult> = {}): QuestionAttemptResult {
  return {
    attemptId: "a1",
    questionId: "q1",
    correct: false,
    createdAt: "2026-10-05T10:00:00Z",
    correctOptionIds: [],
    correctAnswer: null,
    explanation: null,
    feedback: null,
    status: "RETRY",
    onboardingCompleted: false,
    ...over,
  };
}

describe("QuestionWorkspace: multiple choice", () => {
  beforeEach(() => vi.clearAllMocks());

  const options = [
    { id: "right", position: 0, label: "The Scrum Master" },
    { id: "w1", position: 1, label: "The CEO" },
    { id: "w2", position: 2, label: "The newest hire" },
    { id: "w3", position: 3, label: "Nobody" },
  ];

  function shownLabels(): string[] {
    return screen.getAllByRole("checkbox").map((box) => box.closest("label")?.textContent ?? "");
  }

  /** The stored order puts the right answer first; what is shown must not simply repeat it. */
  it("shows the options shuffled, and in a new order on every attempt", async () => {
    vi.mocked(onboardingService.submitQuestionAttempt).mockResolvedValue(
      attempt({ correctOptionIds: ["right"] }),
    );
    const user = userEvent.setup();
    renderWorkspace({ type: "MULTIPLE_CHOICE", options });

    expect(shownLabels()).toEqual(shuffleOptions(options, "q1:0").map((option) => option.label));

    await user.click(screen.getByRole("checkbox", { name: "The CEO" }));
    await user.click(screen.getByRole("button", { name: "Submit answer" }));
    await user.click(await screen.findByRole("button", { name: "Try again" }));

    expect(shownLabels()).toEqual(shuffleOptions(options, "q1:1").map((option) => option.label));
  });
});

describe("QuestionWorkspace: the revealed sample answer", () => {
  const sample = "The Scrum Master facilitates the retro and keeps it timeboxed";

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  async function answerWrongAndRetry(user: ReturnType<typeof userEvent.setup>) {
    vi.mocked(onboardingService.submitQuestionAttempt).mockResolvedValue(
      attempt({ correctAnswer: sample }),
    );
    await user.type(screen.getByRole("textbox"), "The PM");
    await user.click(screen.getByRole("button", { name: "Submit answer" }));
    expect(await screen.findByText(sample)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Try again" }));
  }

  it("cannot be pasted back in", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await answerWrongAndRetry(user);

    await user.click(screen.getByRole("textbox"));
    await user.paste(sample);

    expect(screen.getByRole("textbox")).toHaveValue("");
    expect(screen.getByRole("alert")).toHaveTextContent(COPIED_SAMPLE_WARNING);
  });

  it("is not taken as an answer when typed out again, and is not sent", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await answerWrongAndRetry(user);

    await user.type(screen.getByRole("textbox"), sample);
    await user.click(screen.getByRole("button", { name: "Submit answer" }));

    expect(screen.getByRole("alert")).toHaveTextContent(COPIED_SAMPLE_WARNING);
    expect(onboardingService.submitQuestionAttempt).toHaveBeenCalledTimes(1);
  });

  it("lets an answer in the hire's own words through", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await answerWrongAndRetry(user);
    vi.mocked(onboardingService.submitQuestionAttempt).mockResolvedValue(
      attempt({ correct: true, status: "PASSED" }),
    );

    await user.click(screen.getByRole("textbox"));
    await user.paste("Our SM leads it, and makes sure we stop when the time is up");
    await user.click(screen.getByRole("button", { name: "Submit answer" }));

    expect(await screen.findByText(/Correct/)).toBeVisible();
    expect(onboardingService.submitQuestionAttempt).toHaveBeenCalledTimes(2);
    // Once passed, there is nothing left to guard.
    expect(readRevealed("q1")).toEqual([]);
  });

  it("is still guarded after a reload", async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <QuestionWorkspace
        question={question}
        phaseTitle="Meetings"
        onAnswered={vi.fn()}
        continueLabel="Next step"
        onContinue={vi.fn()}
      />,
    );
    await answerWrongAndRetry(user);
    unmount();

    renderWorkspace({ status: "RETRY" });
    await user.click(screen.getByRole("textbox"));
    await user.paste(sample);

    expect(screen.getByRole("textbox")).toHaveValue("");
    expect(screen.getByRole("alert")).toHaveTextContent(COPIED_SAMPLE_WARNING);
  });

  /** The explanation usually spells the answer out too; it is no way round the guard. */
  it("cannot be pasted from the explanation either", async () => {
    const explanation =
      "Retrospectives are facilitated by the Scrum Master, who keeps the meeting timeboxed.";
    vi.mocked(onboardingService.submitQuestionAttempt).mockResolvedValue(
      attempt({ correctAnswer: "Scrum Master", explanation }),
    );
    const user = userEvent.setup();
    renderWorkspace();
    await user.type(screen.getByRole("textbox"), "The PM");
    await user.click(screen.getByRole("button", { name: "Submit answer" }));
    expect(await screen.findByText(explanation)).toHaveClass("select-none");
    await user.click(screen.getByRole("button", { name: "Try again" }));

    await user.click(screen.getByRole("textbox"));
    await user.paste("Scrum Master");
    expect(screen.getByRole("textbox")).toHaveValue("");

    await user.paste("facilitated by the Scrum Master");
    expect(screen.getByRole("textbox")).toHaveValue("");
    expect(screen.getByRole("alert")).toHaveTextContent(COPIED_SAMPLE_WARNING);

    // Typed out, a short fact is fine: there is no other way to say it.
    await user.type(screen.getByRole("textbox"), "Scrum Master");
    await user.click(screen.getByRole("button", { name: "Submit answer" }));
    expect(onboardingService.submitQuestionAttempt).toHaveBeenCalledTimes(2);
  });
});
