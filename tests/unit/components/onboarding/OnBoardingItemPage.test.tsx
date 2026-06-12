/* eslint-disable @typescript-eslint/unbound-method */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OnBoardingItemPage } from '../../../../src/components/onboarding/OnBoardingItemPage';
import { onboardingService } from '../../../../src/services/onboardingService';
import { BrowserRouter } from 'react-router-dom';
import type { OnboardingStepDetail, OnboardingTaskEndpoint, OnboardingResourceEndpoint } from '../../../../src/types/onboarding';

// Mock the service
vi.mock('../../../../src/services/onboardingService', () => ({
  onboardingService: {
    fetchStep: vi.fn(),
    fetchTasks: vi.fn(),
    fetchResources: vi.fn(),
    updateStepStatus: vi.fn(),
    updateTask: vi.fn(),
    skipStep: vi.fn(),
  },
}));

const mockedService = vi.mocked(onboardingService);

// Mock useParams and useNavigate
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ stepId: 'step-123' }),
    useNavigate: () => vi.fn(),
  };
});

describe('OnBoardingItemPage', () => {
  const mockStep: OnboardingStepDetail = {
    id: 'step-123',
    title: 'Development Setup',
    description: 'Setup your local environment',
    status: 'IN_PROGRESS',
    estimatedMinutes: 30,
    skipReason: '',
    tasks: [],
    resources: [],
    phaseId: 'phase-1',
    position: 1,
    type: 'TASK',
    completedAt: null,
  };

  const mockTasks: OnboardingTaskEndpoint[] = [
    { id: 'task-1', title: 'Install Git', finished: true, position: 1, stepId: 'step-123', description: '' },
    { id: 'task-2', title: 'Clone Repo', finished: false, position: 2, stepId: 'step-123', description: '' },
  ];

  const mockResources: OnboardingResourceEndpoint[] = [
    { id: 'res-1', title: 'Git Guide', url: 'https://git-scm.com', description: 'Official docs', stepId: 'step-123' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockedService.fetchStep.mockResolvedValue(mockStep);
    mockedService.fetchTasks.mockResolvedValue(mockTasks);
    mockedService.fetchResources.mockResolvedValue(mockResources);
  });

  it('renders step details, tasks, and resources', async () => {
    render(
      <BrowserRouter>
        <OnBoardingItemPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Development Setup')).toBeInTheDocument();
    });

    expect(screen.getByText('1. Install Git')).toBeInTheDocument();
    expect(screen.getByText('2. Clone Repo')).toBeInTheDocument();
    expect(screen.getByText('Git Guide')).toBeInTheDocument();
    expect(screen.getByText('30 min')).toBeInTheDocument();
  });

  it('toggles task completion when clicked', async () => {
    render(
      <BrowserRouter>
        <OnBoardingItemPage />
      </BrowserRouter>
    );

    await waitFor(() => screen.getByText('2. Clone Repo'));
    
    const taskButton = screen.getByText('2. Clone Repo');
    fireEvent.click(taskButton);

    expect(mockedService.updateTask).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'task-2' }),
      true
    );
  });

  it('disables "Mark as Completed" if tasks are pending', async () => {
    render(
      <BrowserRouter>
        <OnBoardingItemPage />
      </BrowserRouter>
    );

    await waitFor(() => screen.getByText(/Still 1 task pending/i));
    
    const completeButton = screen.getByText(/Still 1 task pending/i);
    expect(completeButton.closest('button')).toBeDisabled();
  });

  it('allows skipping a step with a reason', async () => {
    render(
      <BrowserRouter>
        <OnBoardingItemPage />
      </BrowserRouter>
    );

    await waitFor(() => screen.getByPlaceholderText(/Reason for skipping.../i));
    
    const textarea = screen.getByPlaceholderText(/Reason for skipping.../i);
    // Find the button specifically, since the heading also says "Skip Step"
    const skipButton = screen.getByRole('button', { name: /^Skip Step$/i });

    fireEvent.change(textarea, { target: { value: 'Already familiar' } });
    fireEvent.click(skipButton);

    expect(mockedService.skipStep).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'step-123' }),
      'Already familiar'
    );
  });

  it('displays error state when fetching fails', async () => {
    mockedService.fetchStep.mockRejectedValue(new Error('Network error'));

    render(
      <BrowserRouter>
        <OnBoardingItemPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Could not load step/i)).toBeInTheDocument();
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });
});
