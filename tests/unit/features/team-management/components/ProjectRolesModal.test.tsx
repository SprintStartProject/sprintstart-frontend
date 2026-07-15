import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectRolesModal } from '../../../../../src/features/team-management/components/ProjectRolesModal';

vi.mock('../../../../../src/services/teamManagementService', () => ({
    getProjectRoles: vi.fn(),
    getSkills: vi.fn(),
    createProjectRole: vi.fn(),
    deleteProjectRole: vi.fn(),
    createSkill: vi.fn(),
    deleteSkill: vi.fn(),
    reactivateSkill: vi.fn(),
}));

import {
    getProjectRoles,
    getSkills,
    createProjectRole,
    deleteProjectRole,
    createSkill,
    deleteSkill,
    reactivateSkill,
} from '../../../../../src/services/teamManagementService';

const mockRoles = [
    { id: 'r1', name: 'Backend', description: 'Backend dev' },
    { id: 'r2', name: 'Frontend', description: 'Frontend dev' },
];

const mockSkills = [
    { id: 'sk1', name: 'TypeScript', roleIds: ['r1'], status: 'ACTIVE' as const },
    { id: 'sk2', name: 'Old Skill', roleIds: ['r1'], status: 'RETIRED' as const },
];

describe('ProjectRolesModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getProjectRoles).mockResolvedValue(mockRoles);
        vi.mocked(getSkills).mockResolvedValue(mockSkills);
        vi.mocked(createProjectRole).mockResolvedValue({ id: 'r3', name: 'DevOps', description: 'DevOps role' });
        vi.mocked(deleteProjectRole).mockResolvedValue(undefined);
        vi.mocked(createSkill).mockResolvedValue({ id: 'sk3', name: 'React', roleIds: ['r1'], status: 'ACTIVE' as const });
        vi.mocked(deleteSkill).mockResolvedValue(undefined);
        vi.mocked(reactivateSkill).mockResolvedValue({ id: 'sk2', name: 'Old Skill', roleIds: ['r1'], status: 'ACTIVE' as const });
    });

    it('renders the modal with roles when open', async () => {
        render(<ProjectRolesModal open={true} onClose={vi.fn()} />);

        await waitFor(() => expect(screen.getByText('Backend')).toBeInTheDocument());
        expect(screen.getByText('Frontend')).toBeInTheDocument();
    });

    it('creates a new role when the form is submitted', async () => {
        const user = userEvent.setup();
        render(<ProjectRolesModal open={true} onClose={vi.fn()} />);

        await waitFor(() => expect(screen.getByText('Backend')).toBeInTheDocument());

        await user.type(screen.getByPlaceholderText('Role name'), 'DevOps');
        await user.type(screen.getByPlaceholderText('Description'), 'DevOps role');
        await user.click(screen.getByRole('button', { name: 'Create Role' }));

        await waitFor(() => expect(createProjectRole).toHaveBeenCalledWith('DevOps', 'DevOps role'));
    });

    it('selects a role and shows its skills', async () => {
        const user = userEvent.setup();
        render(<ProjectRolesModal open={true} onClose={vi.fn()} />);

        await waitFor(() => expect(screen.getByText('Backend')).toBeInTheDocument());
        await user.click(screen.getByText('Backend'));

        expect(screen.getByText('TypeScript')).toBeInTheDocument();
        expect(screen.getByText('Old Skill')).toBeInTheDocument();
    });

    it('shows a delete confirmation when deleting a role', async () => {
        const user = userEvent.setup();
        render(<ProjectRolesModal open={true} onClose={vi.fn()} />);

        await waitFor(() => expect(screen.getByText('Backend')).toBeInTheDocument());
        const deleteButton = screen.getByRole('button', { name: 'Delete Backend' });
        await user.click(deleteButton);

        expect(screen.getByText(/Confirm deletion/)).toBeInTheDocument();
    });

    it('deletes the role when confirmed', async () => {
        const user = userEvent.setup();
        render(<ProjectRolesModal open={true} onClose={vi.fn()} />);

        await waitFor(() => expect(screen.getByText('Backend')).toBeInTheDocument());
        await user.click(screen.getByRole('button', { name: 'Delete Backend' }));
        await user.click(screen.getByRole('button', { name: 'Delete' }));

        await waitFor(() => expect(deleteProjectRole).toHaveBeenCalledWith('r1'));
    });

    it('creates a new skill for the selected role', async () => {
        const user = userEvent.setup();
        render(<ProjectRolesModal open={true} onClose={vi.fn()} />);

        await waitFor(() => expect(screen.getByText('Backend')).toBeInTheDocument());
        await user.click(screen.getByText('Backend'));

        await user.type(screen.getByPlaceholderText('Add skill, e.g. React'), 'React');
        await user.click(screen.getByRole('button', { name: 'Add' }));

        await waitFor(() => expect(createSkill).toHaveBeenCalledWith('React', ['r1']));
    });

    it('reactivates a retired skill', async () => {
        const user = userEvent.setup();
        render(<ProjectRolesModal open={true} onClose={vi.fn()} />);

        await waitFor(() => expect(screen.getByText('Backend')).toBeInTheDocument());
        await user.click(screen.getByText('Backend'));

        const reactivateButton = screen.getByRole('button', { name: 'Reactivate Old Skill' });
        await user.click(reactivateButton);

        await waitFor(() => expect(reactivateSkill).toHaveBeenCalledWith('sk2', 'Old Skill', ['r1']));
    });

    it('shows a retirement confirmation when retiring a skill', async () => {
        const user = userEvent.setup();
        render(<ProjectRolesModal open={true} onClose={vi.fn()} />);

        await waitFor(() => expect(screen.getByText('Backend')).toBeInTheDocument());
        await user.click(screen.getByText('Backend'));

        const retireButton = screen.getByRole('button', { name: 'Retire TypeScript' });
        await user.click(retireButton);

        expect(screen.getByText(/Confirm retirement/)).toBeInTheDocument();
    });

    it('retires the skill when confirmed', async () => {
        const user = userEvent.setup();
        render(<ProjectRolesModal open={true} onClose={vi.fn()} />);

        await waitFor(() => expect(screen.getByText('Backend')).toBeInTheDocument());
        await user.click(screen.getByText('Backend'));

        await user.click(screen.getByRole('button', { name: 'Retire TypeScript' }));
        await user.click(screen.getByRole('button', { name: 'Retire' }));

        await waitFor(() => expect(deleteSkill).toHaveBeenCalledWith('sk1'));
    });

    it('does not render the modal content when closed', () => {
        render(<ProjectRolesModal open={false} onClose={vi.fn()} />);
        expect(screen.queryByText('Project Roles')).not.toBeInTheDocument();
    });
});
