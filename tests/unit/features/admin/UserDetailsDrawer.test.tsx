import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { UserDetailsDrawer } from '../../../../src/features/admin/components/UserDetailsDrawer';
import type { AdminUser } from '../../../../src/features/admin/types';
import { server } from '../../setup/vitest.setup';

const userDetails: AdminUser = {
    id: '123',
    authId: 'auth-123',
    username: 'john.doe',
    email: 'john@example.com',
    firstName: 'John',
    lastName: 'Doe',
    roles: [{ id: 'role-dev', name: 'Developer', description: '', type: 'primary' }],
    permissionGroup: 'User',
    projects: [],
    projectIds: [],
    enabled: true,
    profileIcon: '',
    hasCompletedOnboarding: true,
};

function renderDrawer(overrides: Partial<AdminUser> = {}) {
    const onUserUpdated = vi.fn();
    const onClose = vi.fn();
    const onOpenProjectDetails = vi.fn();
    const onRequestDelete = vi.fn();

    render(
        <UserDetailsDrawer
            user={{ ...userDetails, ...overrides }}
            availableProjects={[]}
            isOpen
            onClose={onClose}
            onOpenProjectDetails={onOpenProjectDetails}
            onUserUpdated={onUserUpdated}
            onRequestDelete={onRequestDelete}
        />,
    );

    return { onUserUpdated, onClose, onOpenProjectDetails, onRequestDelete };
}

describe('UserDetailsDrawer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('saves edited user details and account access changes', async () => {
        const appPatchBodies: unknown[] = [];
        const enabledPatchBodies: unknown[] = [];
        const { onUserUpdated } = renderDrawer();
        const user = userEvent.setup();

        server.use(
            http.patch('/api/v1/admin/users/123', async ({ request }) => {
                const body = await request.json();
                appPatchBodies.push(body);
                return HttpResponse.json({
                    id: '123',
                    authId: 'auth-123',
                    username: 'john.doe',
                    email: 'john.new@example.com',
                    firstName: 'John',
                    lastName: 'Doe',
                    projectRoles: [{ id: 'role-dev', name: 'Developer' }],
                    permissionGroup: 'USER',
                    enabled: true,
                    profileIcon: null,
                    hasCompletedOnboarding: true,
                });
            }),
            http.patch('/api/v1/admin/users/123/enabled', async ({ request }) => {
                const body = await request.json();
                enabledPatchBodies.push(body);
                return HttpResponse.json({
                    id: '123',
                    authId: 'auth-123',
                    username: 'john.doe',
                    email: 'john.new@example.com',
                    firstName: 'John',
                    lastName: 'Doe',
                    projectRoles: [{ id: 'role-dev', name: 'Developer' }],
                    permissionGroup: 'USER',
                    enabled: false,
                    profileIcon: null,
                    hasCompletedOnboarding: true,
                });
            }),
        );

        await user.click(screen.getByRole('button', { name: 'Edit User' }));
        await user.clear(screen.getByLabelText('Email'));
        await user.type(screen.getByLabelText('Email'), 'john.new@example.com');
        await user.click(screen.getByRole('switch', { name: 'Toggle account access' }));
        await user.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => {
            expect(appPatchBodies).toEqual([
                {
                    email: 'john.new@example.com',
                    firstName: 'John',
                    lastName: 'Doe',
                    permissionGroup: 'USER',
                },
            ]);
            expect(enabledPatchBodies).toEqual([{ enabled: false }]);
            expect(onUserUpdated).toHaveBeenCalledWith(
                expect.objectContaining({
                    email: 'john.new@example.com',
                    enabled: false,
                }),
            );
        });
    });

    it('shows validation feedback when email is empty', async () => {
        const { onUserUpdated } = renderDrawer();
        const user = userEvent.setup();

        await user.click(screen.getByRole('button', { name: 'Edit User' }));
        await user.clear(screen.getByLabelText('Email'));
        await user.click(screen.getByRole('button', { name: 'Save' }));

        expect(screen.getByText('Email is required.')).toBeInTheDocument();
        expect(onUserUpdated).not.toHaveBeenCalled();
    });
});
