import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { SkillWizardPage } from '../../../src/pages/SkillWizardPage';
import type { TeamOverviewUser, Skill } from '../../../src/features/team-management/types';

vi.mock('../../../src/context/useAuth', () => ({
    useAuth: () => ({ profile: { id: 'user1', firstName: 'Test', lastName: 'User' } }),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

const {
    mockGetMyTeamOverview,
    mockGetSkills,
    mockGetSkillAssessmentPromptState,
    mockMarkSkillAssessmentPromptDismissed,
    mockMarkSkillAssessmentPromptCompleted,
    mockSaveUserSkillAssessments,
} = vi.hoisted(() => ({
    mockGetMyTeamOverview: vi.fn(),
    mockGetSkills: vi.fn(),
    mockGetSkillAssessmentPromptState: vi.fn(),
    mockMarkSkillAssessmentPromptDismissed: vi.fn(),
    mockMarkSkillAssessmentPromptCompleted: vi.fn(),
    mockSaveUserSkillAssessments: vi.fn(),
}));

vi.mock('../../../src/services/teamManagementService', () => ({
    getMyTeamOverview: mockGetMyTeamOverview,
    getSkills: mockGetSkills,
    getSkillAssessmentPromptState: mockGetSkillAssessmentPromptState,
    markSkillAssessmentPromptDismissed: mockMarkSkillAssessmentPromptDismissed,
    markSkillAssessmentPromptCompleted: mockMarkSkillAssessmentPromptCompleted,
    saveUserSkillAssessments: mockSaveUserSkillAssessments,
}));

vi.mock('../../../src/features/team-management/components/SkillWizard', () => ({
    SkillWizard: (props: {
        open: boolean;
        user: TeamOverviewUser;
        skills: Skill[];
        onClose: () => void;
        onSubmit: (assessments: unknown[]) => void;
    }) => (
        <div data-testid="skill-wizard">
            <span>{props.user.firstname}</span>
            <span>{props.skills.length} skills</span>
            <button onClick={props.onClose}>Close</button>
            <button onClick={() => props.onSubmit([])}>Submit</button>
        </div>
    ),
}));

function createMockUser(): TeamOverviewUser {
    return {
        userId: 'user1',
        firstname: 'Alice',
        lastname: 'Smith',
        roles: [],
        skills: [],
        progressPercentage: 0,
        currentPhase: { id: 'p1', title: 'Phase 1' },
        currentStep: null,
        hasFeedback: false,
        project: { id: 'proj1', name: 'Project 1' },
    };
}

describe('SkillWizardPage', () => {
    const mockSkills: Skill[] = [
        { id: 'skill1', name: 'TypeScript', roleIds: ['role1'], status: 'ACTIVE' },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        mockGetMyTeamOverview.mockResolvedValue(createMockUser());
        mockGetSkills.mockResolvedValue(mockSkills);
        mockGetSkillAssessmentPromptState.mockReturnValue(null);
        mockMarkSkillAssessmentPromptDismissed.mockReturnValue(undefined);
        mockMarkSkillAssessmentPromptCompleted.mockReturnValue(undefined);
        mockSaveUserSkillAssessments.mockResolvedValue(undefined);
    });

    it('loads member and skills, then delegates to SkillWizard', async () => {
        render(<MemoryRouter><SkillWizardPage /></MemoryRouter>);

        await waitFor(() => {
            expect(screen.getByTestId('skill-wizard')).toBeInTheDocument();
        });

        expect(screen.getByText('Alice')).toBeInTheDocument();
        expect(screen.getByText('1 skills')).toBeInTheDocument();
    });

    it('marks prompt as dismissed and navigates to onboarding on close', async () => {
        render(<MemoryRouter><SkillWizardPage /></MemoryRouter>);

        await waitFor(() => {
            expect(screen.getByTestId('skill-wizard')).toBeInTheDocument();
        });

        screen.getByText('Close').click();

        expect(mockMarkSkillAssessmentPromptDismissed).toHaveBeenCalledWith('user1');
        expect(mockNavigate).toHaveBeenCalledWith('/onboarding');
    });

    it('saves assessments, marks prompt as completed, and navigates on submit', async () => {
        render(<MemoryRouter><SkillWizardPage /></MemoryRouter>);

        await waitFor(() => {
            expect(screen.getByTestId('skill-wizard')).toBeInTheDocument();
        });

        screen.getByText('Submit').click();

        await waitFor(() => {
            expect(mockSaveUserSkillAssessments).toHaveBeenCalledWith([]);
        });
        expect(mockMarkSkillAssessmentPromptCompleted).toHaveBeenCalledWith('user1');
        expect(mockNavigate).toHaveBeenCalledWith('/onboarding');
    });
});
