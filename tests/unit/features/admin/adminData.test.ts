import { describe, expect, it } from 'vitest';
import {
    areAllVisibleUsersSelected,
    filterAdminProjects,
    filterAdminUsers,
    getPaginatedUsers,
    getSafePage,
    getTotalPages,
    removeUsersFromProjects,
    toggleSelectedUserId,
    toggleVisibleUserSelection,
} from '../../../../src/features/admin/data';
import type {
    AdminUser,
    ProjectOverview,
} from '../../../../src/features/admin/types';

const users: AdminUser[] = [
    {
        id: 'user-1',
        username: 'john.doe',
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
        roles: [{ id: 'role-dev', name: 'Developer', description: '', type: 'primary' }],
        permissionGroup: 'Admin',
        projects: [{ id: 'project-1', name: 'SprintStart' }],
        enabled: true,
        profileIcon: '',
        hasCompletedOnboarding: true,
    },
    {
        id: 'user-2',
        username: 'jane.smith',
        email: 'jane@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        roles: [{ id: 'role-qa', name: 'QA', description: '', type: 'primary' }],
        permissionGroup: 'User',
        projects: [],
        enabled: false,
        profileIcon: '',
        hasCompletedOnboarding: false,
    },
];

const projects: ProjectOverview[] = [
    {
        id: 'project-1',
        name: 'SprintStart',
        description: 'Knowledge onboarding',
        sources: [{ id: 'source-1', name: 'Repo', type: 'GITHUB', status: 'CONNECTED' }],
        users: [
            {
                id: 'user-1',
                username: 'john.doe',
                email: 'john@example.com',
                projectRoles: ['MEMBER'],
            },
        ],
    },
];

describe('admin data helpers', () => {
    it('filters users by search and status without mutating source users', () => {
        expect(filterAdminUsers(users, 'qa', 'all')).toEqual([users[1]]);
        expect(filterAdminUsers(users, '', 'disabled')).toEqual([users[1]]);
        expect(filterAdminUsers(users, '', 'onboarded')).toEqual([users[0]]);
        expect(users).toHaveLength(2);
    });

    it('filters projects by source and assigned user values', () => {
        expect(filterAdminProjects(projects, 'github')).toEqual(projects);
        expect(filterAdminProjects(projects, 'john')).toEqual(projects);
        expect(filterAdminProjects(projects, 'missing')).toEqual([]);
    });

    it('paginates users and keeps page values within bounds', () => {
        expect(getTotalPages(17, 8)).toBe(3);
        expect(getSafePage(4, 3)).toBe(3);
        expect(getPaginatedUsers(users, 2, 1)).toEqual([users[1]]);
    });

    it('toggles individual and visible user selections', () => {
        const selected = toggleSelectedUserId(new Set<string>(), 'user-1');
        expect(selected.has('user-1')).toBe(true);

        const allSelected = toggleVisibleUserSelection(selected, users, false);
        expect(areAllVisibleUsersSelected(users, allSelected)).toBe(true);

        const noneSelected = toggleVisibleUserSelection(allSelected, users, true);
        expect(noneSelected.size).toBe(0);
    });

    it('removes users from project assignments immutably', () => {
        const updatedProjects = removeUsersFromProjects(
            projects,
            new Set(['user-1']),
        );

        expect(updatedProjects[0].users).toEqual([]);
        expect(projects[0].users).toHaveLength(1);
    });
});
