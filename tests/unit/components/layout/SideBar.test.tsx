import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { SideBar } from '../../../../src/components/layout/SideBar';
import * as useAuthHook from '../../../../src/context/useAuth';
import { ThemeProvider } from '../../../../src/context/ThemeProvider';
import { PermissionGroup } from '../../../../src/services/types';

vi.mock('../../../../src/context/useAuth', () => ({
    useAuth: vi.fn(),
}));

const mockProfile = {
    id: '1',
    authId: 'auth',
    username: 'TestUser',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    projectRoles: [],
    projectIds: [],
    permissionGroup: PermissionGroup.USER,
    enabled: true,
    profileIcon: null,
    hasCompletedOnboarding: true,
};

function renderWithProviders(ui: React.ReactElement) {
    return render(
        <MemoryRouter>
            <ThemeProvider>{ui}</ThemeProvider>
        </MemoryRouter>,
    );
}

describe('SideBar', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.localStorage.clear();
        document.documentElement.className = '';
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: vi.fn().mockImplementation((query: string) => ({
                matches: false,
                media: query,
            })),
        });
    });

    it('renders basic nav items for regular user', () => {
        vi.mocked(useAuthHook.useAuth).mockReturnValue({
            status: 'authenticated',
            profile: mockProfile,
            login: vi.fn(),
            logout: vi.fn(),
            refetchProfile: vi.fn(),
        });

        renderWithProviders(<SideBar />);

        expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0);
        expect(screen.queryByText('Access Management')).not.toBeInTheDocument();
    });

    it('renders admin nav items for admin user', () => {
        vi.mocked(useAuthHook.useAuth).mockReturnValue({
            status: 'authenticated',
            profile: { ...mockProfile, permissionGroup: PermissionGroup.ADMIN },
            login: vi.fn(),
            logout: vi.fn(),
            refetchProfile: vi.fn(),
        });

        renderWithProviders(<SideBar />);

        expect(screen.getAllByText('Access Management').length).toBeGreaterThan(0);
    });

    it('handles mobile sidebar toggling', async () => {
        const user = userEvent.setup();
        vi.mocked(useAuthHook.useAuth).mockReturnValue({
            status: 'authenticated',
            profile: mockProfile,
            login: vi.fn(),
            logout: vi.fn(),
            refetchProfile: vi.fn(),
        });

        renderWithProviders(<SideBar />);

        await user.click(screen.getByLabelText('Open sidebar'));

        expect(screen.getByLabelText('Close sidebar')).toBeInTheDocument();
        expect(screen.getByLabelText('Close sidebar overlay')).toBeInTheDocument();
    });
});
