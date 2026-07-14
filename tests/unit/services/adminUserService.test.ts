import { describe, it, expect, vi, beforeEach } from 'vitest';
import { adminUserService } from '../../../src/services/adminUserService';
import { http, HttpResponse } from 'msw';
import { server } from '../setup/vitest.setup.ts';

describe('adminUserService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('getCurrentUser fetches and maps permissionGroup correctly', async () => {
        server.use(
            http.get('/api/v1/users/me', () =>
                HttpResponse.json({
                    id: '123',
                    authId: 'auth123',
                    username: 'testuser',
                    email: 'test@example.com',
                    firstName: 'Test',
                    lastName: 'User',
                    projectRoles: [{ id: 'role1', name: 'Developer' }],
                    permissionGroup: 'PM',
                    enabled: true,
                    profileIcon: null,
                    hasCompletedOnboarding: true,
                }),
            ),
        );

        const user = await adminUserService.getCurrentUser();

        expect(user.id).toBe('123');
        expect(user.permissionGroup).toBe('Project Manager');
        expect(user.roles[0].name).toBe('Developer');
    });

    it('getUsers fetches and maps users', async () => {
        const users = await adminUserService.getUsers();

        expect(Array.isArray(users)).toBe(true);
        expect(users.length).toBeGreaterThan(0);
        expect(users[0].username).toBeDefined();
    });

    it('updateUser uses correct endpoint', async () => {
        server.use(
            http.patch('/api/v1/admin/users/123', async ({ request }) => {
                const body = (await request.json()) as Record<string, unknown>;
                expect(body.firstName).toBe('New');
                expect(body.permissionGroup).toBe('HR');
                return HttpResponse.json({
                    id: '123',
                    authId: 'auth123',
                    username: 'testuser',
                    email: 'test@example.com',
                    firstName: 'New',
                    lastName: 'User',
                    projectRoles: [],
                    permissionGroup: 'HR',
                    enabled: true,
                    profileIcon: null,
                    hasCompletedOnboarding: true,
                });
            }),
        );

        const result = await adminUserService.updateUser('123', {
            firstName: 'New',
            permissionGroup: 'HR',
        });

        expect(result.firstName).toBe('New');
    });

    it('deleteUser returns deletion response', async () => {
        server.use(
            http.delete('/api/v1/admin/users/123', () =>
                HttpResponse.json({ id: '123', deleted: true }),
            ),
        );

        const res = await adminUserService.deleteUser('123');
        expect(res.deleted).toBe(true);
        expect(res.id).toBe('123');
    });

    it('updateUserEnabled uses the enabled endpoint and maps the updated user', async () => {
        server.use(
            http.patch('/api/v1/admin/users/123/enabled', async ({ request }) => {
                const body = (await request.json()) as Record<string, unknown>;
                expect(body.enabled).toBe(false);
                return HttpResponse.json({
                    id: '123',
                    authId: 'auth123',
                    username: 'testuser',
                    email: 'test@example.com',
                    firstName: 'Test',
                    lastName: 'User',
                    projectRoles: [],
                    permissionGroup: 'USER',
                    enabled: false,
                    profileIcon: null,
                    hasCompletedOnboarding: true,
                });
            }),
        );

        const result = await adminUserService.updateUserEnabled('123', {
            enabled: false,
        });

        expect(result.enabled).toBe(false);
        expect(result.permissionGroup).toBe('User');
    });

    it('getAvailableRolesFromUsers extracts unique roles and sorts them', () => {
        const users = [
            {
                id: '1',
                username: 'user1',
                email: 'u1@example.com',
                firstName: 'A',
                lastName: 'B',
                roles: [
                    { id: 'b', name: 'Beta Role', description: '', type: 'primary' as const },
                    { id: 'a', name: 'Alpha Role', description: '', type: 'primary' as const },
                ],
                projects: [],
                permissionGroup: 'User',
                enabled: true,
                profileIcon: '',
                hasCompletedOnboarding: true,
            },
            {
                id: '2',
                username: 'user2',
                email: 'u2@example.com',
                firstName: 'C',
                lastName: 'D',
                roles: [
                    { id: 'b', name: 'Beta Role', description: '', type: 'primary' as const },
                ],
                projects: [],
                permissionGroup: 'User',
                enabled: true,
                profileIcon: '',
                hasCompletedOnboarding: true,
            },
        ];

        const roles = adminUserService.getAvailableRolesFromUsers(users);

        expect(roles.length).toBe(2);
        expect(roles[0].name).toBe('Alpha Role');
        expect(roles[1].name).toBe('Beta Role');
    });
});
