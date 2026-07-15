import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OnBoardingItemPage } from '../../../../../src/features/onboarding/components/OnBoardingItemPage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
    useParams: () => ({ stepId: 'step1' }),
    useNavigate: () => mockNavigate,
}));

vi.mock('../../../../../src/services/onboardingService', () => ({
    onboardingService: {
        fetchStep: vi.fn(),
        fetchTasks: vi.fn(),
        fetchResources: vi.fn(),
        updateTask: vi.fn(),
        updateStepStatus: vi.fn(),
        skipStep: vi.fn(),
        submitFeedback: vi.fn(),
        fetchPath: vi.fn(),
        startStep: vi.fn(),
    },
}));

import { onboardingService } from '../../../../../src/services/onboardingService';

const mockStep = {
    id: 'step1',
    phaseId: 'phase1',
    position: 1,
    title: 'Setup Environment',
    description: 'Set up your dev environment',
    type: 'TASK' as const,
    estimatedMinutes: 30,
    expectedOutcomes: ['Node.js installed', 'Git configured'],
    tasks: [],
    resources: [],
    status: 'IN_PROGRESS' as const,
    startedAt: '2026-07-01T00:00:00Z',
    completedAt: null,
    feedback: null,
    skip: null,
};

const mockTasks = [
    { id: 't1', stepId: 'step1', position: 1, title: 'Install Node', description: 'Install Node.js', finished: false },
    { id: 't2', stepId: 'step1', position: 2, title: 'Clone repo', description: '', finished: false },
];

const mockResources = [
    { id: 'r1', stepId: 'step1', title: 'Node.js', description: 'Download page', url: 'https://nodejs.org' },
];

