import { describe, it, expect } from 'vitest';
import {
    PAGE_SIZE,
    DRAWER_CLOSE_DELAY_MS,
    PERMISSION_GROUP_OPTIONS,
    USER_FILTER_OPTIONS,
    getDisplayName,
    getPermissionGroupVariant,
    getSourceStatusVariant,
    getProjectUsersCount,
    getProjectSourcesCount,
    getUserEditFormState,
    getDraftDisplayName,
    enrichUsersWithProjectNames,
} from '../../../../src/features/admin/data';
import type { AdminUser, UserEditFormState } from '../../../../src/features/admin/types';

function createAdminUser(overrides: Partial<AdminUser> = {}): AdminUser {
    return {
        id: 'u1',
        authId: 'auth1',
        username: 'testuser',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        roles: [],
        permissionGroup: 'ADMIN',
        projects: [],
        projectIds: [],
        enabled: true,
        profileIcon: 'icon',
        hasCompletedOnboarding: true,
        ...overrides,
    };
}

describe('admin data helpers', () => {
    describe('constants', () => {
        it('exports a page size of 8', () => {
            expect(PAGE_SIZE).toBe(8);
        });

        it('exports the drawer close delay in ms', () => {
            expect(DRAWER_CLOSE_DELAY_MS).toBeGreaterThan(0);
        });

        it('exports permission group options', () => {
            expect(PERMISSION_GROUP_OPTIONS).toContain('Admin');
            expect(PERMISSION_GROUP_OPTIONS).toContain('User');
            expect(PERMISSION_GROUP_OPTIONS).toContain('Project Manager');
        });

        it('exports user filter options with value/label pairs', () => {
            expect(USER_FILTER_OPTIONS.length).toBeGreaterThan(0);
            for (const option of USER_FILTER_OPTIONS) {
                expect(option).toHaveProperty('value');
                expect(option).toHaveProperty('label');
                expect(typeof option.label).toBe('string');
            }
        });
    });

    describe('getDisplayName', () => {
        it('returns the full name when first and last name are present', () => {
            expect(getDisplayName(createAdminUser({ firstName: 'Jane', lastName: 'Doe' }))).toBe('Jane Doe');
        });

        it('falls back to username when name parts are empty', () => {
            expect(getDisplayName(createAdminUser({ firstName: '', lastName: '', username: 'janedoe' }))).toBe('janedoe');
        });

        it('falls back to email when name and username are empty', () => {
            expect(getDisplayName(createAdminUser({ firstName: '', lastName: '', username: '', email: 'jane@x.com' }))).toBe('jane@x.com');
        });
    });

    describe('getPermissionGroupVariant', () => {
        it('returns warning for ADMIN (case-insensitive)', () => {
            expect(getPermissionGroupVariant('admin')).toBe('warning');
            expect(getPermissionGroupVariant('ADMIN')).toBe('warning');
        });

        it('returns success for PROJECT_MANAGER', () => {
            expect(getPermissionGroupVariant('PROJECT_MANAGER')).toBe('success');
        });

        it('returns neutral for USER', () => {
            expect(getPermissionGroupVariant('USER')).toBe('neutral');
        });
    });

    describe('getSourceStatusVariant', () => {
        it('returns success for CONNECTED', () => {
            expect(getSourceStatusVariant('CONNECTED')).toBe('success');
        });

        it('returns warning for INDEXING', () => {
            expect(getSourceStatusVariant('INDEXING')).toBe('warning');
        });

        it('returns danger for ERROR', () => {
            expect(getSourceStatusVariant('ERROR')).toBe('danger');
        });

        it('returns neutral for DISCONNECTED', () => {
            expect(getSourceStatusVariant('DISCONNECTED')).toBe('neutral');
        });

        it('returns brand for unknown status', () => {
            expect(getSourceStatusVariant('UNKNOWN')).toBe('brand');
        });
    });

    describe('getProjectUsersCount / getProjectSourcesCount', () => {
        it('returns the users array length', () => {
            expect(getProjectUsersCount({ users: [1, 2, 3] })).toBe(3);
        });

        it('returns the sources array length', () => {
            expect(getProjectSourcesCount({ sources: ['a'] })).toBe(1);
        });
    });

    describe('getUserEditFormState', () => {
        it('extracts the editable fields from an AdminUser', () => {
            const user = createAdminUser({
                email: 'new@x.com',
                firstName: 'Jane',
                lastName: 'Doe',
                permissionGroup: 'PM',
                enabled: false,
            });
            const state = getUserEditFormState(user);
            expect(state).toEqual<UserEditFormState>({
                email: 'new@x.com',
                firstName: 'Jane',
                lastName: 'Doe',
                permissionGroup: 'PM',
                enabled: false,
            });
        });
    });

    describe('getDraftDisplayName', () => {
        it('prefers the draft name over the persisted username', () => {
            const user = createAdminUser({ username: 'olduser' });
            const draft: UserEditFormState = {
                email: 'jane@x.com',
                firstName: 'Jane',
                lastName: 'Doe',
                permissionGroup: 'USER',
                enabled: true,
            };
            expect(getDraftDisplayName(user, draft)).toBe('Jane Doe');
        });

        it('falls back to the user username when draft names are empty', () => {
            const user = createAdminUser({ username: 'persisted' });
            const draft: UserEditFormState = {
                email: 'jane@x.com',
                firstName: '',
                lastName: '',
                permissionGroup: 'USER',
                enabled: true,
            };
            expect(getDraftDisplayName(user, draft)).toBe('persisted');
        });

        it('falls back to draft email when username and draft names are empty', () => {
            const user = createAdminUser({ username: '' });
            const draft: UserEditFormState = {
                email: 'fallback@x.com',
                firstName: '',
                lastName: '',
                permissionGroup: 'USER',
                enabled: true,
            };
            expect(getDraftDisplayName(user, draft)).toBe('fallback@x.com');
        });
    });

    describe('enrichUsersWithProjectNames', () => {
        it('resolves the assigned project ids into named projects', () => {
            const user = createAdminUser({ projectIds: ['p2', 'p1'] });

            const [enriched] = enrichUsersWithProjectNames(
                [user],
                [
                    { id: 'p1', name: 'Alpha' },
                    { id: 'p2', name: 'Beta' },
                ],
            );

            expect(enriched.projects).toEqual([
                { id: 'p2', name: 'Beta' },
                { id: 'p1', name: 'Alpha' },
            ]);
        });

        it('keeps an unknown project id visible with a placeholder name', () => {
            const user = createAdminUser({ projectIds: ['deleted-1234-5678'] });

            const [enriched] = enrichUsersWithProjectNames([user], []);

            expect(enriched.projects).toEqual([
                { id: 'deleted-1234-5678', name: 'Project deleted-' },
            ]);
        });

        it('falls back to already resolved projects when no ids are set', () => {
            const user = createAdminUser({
                projectIds: [],
                projects: [{ id: 'p1', name: 'Alpha' }],
            });

            const [enriched] = enrichUsersWithProjectNames([user], []);

            expect(enriched.projects).toEqual([{ id: 'p1', name: 'Alpha' }]);
        });
    });
});
