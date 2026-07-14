import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { UsersTab } from '../../../../src/features/admin/components/UsersTab';
import type { AdminUser } from '../../../../src/services/adminUserService';

describe('UsersTab', () => {
    const mockUsers: AdminUser[] = [
        {
            id: '1',
            username: 'user1',
            email: 'user1@example.com',
            firstName: 'John',
            lastName: 'Doe',
            roles: [],
            permissionGroup: 'Admin',
            projects: [],
            enabled: true,
            profileIcon: '',
            hasCompletedOnboarding: true,
        },
        {
            id: '2',
            username: 'user2',
            email: 'user2@example.com',
            firstName: 'Jane',
            lastName: 'Smith',
            roles: [],
            permissionGroup: 'User',
            projects: [],
            enabled: false,
            profileIcon: '',
            hasCompletedOnboarding: true,
        },
    ];

    const defaultProps = {
        paginatedUsers: mockUsers,
        selectedUserIds: new Set<string>(),
        allVisibleUsersSelected: false,
        openUserMenuId: null as string | null,
        onToggleAllVisibleUsers: vi.fn(),
        onToggleUserSelection: vi.fn(),
        onOpenUserDetails: vi.fn(),
        onToggleUserContextMenu: vi.fn(),
        onOpenUserDetailsFromMenu: vi.fn(),
        onRequestUserDeleteFromMenu: vi.fn(),
    };

    it('shows empty state when no users', () => {
        render(<UsersTab {...defaultProps} paginatedUsers={[]} />);
        expect(screen.getByText('No users found')).toBeInTheDocument();
    });

    it('renders user list', () => {
        render(<UsersTab {...defaultProps} />);

        expect(screen.getAllByText('John Doe').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Jane Smith').length).toBeGreaterThan(0);
        expect(screen.getAllByText('user1@example.com').length).toBeGreaterThan(0);
    });

    it('calls onToggleUserSelection when checkbox is clicked', async () => {
        const user = userEvent.setup();
        render(<UsersTab {...defaultProps} />);

        const checkboxes = screen.getAllByLabelText('Select John Doe');
        await user.click(checkboxes[0]);
        expect(defaultProps.onToggleUserSelection).toHaveBeenCalledWith('1');
    });

    it('calls onOpenUserDetails when row is clicked', async () => {
        const user = userEvent.setup();
        render(<UsersTab {...defaultProps} />);

        await user.click(
            screen.getByRole('button', { name: 'Open details for John Doe' }),
        );
        expect(defaultProps.onOpenUserDetails).toHaveBeenCalledWith(mockUsers[0]);
    });

    it('renders context menu and triggers delete', async () => {
        const user = userEvent.setup();
        render(<UsersTab {...defaultProps} openUserMenuId="1" />);

        const deleteButtons = screen.getAllByText('Delete');
        await user.click(deleteButtons[0]);
        expect(defaultProps.onRequestUserDeleteFromMenu).toHaveBeenCalled();
    });
});
