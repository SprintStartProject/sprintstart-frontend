import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { MemoryRouter } from 'react-router-dom';
import { OnBoardingPage } from '../../../src/pages/OnBoardingPage';

vi.mock('../../../src/context/useAuth', () => ({
    useAuth: () => ({ profile: { id: 'user1', firstName: 'Test', lastName: 'User' } }),
}));

// The celebratory layer is decorative and lives behind its own provider; the
// page only needs a no-op `celebrate` to render.
vi.mock('../../../src/features/moments', () => ({
    useMoments: () => ({
        celebrate: vi.fn(),
        flyby: vi.fn(),
        completeMission: vi.fn(),
        revealPath: vi.fn(),
        playLaunchSequence: vi.fn(),
        isLaunching: false,
    }),
}));

vi.mock('../../../src/services/userService', () => ({
    userService: {
        getProfile: vi.fn().mockResolvedValue({
            id: 'user1',
            authId: 'auth-1',
            username: 'testuser',
            email: 'test@example.com',
            firstName: 'Test',
            lastName: 'User',
            projectRoles: [],
            permissionGroup: 'USER',
            enabled: true,
            profileIcon: null,
            hasCompletedOnboarding: true,
        }),
    },
}));

vi.mock('../../../src/services/onboardingService', () => ({
    onboardingService: {
        fetchPath: vi.fn().mockResolvedValue({
            id: 'path1',
            userId: 'user1',
            createdAt: '',
            phases: [
                {
                    id: 'p1',
                    pathId: 'path1',
                    position: 1,
                    title: 'Phase 1',
                    description: 'First phase',
                    steps: [
                        {
                            id: 's1',
                            phaseId: 'p1',
                            position: 1,
                            title: 'Step 1',
                            description: 'Do step 1',
                            type: 'TASK',
                            estimatedMinutes: 10,
                            expectedOutcomes: [],
                            tasks: [],
                            resources: [],
                            status: 'IN_PROGRESS',
                            startedAt: null,
                            completedAt: null,
                            feedback: null,
                            skip: null,
                        },
                    ],
                },
            ],
        }),
        personalizePath: vi.fn(),
        startStep: vi.fn().mockResolvedValue(undefined),
    },
}));

describe('OnBoardingPage Accessibility', () => {
    it('should not have any a11y violations', async () => {
        const { baseElement } = render(
            <MemoryRouter><OnBoardingPage /></MemoryRouter>,
        );

        await waitFor(() => {
            expect(screen.getByText('Your onboarding journey')).toBeInTheDocument();
        });

        expect(await axe(baseElement, {
            rules: { region: { enabled: false } },
        })).toHaveNoViolations();
    });
});
