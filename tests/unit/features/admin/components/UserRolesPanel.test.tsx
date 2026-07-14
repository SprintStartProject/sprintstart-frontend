import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ProjectRole } from '../../../../../src/features/team-management/types';

vi.mock('../../../../../src/services/teamManagementService', () => ({
    getProjectRoles: vi.fn(),
    assignProjectRoleToUser: vi.fn(),
    unassignProjectRoleFromUser: vi.fn(),
}));

import { UserRolesPanel } from '../../../../../src/features/admin/components/UserRolesPanel';
import {
    getProjectRoles,
    assignProjectRoleToUser,
    unassignProjectRoleFromUser,
} from '../../../../../src/services/teamManagementService';

const availableRoles: ProjectRole[] = [
    { id: 'role-1', name: 'Backend', description: '' },
    { id: 'role-2', name: 'Frontend', description: '' },
    { id: 'role-3', name: 'DevOps', description: '' },
];

describe('UserRolesPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getProjectRoles).mockResolvedValue(availableRoles);
        vi.mocked(assignProjectRoleToUser).mockResolvedValue(undefined);
        vi.mocked(unassignProjectRoleFromUser).mockResolvedValue(undefined);
    });

    it('renders the assigned roles', async () => {
        const assigned: ProjectRole[] = [
            { id: 'role-1', name: 'Backend', description: '' },
        ];

        render(
            <UserRolesPanel
                userId="user-1"
                assignedRoles={assigned}
                onRolesChanged={vi.fn()}
            />,
        );

        await waitFor(() =>
            expect(vi.mocked(getProjectRoles)).toHaveBeenCalled(),
        );
        expect(screen.getByText('Backend')).toBeInTheDocument();
    });

    it('shows the no-roles fallback when no roles are assigned', async () => {
        render(
            <UserRolesPanel
                userId="user-1"
                assignedRoles={[]}
                onRolesChanged={vi.fn()}
            />,
        );

        await waitFor(() =>
            expect(vi.mocked(getProjectRoles)).toHaveBeenCalled(),
        );
        expect(screen.getByText('No role assigned yet.')).toBeInTheDocument();
    });

    it('opens the picker when Add role is clicked and lists unassigned roles', async () => {
        const user = userEvent.setup();
        const assigned: ProjectRole[] = [
            { id: 'role-1', name: 'Backend', description: '' },
        ];

        render(
            <UserRolesPanel
                userId="user-1"
                assignedRoles={assigned}
                onRolesChanged={vi.fn()}
            />,
        );

        await user.click(screen.getByRole('button', { name: /Add role/i }));

        const select = screen.getByRole('combobox');
        const optionValues = Array.from(select.querySelectorAll('option')).map(
            (opt) => opt.textContent,
        );
        expect(optionValues).toContain('Frontend');
        expect(optionValues).toContain('DevOps');
        expect(optionValues).not.toContain('Backend');
    });

    it('assigns a role via the picker and notifies the parent', async () => {
        const user = userEvent.setup();
        const onRolesChanged = vi.fn();

        render(
            <UserRolesPanel
                userId="user-1"
                assignedRoles={[]}
                onRolesChanged={onRolesChanged}
            />,
        );

        await user.click(screen.getByRole('button', { name: /Add role/i }));

        const select = screen.getByRole('combobox');
        await user.selectOptions(select, 'role-2');
        await user.click(screen.getByRole('button', { name: /Assign/i }));

        await waitFor(() =>
            expect(vi.mocked(assignProjectRoleToUser)).toHaveBeenCalledWith(
                'user-1',
                'role-2',
            ),
        );
        await waitFor(() =>
            expect(onRolesChanged).toHaveBeenCalledWith([
                { id: 'role-2', name: 'Frontend', description: '' },
            ]),
        );
    });

    it('removes an assigned role and calls the unassign service', async () => {
        const user = userEvent.setup();
        const onRolesChanged = vi.fn();
        const assigned: ProjectRole[] = [
            { id: 'role-1', name: 'Backend', description: '' },
        ];

        render(
            <UserRolesPanel
                userId="user-1"
                assignedRoles={assigned}
                onRolesChanged={onRolesChanged}
            />,
        );

        await user.click(screen.getByRole('button', { name: 'Remove Backend' }));

        await waitFor(() =>
            expect(vi.mocked(unassignProjectRoleFromUser)).toHaveBeenCalledWith(
                'user-1',
                'role-1',
            ),
        );
        await waitFor(() => expect(onRolesChanged).toHaveBeenCalledWith([]));
    });
});
