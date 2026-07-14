import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { MemoryRouter } from 'react-router-dom';
import { UserDetailsDrawer } from '../../../src/features/admin/components/UserDetailsDrawer';
import type { AdminUser, ProjectSummary } from '../../../src/features/admin/types';

vi.mock('../../../src/components/common/UserAvatar', () => ({
    UserAvatar: () => <svg role="img" aria-label="User Avatar" width="64" height="64" />
}));

vi.mock('../../../src/services/adminUserService', () => ({
    adminUserService: {
        updateUser: vi.fn().mockResolvedValue({
            id: 'u1',
            username: 'asmith',
            email: 'alice@example.com',
            firstName: 'Alice',
            lastName: 'Smith',
            roles: [],
            permissionGroup: 'Admin',
            projects: [],
            enabled: true,
            profileIcon: '',
            hasCompletedOnboarding: true
        }),
        updateUserEnabled: vi.fn().mockResolvedValue({
            id: 'u1',
            username: 'asmith',
            email: 'alice@example.com',
            firstName: 'Alice',
            lastName: 'Smith',
            roles: [],
            permissionGroup: 'Admin',
            projects: [],
            enabled: true,
            profileIcon: '',
            hasCompletedOnboarding: true
        })
    }
}));

vi.mock('../../../src/services/teamManagementService', () => ({
    getProjectRoles: vi.fn().mockResolvedValue([
        { id: 'r1', name: 'Developer', description: '' }
    ]),
    assignProjectRoleToUser: vi.fn().mockResolvedValue(undefined),
    unassignProjectRoleFromUser: vi.fn().mockResolvedValue(undefined)
}));

const user: AdminUser = {
    id: 'u1',
    username: 'asmith',
    email: 'alice@example.com',
    firstName: 'Alice',
    lastName: 'Smith',
    roles: [{ id: 'r1', name: 'Developer', description: '', type: 'primary' }],
    permissionGroup: 'Admin',
    projects: [{ id: 'p1', name: 'SprintStart' }],
    enabled: true,
    profileIcon: '',
    hasCompletedOnboarding: true
};

const availableProjects: ProjectSummary[] = [
    { id: 'p1', name: 'SprintStart' },
    { id: 'p2', name: 'Backend' }
];

describe('UserDetailsDrawer Accessibility', () => {
    it('should not have any a11y violations', async () => {
        const { baseElement } = render(
            <MemoryRouter>
                <UserDetailsDrawer
                    user={user}
                    availableProjects={availableProjects}
                    isOpen={true}
                    onClose={vi.fn()}
                    onOpenProjectDetails={vi.fn()}
                    onUserUpdated={vi.fn()}
                    onRequestDelete={vi.fn()}
                />
            </MemoryRouter>
        );

        expect(screen.getByRole('button', { name: 'Edit User' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Delete Alice Smith' })).toBeInTheDocument();
        expect(screen.getByText('Email')).toBeInTheDocument();

        expect(await axe(baseElement)).toHaveNoViolations();
    });
});
