import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AdminPage } from '../../../src/pages/AdminPage';
import type { AdminUser, ProjectSummary } from '../../../src/services/adminUserService';
import type { AdminProject, ProjectSource, ProjectUserSummary } from '../../../src/services/projectService';

vi.mock('../../../src/context/useAuth', () => ({
    useAuth: () => ({ profile: { id: 'admin1', firstName: 'Admin', lastName: 'User' } }),
}));

const { mockGetUsers, mockDeleteUser, mockGetProjects, mockGetGithubPatNames } = vi.hoisted(() => ({
    mockGetUsers: vi.fn(),
    mockDeleteUser: vi.fn(),
    mockGetProjects: vi.fn(),
    mockGetGithubPatNames: vi.fn(),
}));

vi.mock('../../../src/services/adminUserService', () => ({
    adminUserService: {
        getUsers: mockGetUsers,
        deleteUser: mockDeleteUser,
        getUserById: vi.fn(),
        updateUser: vi.fn(),
        updateUserRoles: vi.fn(),
        updateUserEnabled: vi.fn(),
        getCurrentUser: vi.fn(),
        getAvailableRolesFromUsers: vi.fn(),
    },
}));

vi.mock('../../../src/services/projectService', () => ({
    projectService: {
        getProjects: mockGetProjects,
        getProjectById: vi.fn(),
        getProjectUsers: vi.fn(),
        createProject: vi.fn(),
        updateProject: vi.fn(),
        deleteProject: vi.fn(),
        assignUsersToProject: vi.fn(),
        removeUserFromProject: vi.fn(),
        resetProjectMocks: vi.fn(),
    },
}));

vi.mock('../../../src/services/sources/githubService', () => ({
    getGithubPatNames: mockGetGithubPatNames,
}));

vi.mock('../../../src/features/admin/components/UsersTab', () => ({
    UsersTab: (props: {
        paginatedUsers: AdminUser[];
        onOpenUserDetails: (user: AdminUser) => void;
        onRequestUserDeleteFromMenu: (e: { stopPropagation: () => void }, user: AdminUser) => void;
        onToggleUserSelection: (id: string) => void;
    }) => (
        <div data-testid="users-tab">
            {props.paginatedUsers.map((user) => (
                <div key={user.id} data-testid={`user-row-${user.id}`}>
                    <span>{user.firstName} {user.lastName}</span>
                    <button onClick={() => props.onOpenUserDetails(user)}>View {user.firstName}</button>
                    <button onClick={(e) => props.onRequestUserDeleteFromMenu(e, user)}>Delete {user.firstName}</button>
                    <button onClick={() => props.onToggleUserSelection(user.id)}>Select {user.firstName}</button>
                </div>
            ))}
        </div>
    ),
}));

vi.mock('../../../src/features/admin/components/ProjectsTab', () => ({
    ProjectsTab: (props: { filteredProjects: AdminProject[]; onOpenProjectDetails: (p: AdminProject) => void }) => (
        <div data-testid="projects-tab">
            {props.filteredProjects.map((project) => (
                <div key={project.id}>
                    <span>{project.name}</span>
                    <button onClick={() => props.onOpenProjectDetails(project)}>Open {project.name}</button>
                </div>
            ))}
        </div>
    ),
}));

vi.mock('../../../src/features/admin/components/TokensTab', () => ({
    TokensTab: (props: { tokenNames: string[]; onRefresh: () => void }) => (
        <div data-testid="tokens-tab">
            {props.tokenNames.map((name) => <span key={name}>{name}</span>)}
        </div>
    ),
}));

vi.mock('../../../src/features/admin/components/UserDetailsDrawer', () => ({
    UserDetailsDrawer: (props: { user: AdminUser | null; isOpen: boolean }) => (
        <div data-testid="user-details-drawer">
            {props.isOpen && props.user ? <span>{props.user.firstName} Details</span> : null}
        </div>
    ),
}));

vi.mock('../../../src/features/admin/components/ProjectDetailsDrawer', () => ({
    ProjectDetailsDrawer: (props: { project: AdminProject | null; isOpen: boolean }) => (
        <div data-testid="project-details-drawer">
            {props.isOpen && props.project ? <span>{props.project.name} Details</span> : null}
        </div>
    ),
}));

function createMockUser(overrides: Partial<AdminUser> = {}): AdminUser {
    return {
        id: '1',
        username: 'user1',
        email: 'user1@example.com',
        firstName: 'John',
        lastName: 'Doe',
        roles: [],
        permissionGroup: 'User',
        projects: [] as ProjectSummary[],
        projectIds: [],
        enabled: true,
        profileIcon: '',
        hasCompletedOnboarding: true,
        ...overrides,
    };
}

