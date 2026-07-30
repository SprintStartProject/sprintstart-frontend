import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PhaseCheckAdminModal } from '../../../../../../src/features/team-management/components/detail/PhaseCheckAdminModal';
import { onboardingService } from '../../../../../../src/services/onboardingService';

vi.mock('../../../../../../src/services/onboardingService', () => ({
    onboardingService: {
        fetchPhaseCheckForEditing: vi.fn(),
        fetchPhaseCheckAttempts: vi.fn(),
        savePhaseCheck: vi.fn(),
    },
}));

const mocked = vi.mocked(onboardingService);

const defaultProps = {
    userId: 'user1',
    phaseId: 'phase1',
    phaseTitle: 'Setup',
    memberName: 'Ada Lovelace',
    initialTab: 'questions' as const,
    onSaved: vi.fn(),
    onClose: vi.fn(),
};

const shortTextQuestion = {
    id: 'q1',
    position: 0,
    type: 'SHORT_TEXT' as const,
    question: 'Start command?',
    explanation: null,
    correctAnswer: 'gradlew bootRun',
    options: [],
};

beforeEach(() => {
    vi.clearAllMocks();
    mocked.fetchPhaseCheckForEditing.mockResolvedValue({
        phaseId: 'phase1',
        questions: [shortTextQuestion],
    });
    mocked.fetchPhaseCheckAttempts.mockResolvedValue({
        userId: 'user1',
        phaseId: 'phase1',
        attempts: [],
    });
});

describe('PhaseCheckAdminModal', () => {
    it('loads the existing questions into the editor', async () => {
        render(<PhaseCheckAdminModal {...defaultProps} />);

        expect(await screen.findByDisplayValue('Start command?')).toBeInTheDocument();
        expect(screen.getByDisplayValue('gradlew bootRun')).toBeInTheDocument();
    });

    it('saves the edited questions with positions assigned by order', async () => {
        const user = userEvent.setup();
        mocked.savePhaseCheck.mockResolvedValue({
            phaseId: 'phase1',
            questions: [shortTextQuestion],
        });
        render(<PhaseCheckAdminModal {...defaultProps} />);

        const questionInput = await screen.findByDisplayValue('Start command?');
        await user.clear(questionInput);
        await user.type(questionInput, 'How do you start it?');
        await user.click(screen.getByRole('button', { name: /save questions/i }));

        await waitFor(() => expect(mocked.savePhaseCheck).toHaveBeenCalled());
        expect(mocked.savePhaseCheck).toHaveBeenCalledWith('phase1', [
            {
                position: 0,
                type: 'SHORT_TEXT',
                question: 'How do you start it?',
                explanation: undefined,
                correctAnswer: 'gradlew bootRun',
                options: undefined,
            },
        ]);
        expect(defaultProps.onSaved).toHaveBeenCalled();
    });

    it('blocks saving a short text question without a sample answer', async () => {
        const user = userEvent.setup();
        render(<PhaseCheckAdminModal {...defaultProps} />);

        const answerInput = await screen.findByDisplayValue('gradlew bootRun');
        await user.clear(answerInput);
        await user.click(screen.getByRole('button', { name: /save questions/i }));

        expect(await screen.findByText(/needs a sample answer/i)).toBeInTheDocument();
        // The backend is never asked to store an invalid check.
        expect(mocked.savePhaseCheck).not.toHaveBeenCalled();
    });

    it('blocks saving a multiple choice question without a correct option', async () => {
        const user = userEvent.setup();
        mocked.fetchPhaseCheckForEditing.mockResolvedValue({
            phaseId: 'phase1',
            questions: [
                {
                    id: 'q1',
                    position: 0,
                    type: 'MULTIPLE_CHOICE' as const,
                    question: 'Which one?',
                    explanation: null,
                    correctAnswer: null,
                    options: [
                        { id: 'o1', position: 0, label: 'A', correct: true },
                        { id: 'o2', position: 1, label: 'B', correct: false },
                    ],
                },
            ],
        });
        render(<PhaseCheckAdminModal {...defaultProps} />);

        // Unticking the only correct option leaves the question unanswerable.
        await user.click(await screen.findByLabelText(/option 1 is correct/i));
        await user.click(screen.getByRole('button', { name: /save questions/i }));

        expect(await screen.findByText(/needs at least 1 correct option/i)).toBeInTheDocument();
        expect(mocked.savePhaseCheck).not.toHaveBeenCalled();
    });

    it('shows attempts with the question text joined onto each answer', async () => {
        mocked.fetchPhaseCheckAttempts.mockResolvedValue({
            userId: 'user1',
            phaseId: 'phase1',
            attempts: [
                {
                    id: 'attempt1',
                    passed: false,
                    createdAt: '2026-07-20T10:00:00Z',
                    correctAnswerCount: 0,
                    questionCount: 1,
                    answers: [
                        {
                            questionId: 'q1',
                            selectedOptionIds: [],
                            textAnswer: 'npm start',
                            correct: false,
                        },
                    ],
                },
            ],
        });
        render(<PhaseCheckAdminModal {...defaultProps} initialTab="results" />);

        expect(await screen.findByText('Not passed')).toBeInTheDocument();
        expect(screen.getByText(/Start command\?/)).toBeInTheDocument();
        expect(screen.getByText(/npm start/)).toBeInTheDocument();
    });

    it('falls back gracefully when an answer references a replaced question', async () => {
        mocked.fetchPhaseCheckAttempts.mockResolvedValue({
            userId: 'user1',
            phaseId: 'phase1',
            attempts: [
                {
                    id: 'attempt1',
                    passed: true,
                    createdAt: '2026-07-20T10:00:00Z',
                    correctAnswerCount: 1,
                    questionCount: 1,
                    answers: [
                        {
                            questionId: 'gone',
                            selectedOptionIds: [],
                            textAnswer: null,
                            correct: true,
                        },
                    ],
                },
            ],
        });
        render(<PhaseCheckAdminModal {...defaultProps} initialTab="results" />);

        expect(await screen.findByText(/question was replaced/i)).toBeInTheDocument();
    });
});
