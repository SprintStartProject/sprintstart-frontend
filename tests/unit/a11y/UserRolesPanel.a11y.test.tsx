import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { MemoryRouter } from 'react-router-dom';
import { UserRolesPanel } from '../../../src/features/admin/components/UserRolesPanel';
import type { ProjectRole } from '../../../src/features/team-management/types';

vi.mock('../../../src/services/teamManagementService', () => ({
    getProjectRoles: vi.fn().mockResolvedValue([
        { id: 'r1', name: 'Developer', description: '' },
        { id: 'r2', name: 'Designer', description: '' }
    ]),
    assignProjectRoleToUser: vi.fn().mockResolvedValue(undefined),
    unassignProjectRoleFromUser: vi.fn().mockResolvedValue(undefined)
}));

const assignedRoles: ProjectRole[] = [
    { id: 'r1', name: 'Developer', description: '' }
];

describe('UserRolesPanel Accessibility', () => {
    it('should not have any a11y violations', async () => {
        const { baseElement } = render(
            <MemoryRouter>
                <main>
                    <UserRolesPanel
                        userId="u1"
                        assignedRoles={assignedRoles}
                        onRolesChanged={vi.fn()}
                    />
                </main>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Add role/ })).toBeInTheDocument();
        });
        expect(screen.getByRole('button', { name: 'Remove Developer' })).toBeInTheDocument();

        expect(await axe(baseElement)).toHaveNoViolations();
    });
});