function createMockProject(overrides: Partial<AdminProject> = {}): AdminProject {
    return {
        id: 'proj1',
        name: 'Project Alpha',
        description: 'A test project',
        sources: [] as ProjectSource[],
        users: [] as ProjectUserSummary[],
        ...overrides,
    };
}

describe('AdminPage', () => {
    const mockUsers: AdminUser[] = [
        createMockUser({ id: '1', firstName: 'John', lastName: 'Doe', username: 'johndoe' }),
        createMockUser({ id: '2', firstName: 'Jane', lastName: 'Smith', username: 'janesmith', enabled: false }),
    ];
    const mockProjects: AdminProject[] = [createMockProject()];

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetUsers.mockResolvedValue(mockUsers);
        mockDeleteUser.mockResolvedValue({ id: '1', deleted: true });
        mockGetProjects.mockResolvedValue(mockProjects);
        mockGetGithubPatNames.mockResolvedValue(['token1']);
    });

    it('renders the users tab by default after loading', async () => {
        render(<MemoryRouter><AdminPage /></MemoryRouter>);

        await waitFor(() => {
            expect(screen.getByTestId('users-tab')).toBeInTheDocument();
        });

        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });

    it('switches to the projects tab when clicked', async () => {
        const user = userEvent.setup();
        render(<MemoryRouter><AdminPage /></MemoryRouter>);

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Projects' })).toBeInTheDocument();
        });

        await user.click(screen.getByRole('button', { name: 'Projects' }));

        await waitFor(() => {
            expect(screen.getByTestId('projects-tab')).toBeInTheDocument();
        });
        expect(screen.getByText('Project Alpha')).toBeInTheDocument();
    });

    it('switches to the tokens tab when clicked', async () => {
        const user = userEvent.setup();
        render(<MemoryRouter><AdminPage /></MemoryRouter>);

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Tokens' })).toBeInTheDocument();
        });

        await user.click(screen.getByRole('button', { name: 'Tokens' }));

        await waitFor(() => {
            expect(screen.getByTestId('tokens-tab')).toBeInTheDocument();
        });
    });

    it('filters users by search query', async () => {
        const user = userEvent.setup();
        render(<MemoryRouter><AdminPage /></MemoryRouter>);

        await waitFor(() => {
            expect(screen.getByText('John Doe')).toBeInTheDocument();
        });

        const searchInput = screen.getByPlaceholderText('Search users...');
        await user.type(searchInput, 'Jane');

        await waitFor(() => {
            expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
        });
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });

    it('opens a single delete AlertDialog when delete is requested', async () => {
        const user = userEvent.setup();
        render(<MemoryRouter><AdminPage /></MemoryRouter>);

        await waitFor(() => {
            expect(screen.getByText('Delete John')).toBeInTheDocument();
        });

        await user.click(screen.getByText('Delete John'));

        await waitFor(() => {
            expect(screen.getByText('Delete user?')).toBeInTheDocument();
        });
        expect(screen.getByText(/Are you sure you want to delete/)).toBeInTheDocument();
    });

    it('confirms single user delete and calls adminUserService.deleteUser', async () => {
        const user = userEvent.setup();
        render(<MemoryRouter><AdminPage /></MemoryRouter>);

        await waitFor(() => {
            expect(screen.getByText('Delete John')).toBeInTheDocument();
        });

        await user.click(screen.getByText('Delete John'));

        await waitFor(() => {
            expect(screen.getByText('Delete user?')).toBeInTheDocument();
        });

        await user.click(screen.getByRole('button', { name: 'Delete user' }));

        await waitFor(() => {
            expect(mockDeleteUser).toHaveBeenCalledWith('1');
        });
    });

    it('opens bulk delete AlertDialog when multiple users are selected', async () => {
        const user = userEvent.setup();
        render(<MemoryRouter><AdminPage /></MemoryRouter>);

        await waitFor(() => {
            expect(screen.getByText('Select John')).toBeInTheDocument();
        });

        await user.click(screen.getByText('Select John'));
        await user.click(screen.getByText('Select Jane'));

        await waitFor(() => {
            expect(screen.getByText('Delete All')).toBeInTheDocument();
        });

        await user.click(screen.getByRole('button', { name: 'Delete All' }));

        await waitFor(() => {
            expect(screen.getByText('Delete selected users?')).toBeInTheDocument();
        });
    });

    it('opens the user details drawer when View is clicked', async () => {
        const user = userEvent.setup();
        render(<MemoryRouter><AdminPage /></MemoryRouter>);

        await waitFor(() => {
            expect(screen.getByText('View John')).toBeInTheDocument();
        });

        await user.click(screen.getByText('View John'));

        await waitFor(() => {
            expect(screen.getByText('John Details')).toBeInTheDocument();
        });
    });
});