describe('OnBoardingItemPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(onboardingService.fetchStep).mockResolvedValue(mockStep);
        vi.mocked(onboardingService.fetchTasks).mockResolvedValue(mockTasks);
        vi.mocked(onboardingService.fetchResources).mockResolvedValue(mockResources);
        vi.mocked(onboardingService.updateTask).mockResolvedValue(undefined);
        vi.mocked(onboardingService.updateStepStatus).mockResolvedValue(undefined);
        vi.mocked(onboardingService.skipStep).mockResolvedValue({ id: 'skip1', stepId: 'step1', status: 'PENDING', reason: 'too hard', reviewComment: null, createdAt: new Date().toISOString() });
        vi.mocked(onboardingService.submitFeedback).mockResolvedValue(undefined);
    });

    it('shows loading state initially', () => {
        vi.mocked(onboardingService.fetchStep).mockImplementation(() => new Promise(() => {}));
        render(<OnBoardingItemPage />);
        expect(screen.getByText('Loading step...')).toBeInTheDocument();
    });

    it('shows error state when fetch fails', async () => {
        vi.mocked(onboardingService.fetchStep).mockRejectedValue(new Error('Network error'));
        render(<OnBoardingItemPage />);

        await waitFor(() => expect(screen.getByText('Could not load step')).toBeInTheDocument());
        expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    it('renders the step title, description, and expected outcomes', async () => {
        render(<OnBoardingItemPage />);

        await waitFor(() => expect(screen.getByText('Setup Environment')).toBeInTheDocument());
        expect(screen.getByText('Set up your dev environment')).toBeInTheDocument();
        expect(screen.getByText('Node.js installed')).toBeInTheDocument();
        expect(screen.getByText('Git configured')).toBeInTheDocument();
    });

    it('renders tasks with completion count', async () => {
        render(<OnBoardingItemPage />);

        await waitFor(() => expect(screen.getByText('1. Install Node')).toBeInTheDocument());
        expect(screen.getByText(/0\/2 completed/)).toBeInTheDocument();
    });

    it('toggles a task when clicked', async () => {
        const user = userEvent.setup();
        render(<OnBoardingItemPage />);

        await waitFor(() => expect(screen.getByText('1. Install Node')).toBeInTheDocument());
        const taskButton = screen.getByText('1. Install Node').closest('button')!;
        await user.click(taskButton);

        expect(onboardingService.updateTask).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }), true);
    });

    it('renders resources as links', async () => {
        render(<OnBoardingItemPage />);

        await waitFor(() => expect(screen.getByText('Node.js')).toBeInTheDocument());
        const link = screen.getByRole('link', { name: /Node\.js/ });
        expect(link).toHaveAttribute('href', 'https://nodejs.org');
    });

    it('submits feedback when helpful is selected and comment is provided', async () => {
        const user = userEvent.setup();
        render(<OnBoardingItemPage />);

        await waitFor(() => expect(screen.getByText('Helpful')).toBeInTheDocument());
        await user.click(screen.getByText('Helpful'));

        const textarea = screen.getByPlaceholderText('Tell us what worked or what was missing...');
        await user.type(textarea, 'Great step!');

        await user.click(screen.getByRole('button', { name: 'Submit feedback' }));

        await waitFor(() => expect(onboardingService.submitFeedback).toHaveBeenCalledWith('step1', true, 'Great step!'));
    });

    it('skips the step when reason is provided', async () => {
        const user = userEvent.setup();
        render(<OnBoardingItemPage />);

        await waitFor(() => expect(screen.getByPlaceholderText('Reason for skipping...')).toBeInTheDocument());
        const textarea = screen.getByPlaceholderText('Reason for skipping...');
        await user.type(textarea, 'Already done');

        await user.click(screen.getByRole('button', { name: 'Skip Step' }));

        await waitFor(() => expect(onboardingService.skipStep).toHaveBeenCalled());
    });

    it('marks step as completed when all tasks are done', async () => {
        const user = userEvent.setup();
        vi.mocked(onboardingService.fetchTasks).mockResolvedValue([
            { id: 't1', stepId: 'step1', position: 1, title: 'Install Node', description: '', finished: true },
            { id: 't2', stepId: 'step1', position: 2, title: 'Clone repo', description: '', finished: true },
        ]);
        render(<OnBoardingItemPage />);

        await waitFor(() => expect(screen.getByRole('button', { name: /Mark as Completed/ })).toBeInTheDocument());

        await user.click(screen.getByRole('button', { name: /Mark as Completed/ }));

        await waitFor(() => expect(onboardingService.updateStepStatus).toHaveBeenCalledWith(expect.any(Object), 'FINISHED'));
    });

    it('shows the "Continue to next step" button when step is finished', async () => {
        vi.mocked(onboardingService.fetchStep).mockResolvedValue({ ...mockStep, status: 'FINISHED', completedAt: '2026-07-02T00:00:00Z' });
        render(<OnBoardingItemPage />);

        await waitFor(() => expect(screen.getByText('Finished!')).toBeInTheDocument());
        expect(screen.getByText('Continue to next step')).toBeInTheDocument();
    });

    it('navigates to the next step when "Continue" is clicked', async () => {
        vi.mocked(onboardingService.fetchStep).mockResolvedValue({ ...mockStep, status: 'FINISHED', completedAt: '2026-07-02T00:00:00Z' });
        vi.mocked(onboardingService.fetchPath).mockResolvedValue({
            id: 'path1',
            userId: 'user1',
            createdAt: new Date().toISOString(),
            phases: [{
                id: 'p1',
                pathId: 'path1',
                position: 1,
                title: 'Phase 1',
                description: '',
                locked: false,
                unlockReason: null,
                checkSummary: { required: false, questionCount: 0, passed: false, latestAttemptId: null, latestAttemptAt: null },
                steps: [{ id: 'step2', phaseId: 'p1', position: 2, title: 'Step 2', description: '', type: 'TASK' as const, estimatedMinutes: 10, expectedOutcomes: [], tasks: [], resources: [], status: 'WAITING' as const, startedAt: null, completedAt: null, feedback: null, skip: null }],
            }],
        });

        const user = userEvent.setup();
        render(<OnBoardingItemPage />);

        await waitFor(() => expect(screen.getByText('Continue to next step')).toBeInTheDocument());
        await user.click(screen.getByText('Continue to next step'));

        await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/onboarding/step2'));
    });
});
