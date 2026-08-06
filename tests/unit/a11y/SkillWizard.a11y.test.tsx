import { useState } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { MemoryRouter } from 'react-router-dom';
import { SkillWizard } from '../../../src/features/team-management/components/SkillWizard';
import type { Skill, TeamOverviewUser } from '../../../src/features/team-management/types';

const user: TeamOverviewUser = {
    userId: 'u1',
    firstname: 'Alice',
    lastname: 'Smith',
    roles: [{ id: 'r1', name: 'Developer', description: '' }],
    skills: [],
    progressPercentage: 0.5,
    projects: [{ id: 'p1', name: 'SprintStart' }],
    currentPhase: { id: 'phase1', title: 'Phase 1' },
    currentStep: null,
    hasFeedback: false
};

const skills: Skill[] = [
    { id: 'sk1', name: 'React', roleIds: ['r1'], status: 'ACTIVE' },
    { id: 'sk2', name: 'TypeScript', roleIds: ['r1'], status: 'ACTIVE' }
];

function SkillWizardHarness() {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <main>
            <button type="button" onClick={() => setIsOpen(true)}>
                Open wizard
            </button>
            <SkillWizard
                open={isOpen}
                user={user}
                skills={skills}
                onClose={() => setIsOpen(false)}
                onSubmit={vi.fn()}
            />
        </main>
    );
}

describe('SkillWizard Accessibility', () => {
    it('has no axe violations and keeps focus inside the modal', async () => {
        const userEventInstance = userEvent.setup();
        const { baseElement } = render(
            <MemoryRouter>
                <SkillWizardHarness />
            </MemoryRouter>
        );

        await userEventInstance.click(screen.getByRole('button', { name: 'Open wizard' }));

        const dialog = await screen.findByRole('dialog', { name: 'Skill Self Assessment' });
        await waitFor(() => {
            const closeButton = within(dialog).getByRole('button', { name: 'Close dialog' });
            expect(closeButton).toHaveFocus();
        });

        expect(within(dialog).getByText('React')).toBeInTheDocument();

        expect(await axe(baseElement)).toHaveNoViolations();
    });
});
