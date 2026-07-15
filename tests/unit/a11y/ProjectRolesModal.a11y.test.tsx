import { useState } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { MemoryRouter } from 'react-router-dom';
import { ProjectRolesModal } from '../../../src/features/team-management/components/ProjectRolesModal';

vi.mock('../../../src/services/teamManagementService', () => ({
    getProjectRoles: vi.fn().mockResolvedValue([
        { id: 'r1', name: 'Developer', description: 'Builds features' }
    ]),
    getSkills: vi.fn().mockResolvedValue([
        { id: 'sk1', name: 'React', roleIds: ['r1'], status: 'ACTIVE' }
    ]),
    createProjectRole: vi.fn().mockResolvedValue({ id: 'r2', name: 'Designer', description: '' }),
    createSkill: vi.fn().mockResolvedValue({ id: 'sk2', name: 'Figma', roleIds: ['r2'], status: 'ACTIVE' }),
    deleteProjectRole: vi.fn().mockResolvedValue(undefined),
    deleteSkill: vi.fn().mockResolvedValue(undefined),
    reactivateSkill: vi.fn().mockResolvedValue({ id: 'sk1', name: 'React', roleIds: ['r1'], status: 'ACTIVE' })
}));

function ProjectRolesModalHarness() {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <main>
            <button type="button" onClick={() => setIsOpen(true)}>
                Open roles modal
            </button>
            <ProjectRolesModal
                open={isOpen}
                onClose={() => setIsOpen(false)}
            />
        </main>
    );
}

describe('ProjectRolesModal Accessibility', () => {
    it('has no axe violations and keeps focus inside the modal', async () => {
        const userEventInstance = userEvent.setup();
        const { baseElement } = render(
            <MemoryRouter>
                <ProjectRolesModalHarness />
            </MemoryRouter>
        );

        await userEventInstance.click(screen.getByRole('button', { name: 'Open roles modal' }));

        const dialog = await screen.findByRole('dialog', { name: 'Project Roles' });
        await waitFor(() => {
            const closeButton = within(dialog).getByRole('button', { name: 'Close dialog' });
            expect(closeButton).toHaveFocus();
        });

        expect(await axe(baseElement)).toHaveNoViolations();
    });
});
