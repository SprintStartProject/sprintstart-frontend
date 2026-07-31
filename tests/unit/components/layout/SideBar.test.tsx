import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { SideBar } from '../../../../src/components/layout/SideBar';
import * as useAuthHook from '../../../../src/context/useAuth';
import { ThemeProvider } from '../../../../src/context/ThemeProvider';
import { PermissionGroup } from '../../../../src/services/types';

vi.mock('../../../../src/features/projects/useProjectContext', async () => {
    const { createProjectContextValue, createSelectableProject } = await import('../../setup/projectContext');
    const project = createSelectableProject({ id: 'proj1' });
    return {
        useProjectContext: () =>
            createProjectContextValue({
                projects: [project],
                selectedProject: project,
                selectedProjectId: 'proj1',
                canManageSelected: true,
            }),
    };
});

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
            // Framer Motion's `useReducedMotion` (used by the sidebar nav items)
            // subscribes to the media query, so the mock needs the listener API.
            value: vi.fn().mockImplementation((query: string) => ({
                matches: false,
                media: query,
                onchange: null,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                addListener: vi.fn(),
                removeListener: vi.fn(),
                dispatchEvent: vi.fn(),
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

    it('hides the OnBoarding entry once onboarding is completed', () => {
        vi.mocked(useAuthHook.useAuth).mockReturnValue({
            status: 'authenticated',
            profile: { ...mockProfile, hasCompletedOnboarding: true },
            login: vi.fn(),
            logout: vi.fn(),
            refetchProfile: vi.fn(),
        });

        renderWithProviders(<SideBar />);

        expect(screen.queryByText('OnBoarding')).not.toBeInTheDocument();
    });

    it('shows the OnBoarding entry while onboarding is still open', () => {
        vi.mocked(useAuthHook.useAuth).mockReturnValue({
            status: 'authenticated',
            profile: { ...mockProfile, hasCompletedOnboarding: false },
            login: vi.fn(),
            logout: vi.fn(),
            refetchProfile: vi.fn(),
        });

        renderWithProviders(<SideBar />);

        expect(screen.getAllByText('OnBoarding').length).toBeGreaterThan(0);
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
