import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthGuard } from '../../../src/router/AuthGuard';
import { useAuth } from '../../../src/context/useAuth';
import * as teamManagementService from '../../../src/services/teamManagementService';
import { http, HttpResponse } from 'msw';
import { server } from '../../unit/setup/vitest.setup';
import { PermissionGroup, type UserProfile } from '../../../src/services/types';

vi.mock('../../../src/context/useAuth', () => ({
    useAuth: vi.fn(),
}));

vi.mock('../../../src/services/teamManagementService', () => ({
    getMyTeamOverview: vi.fn(),
    hasCompletedSkillAssessment: vi.fn(),
    getSkills: vi.fn(),
    getSkillAssessmentPromptState: vi.fn(),
}));

function LocationDisplay() {
    const location = useLocation();
    return <div data-testid="location">{location.pathname}</div>;
}

const mockProfile: UserProfile = {
    id: 'user1',
    authId: 'auth-1',
    username: 'testuser',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    projectRoles: [],
    projectIds: [],
    permissionGroup: PermissionGroup.USER,
    enabled: true,
    profileIcon: null,
    hasCompletedOnboarding: true,
};

describe('AuthGuard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(teamManagementService.hasCompletedSkillAssessment).mockResolvedValue(true);
        vi.mocked(teamManagementService.getMyTeamOverview).mockResolvedValue({
            userId: 'user1',
            firstname: 'Test',
            lastname: 'User',
            projects: [{ id: 'proj1', name: 'Test Project' }],
            roles: [],
            skills: [],
            progressPercentage: 50,
            currentPhase: { id: 'phase1', title: 'Phase 1' },
            currentStep: null,
            hasFeedback: false,
        });
        vi.mocked(teamManagementService.getSkills).mockResolvedValue([]);
        vi.mocked(teamManagementService.getSkillAssessmentPromptState).mockReturnValue(null);
    });

    it('renders loading spinner when status is loading', () => {
        vi.mocked(useAuth).mockReturnValue({
            status: 'loading',
            profile: null,
            login: vi.fn(),
            logout: vi.fn(),
            refetchProfile: vi.fn(),
        });

        const { container } = render(
            <MemoryRouter initialEntries={['/protected']}>
                <Routes>
                    <Route
                        path="/protected"
                        element={
                            <AuthGuard>
                                <div>Protected</div>
                            </AuthGuard>
                        }
                    />
                </Routes>
            </MemoryRouter>,
        );

        expect(container.querySelector('.animate-spin')).toBeInTheDocument();
        expect(screen.queryByText('Protected')).not.toBeInTheDocument();
    });

    it('redirects to /login if unauthenticated and not on /login', async () => {
        vi.mocked(useAuth).mockReturnValue({
            status: 'unauthenticated',
            profile: null,
            login: vi.fn(),
            logout: vi.fn(),
            refetchProfile: vi.fn(),
        });

        render(
            <MemoryRouter initialEntries={['/protected']}>
                <Routes>
                    <Route path="/login" element={<LocationDisplay />} />
                    <Route
                        path="/protected"
                        element={
                            <AuthGuard>
                                <LocationDisplay />
                            </AuthGuard>
                        }
                    />
                </Routes>
            </MemoryRouter>,
        );

        await waitFor(() => {
            expect(screen.getByTestId('location')).toHaveTextContent('/login');
        });
    });

    it('redirects to / if authenticated and on /login', async () => {
        vi.mocked(useAuth).mockReturnValue({
            status: 'authenticated',
            profile: mockProfile,
            login: vi.fn(),
            logout: vi.fn(),
            refetchProfile: vi.fn(),
        });

        server.use(
            http.get('/api/v1/onboarding/team-overview', () =>
                HttpResponse.json({
                    users: [
                        {
                            userId: 'user1',
                            firstname: 'Test',
                            lastname: 'User',
                            email: 'test@example.com',
                            roles: [],
                            progressPercentage: 50,
                            currentStep: null,
                            skills: [],
                        },
                    ],
                }),
            ),
        );

        render(
            <MemoryRouter initialEntries={['/login']}>
                <Routes>
                    <Route path="/" element={<LocationDisplay />} />
                    <Route
                        path="/login"
                        element={
                            <AuthGuard>
                                <div>Login Page</div>
                            </AuthGuard>
                        }
                    />
                </Routes>
            </MemoryRouter>,
        );

        await waitFor(() => {
            expect(screen.getByTestId('location')).toHaveTextContent('/');
        });
    });

    it('renders children when authenticated and no skill assessment needed', async () => {
        vi.mocked(useAuth).mockReturnValue({
            status: 'authenticated',
            profile: mockProfile,
            login: vi.fn(),
            logout: vi.fn(),
            refetchProfile: vi.fn(),
        });

        server.use(
            http.get('/api/v1/onboarding/team-overview', () =>
                HttpResponse.json({
                    users: [
                        {
                            userId: 'user1',
                            firstname: 'Test',
                            lastname: 'User',
                            email: 'test@example.com',
                            roles: [],
                            progressPercentage: 50,
                            currentStep: null,
                            skills: [],
                        },
                    ],
                }),
            ),
        );

        render(
            <MemoryRouter initialEntries={['/protected']}>
                <Routes>
                    <Route
                        path="/protected"
                        element={
                            <AuthGuard>
                                <div data-testid="protected-content">Protected Content</div>
                            </AuthGuard>
                        }
                    />
                </Routes>
            </MemoryRouter>,
        );

        await waitFor(() => {
            expect(screen.getByTestId('protected-content')).toBeInTheDocument();
        });
    });

    it('redirects to /skill-wizard if skill assessment is needed', async () => {
        vi.mocked(useAuth).mockReturnValue({
            status: 'authenticated',
            profile: mockProfile,
            login: vi.fn(),
            logout: vi.fn(),
            refetchProfile: vi.fn(),
        });

        vi.mocked(teamManagementService.getMyTeamOverview).mockResolvedValue({
            userId: 'user1',
            firstname: 'Test',
            lastname: 'User',
            projects: [{ id: 'proj1', name: 'Test Project' }],
            roles: [{ id: 'role1', name: 'Developer', description: 'Developer role' }],
            skills: [],
            progressPercentage: 50,
            currentPhase: { id: 'phase1', title: 'Phase 1' },
            currentStep: null,
            hasFeedback: false,
        });
        vi.mocked(teamManagementService.hasCompletedSkillAssessment).mockResolvedValue(false);
        vi.mocked(teamManagementService.getSkills).mockResolvedValue([
            {
                id: 'skill1',
                roleIds: ['role1'],
                name: 'Typescript',
                status: 'ACTIVE',
            },
        ]);

        render(
            <MemoryRouter initialEntries={['/protected']}>
                <Routes>
                    <Route path="/skill-wizard" element={<LocationDisplay />} />
                    <Route
                        path="/protected"
                        element={
                            <AuthGuard>
                                <div data-testid="protected-content">Protected Content</div>
                            </AuthGuard>
                        }
                    />
                </Routes>
            </MemoryRouter>,
        );

        await waitFor(() => {
            expect(screen.getByTestId('location')).toHaveTextContent('/skill-wizard');
        });
    });
});
