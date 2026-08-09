import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { MemoryRouter } from 'react-router-dom';
import { TeamMemberCard } from '../../../src/features/team-management/components/TeamMemberCard';
import type { TeamOverviewUser } from '../../../src/features/team-management/types';

vi.mock('../../../src/components/common/UserAvatar', () => ({
    UserAvatar: () => <svg role="img" aria-label="User Avatar" width="40" height="40" />
}));

const user: TeamOverviewUser = {
    userId: 'u1',
    firstname: 'Alice',
    lastname: 'Smith',
    roles: [{ id: 'r1', name: 'Developer', description: '' }],
    skills: [],
    progressPercentage: 0.5,
    projects: [{ id: 'p1', name: 'SprintStart' }],
    currentPhase: { id: 'phase1', title: 'Phase 1' },
    currentStep: {
        id: 's1',
        title: 'Setup environment',
        startedAt: '2026-07-01T00:00:00.000Z',
        skip: null
    },
    hasFeedback: false
};

describe('TeamMemberCard Accessibility', () => {
    it('should not have any a11y violations', async () => {
        const { baseElement } = render(
            <MemoryRouter>
                <main>
                    <TeamMemberCard user={user} />
                </main>
            </MemoryRouter>
        );

        expect(screen.getByRole('link', { name: /Alice Smith/ })).toBeInTheDocument();

        expect(await axe(baseElement)).toHaveNoViolations();
    });
});
