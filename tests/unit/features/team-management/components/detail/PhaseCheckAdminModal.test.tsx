import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PhaseCheckAdminModal } from "../../../../../../src/features/team-management/components/detail/PhaseCheckAdminModal";
import { onboardingService } from "../../../../../../src/services/onboardingService";

vi.mock("../../../../../../src/services/onboardingService", () => ({
  onboardingService: {
    fetchPhaseQuestionsForEditing: vi.fn(),
    fetchQuestionAttempts: vi.fn(),
    savePhaseQuestions: vi.fn(),
  },
}));

const mocked = vi.mocked(onboardingService);

const defaultProps = {
  userId: "user1",
  phaseId: "phase1",
  phaseTitle: "Setup",
  memberName: "Ada Lovelace",
  initialTab: "questions" as const,
  onSaved: vi.fn(),
  onClose: vi.fn(),
};

const shortTextQuestion = {
  id: "q1",
  position: 0,
  type: "SHORT_TEXT" as const,
  question: "Start command?",
  explanation: null,
  correctAnswer: "gradlew bootRun",
  options: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocked.fetchPhaseQuestionsForEditing.mockResolvedValue({
    phaseId: "phase1",
    questions: [shortTextQuestion],
  });
});

describe("PhaseCheckAdminModal", () => {
  it("loads the existing questions into the editor", async () => {
    render(<PhaseCheckAdminModal {...defaultProps} />);

    expect(await screen.findByDisplayValue("Start command?")).toBeInTheDocument();
    expect(screen.getByDisplayValue("gradlew bootRun")).toBeInTheDocument();
  });

  it("saves the edited questions with positions assigned by order", async () => {
    const user = userEvent.setup();
    mocked.savePhaseQuestions.mockResolvedValue({
      phaseId: "phase1",
      questions: [shortTextQuestion],
    });
    render(<PhaseCheckAdminModal {...defaultProps} />);

    const questionInput = await screen.findByDisplayValue("Start command?");
    await user.clear(questionInput);
    await user.type(questionInput, "How do you start it?");
    await user.click(screen.getByRole("button", { name: /save questions/i }));

    await waitFor(() => expect(mocked.savePhaseQuestions).toHaveBeenCalled());
    expect(mocked.savePhaseQuestions).toHaveBeenCalledWith("phase1", [
      {
        id: "q1",
        position: 0,
        type: "SHORT_TEXT",
        question: "How do you start it?",
        explanation: undefined,
        correctAnswer: "gradlew bootRun",
        options: undefined,
      },
    ]);
    expect(defaultProps.onSaved).toHaveBeenCalled();
  });

  it("keeps existing question and option ids, and omits them for newly added ones", async () => {
    const user = userEvent.setup();
    mocked.fetchPhaseQuestionsForEditing.mockResolvedValue({
      phaseId: "phase1",
      questions: [
        {
          id: "q1",
          position: 0,
          type: "MULTIPLE_CHOICE" as const,
          question: "Which one?",
          explanation: null,
          correctAnswer: null,
          options: [
            { id: "o1", position: 0, label: "A", correct: true },
            { id: "o2", position: 1, label: "B", correct: false },
          ],
        },
      ],
    });
    mocked.savePhaseQuestions.mockResolvedValue({ phaseId: "phase1", questions: [] });
    render(<PhaseCheckAdminModal {...defaultProps} />);

    await screen.findByDisplayValue("Which one?");
    await user.click(screen.getByRole("button", { name: /add option/i }));
    await user.type(screen.getByLabelText(/option 3 label/i), "C");
    await user.click(screen.getByRole("button", { name: /save questions/i }));

    // The IDs have to survive the round trip: without them the backend recreates every
    // question, which throws away the attempts pointing at it.
    await waitFor(() => expect(mocked.savePhaseQuestions).toHaveBeenCalled());
    expect(mocked.savePhaseQuestions).toHaveBeenCalledWith("phase1", [
      {
        id: "q1",
        position: 0,
        type: "MULTIPLE_CHOICE",
        question: "Which one?",
        explanation: undefined,
        correctAnswer: undefined,
        options: [
          { id: "o1", position: 0, label: "A", correct: true },
          { id: "o2", position: 1, label: "B", correct: false },
          { id: undefined, position: 2, label: "C", correct: false },
        ],
      },
    ]);
  });

  it("blocks saving a short text question without a sample answer", async () => {
    const user = userEvent.setup();
    render(<PhaseCheckAdminModal {...defaultProps} />);

    const answerInput = await screen.findByDisplayValue("gradlew bootRun");
    await user.clear(answerInput);
    await user.click(screen.getByRole("button", { name: /save questions/i }));

    expect(await screen.findByText(/needs a sample answer/i)).toBeInTheDocument();
    // The backend is never asked to store an invalid question.
    expect(mocked.savePhaseQuestions).not.toHaveBeenCalled();
  });

  it("blocks saving a multiple choice question without a correct option", async () => {
    const user = userEvent.setup();
    mocked.fetchPhaseQuestionsForEditing.mockResolvedValue({
      phaseId: "phase1",
      questions: [
        {
          id: "q1",
          position: 0,
          type: "MULTIPLE_CHOICE" as const,
          question: "Which one?",
          explanation: null,
          correctAnswer: null,
          options: [
            { id: "o1", position: 0, label: "A", correct: true },
            { id: "o2", position: 1, label: "B", correct: false },
          ],
        },
      ],
    });
    render(<PhaseCheckAdminModal {...defaultProps} />);

    // Unticking the only correct option leaves the question unanswerable.
    await user.click(await screen.findByLabelText(/option 1 is correct/i));
    await user.click(screen.getByRole("button", { name: /save questions/i }));

    expect(await screen.findByText(/needs at least 1 correct option/i)).toBeInTheDocument();
    expect(mocked.savePhaseQuestions).not.toHaveBeenCalled();
  });

  it("shows a question's attempts in the results tab when expanded", async () => {
    const user = userEvent.setup();
    mocked.fetchQuestionAttempts.mockResolvedValue({
      userId: "user1",
      questionId: "q1",
      attempts: [
        {
          id: "attempt1",
          correct: false,
          createdAt: "2026-07-20T10:00:00Z",
          selectedOptionIds: [],
          textAnswer: "npm start",
        },
      ],
    });
    render(<PhaseCheckAdminModal {...defaultProps} initialTab="results" />);

    await user.click(await screen.findByText("Start command?"));

    expect(mocked.fetchQuestionAttempts).toHaveBeenCalledWith("user1", "q1");
    expect(await screen.findByText(/Incorrect/)).toBeInTheDocument();
    expect(screen.getByText(/npm start/)).toBeInTheDocument();
  });

  it("reports an empty results tab when there are no attempts yet", async () => {
    mocked.fetchQuestionAttempts.mockResolvedValue({
      userId: "user1",
      questionId: "q1",
      attempts: [],
    });
    const user = userEvent.setup();
    render(<PhaseCheckAdminModal {...defaultProps} initialTab="results" />);

    await user.click(await screen.findByText("Start command?"));

    expect(await screen.findByText(/No attempts on this question yet/i)).toBeInTheDocument();
  });
});
