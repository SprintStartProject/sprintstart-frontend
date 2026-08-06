import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { MemoryRouter } from 'react-router-dom';
import { TeamMemberDetailPage } from '../../../src/pages/TeamMemberDetailPage';

vi.mock('../../../src/context/useAuth', () => ({
    useAuth: () => ({ profile: { id: 'pm1', firstName: 'PM', lastName: 'User' } }),
}));

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
    return {
        ...actual,
        useParams: () => ({ userId: 'user1' }),
        useNavigate: () => vi.fn(),
    };
});

vi.mock('../../../src/services/teamManagementService', () => ({
    getTeamMember: vi.fn().mockResolvedValue({
        userId: 'user1',
        firstname: 'Alice',
        lastname: 'Smith',
        roles: [{ id: 'role1', name: 'Backend', description: 'Backend developer' }],
        skills: [],
        progressPercentage: 0.5,
        currentPhase: { id: 'p1', title: 'Phase 1' },
        currentStep: {
            id: 's1',
            title: 'Setup',
            startedAt: '2026-07-01T00:00:00Z',
            skip: null,
        },
        hasFeedback: false,
        projects: [{ id: 'proj1', name: 'Project 1' }],
    }),
    getProjectRoles: vi.fn().mockResolvedValue([
        { id: 'role1', name: 'Backend', description: 'Backend developer' },
    ]),
    getUserSkillLevels: vi.fn().mockResolvedValue([]),
    getUserOnboardingPath: vi.fn().mockResolvedValue({
        id: 'path1',
        userId: 'user1',
        createdAt: '',
        phases: [],
    }),
    getUserOnboardingFeedback: vi.fn().mockResolvedValue([]),
    getOnboardingTasksByStep: vi.fn().mockResolvedValue([]),
    assignProjectRoleToUser: vi.fn().mockResolvedValue(undefined),
    unassignProjectRoleFromUser: vi.fn().mockResolvedValue(undefined),
    acceptOnboardingSkipRequest: vi.fn().mockResolvedValue(undefined),
    denyOnboardingSkipRequest: vi.fn().mockResolvedValue(undefined),
    markOnboardingFeedbackRead: vi.fn(),
    deleteOnboardingStep: vi.fn(),
    deleteOnboardingTask: vi.fn(),
    createOnboardingStepForPhase: vi.fn(),
    createOnboardingTaskForStep: vi.fn(),
}));

vi.mock('../../../src/services/knowledgeGapService', () => ({
    knowledgeGapService: {
        fetchKnowledgeGaps: vi.fn().mockResolvedValue({ gaps: [] }),
    },
}));

vi.mock('../../../src/components/common/UserAvatar', () => ({
    UserAvatar: () => <svg role="img" aria-label="User Avatar" width="56" height="56" />,
}));

vi.mock('../../../src/features/team-management/components/detail/MemberOnboardingSection', () => ({
    MemberOnboardingSection: () => <section aria-label="Onboarding">Onboarding</section>,
}));

vi.mock('../../../src/features/team-management/components/detail/MemberGapsPanel', () => ({
    MemberGapsPanel: () => <section aria-label="Gaps">Gaps</section>,
}));

vi.mock('../../../src/features/team-management/components/detail/StepDetailsPanel', () => ({
    StepDetailsPanel: () => <aside aria-label="Step details">Step Details</aside>,
}));

vi.mock('../../../src/features/team-management/components/detail/AddCustomStepModal', () => ({
    AddCustomStepModal: () => null,
}));

vi.mock('../../../src/features/team-management/components/detail/MemberDetailDialogs', () => ({
    MemberDetailDialogs: () => null,
}));

describe('TeamMemberDetailPage Accessibility', () => {
    it('should not have any a11y violations', async () => {
        const { baseElement } = render(
            <MemoryRouter><TeamMemberDetailPage /></MemoryRouter>,
        );

        await waitFor(() => {
            expect(screen.getByText('Alice Smith')).toBeInTheDocument();
        });

        expect(await axe(baseElement)).toHaveNoViolations();
    });
});
