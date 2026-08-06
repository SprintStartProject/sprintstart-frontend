import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectManagementTab } from '../../../../../src/features/team-management/components/ProjectManagementTab';
import { projectService } from '../../../../../src/services/projectService';
import { ApiError } from '../../../../../src/services/apiClient';
import type {
    AdminProjectDetails,
    ManagedProject,
    ProjectUser,
} from '../../../../../src/services/projectService';

vi.mock('../../../../../src/services/projectService', async (importOriginal) => {
    const actual =
        await importOriginal<
            typeof import('../../../../../src/services/projectService')
        >();

    return {
        ...actual,
        projectService: {
            ...actual.projectService,
            getAccessibleProject: vi.fn(),
            transferProjectUser: vi.fn(),
        },
    };
});

function projectUser(
    id: string,
    firstName: string,
    projectRoles: string[] = [],
): ProjectUser {
    return {
        id,
        username: firstName.toLowerCase(),
        email: `${firstName.toLowerCase()}@example.com`,
        firstName,
        lastName: 'Mustermann',
        roles: ['USER'],
        projectRoles,
        enabled: true,
    };
}

const erika = projectUser('pm-1', 'Erika');

const alpha: AdminProjectDetails = {
    id: 'p1',
    name: 'Alpha',
    description: 'The alpha project',
    manager: {
        id: erika.id,
        username: erika.username,
        email: erika.email,
        firstName: erika.firstName,
        lastName: erika.lastName,
    },
    sources: [
        {
            id: 's1',
            name: 'alpha-repo',
            type: 'GITHUB',
            status: 'CONNECTED',
        },
    ],
    users: [erika, projectUser('u1', 'Max', ['Developer'])],
};

const beta: AdminProjectDetails = {
    id: 'p2',
    name: 'Beta',
    description: '',
    manager: null,
    sources: [],
    users: [projectUser('u2', 'Lena')],
};

const managedProjects: ManagedProject[] = [
    { id: 'p1', name: 'Alpha', description: '', memberCount: 2 },
    { id: 'p2', name: 'Beta', description: '', memberCount: 1 },
];

describe('ProjectManagementTab', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(projectService.getAccessibleProject).mockImplementation(
            (projectId: string) =>
                Promise.resolve(projectId === 'p1' ? alpha : beta),
        );
        vi.mocked(projectService.transferProjectUser).mockResolvedValue([]);
    });

    it('groups members under their own project', async () => {
        render(<ProjectManagementTab projects={managedProjects} />);

        const alphaSection = await screen.findByRole('region', {
            name: 'Alpha',
        });
        const betaSection = screen.getByRole('region', { name: 'Beta' });

        expect(
            within(alphaSection).getByText('Max Mustermann'),
        ).toBeInTheDocument();
        expect(
            within(betaSection).getByText('Lena Mustermann'),
        ).toBeInTheDocument();
        expect(
            within(alphaSection).queryByText('Lena Mustermann'),
        ).not.toBeInTheDocument();
    });

    it('shows the project description, roles and connected sources', async () => {
        render(<ProjectManagementTab projects={managedProjects} />);

        const alphaSection = await screen.findByRole('region', {
            name: 'Alpha',
        });

        expect(
            within(alphaSection).getByText('The alpha project'),
        ).toBeInTheDocument();
        // Twice: once in the project's role summary, once on the member holding
        // it.
        expect(within(alphaSection).getAllByText('Developer')).toHaveLength(2);
        expect(within(alphaSection).getByText('alpha-repo')).toBeInTheDocument();

        const betaSection = screen.getByRole('region', { name: 'Beta' });
        expect(
            within(betaSection).getByText('Nothing connected'),
        ).toBeInTheDocument();
    });

    it('marks the manager and gives them no move control', async () => {
        render(<ProjectManagementTab projects={managedProjects} />);

        const alphaSection = await screen.findByRole('region', {
            name: 'Alpha',
        });

        expect(
            within(alphaSection).getByText('Project manager'),
        ).toBeInTheDocument();
        expect(
            within(alphaSection).getByText('Erika Mustermann'),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole('combobox', {
                name: 'Move Erika Mustermann to another project',
            }),
        ).not.toBeInTheDocument();
    });

    it('moves a member into the picked project after confirmation', async () => {
        const user = userEvent.setup();
        render(<ProjectManagementTab projects={managedProjects} />);

        await waitFor(() => {
            expect(screen.getByText('Max Mustermann')).toBeInTheDocument();
        });

        await user.click(
            screen.getByRole('combobox', {
                name: 'Move Max Mustermann to another project',
            }),
        );
        await user.click(screen.getByRole('option', { name: 'Beta' }));

        const dialog = await screen.findByRole('alertdialog');
        await user.click(within(dialog).getByRole('button', { name: 'Move' }));

        await waitFor(() => {
            expect(projectService.transferProjectUser).toHaveBeenCalledWith(
                'p2',
                { userId: 'u1', sourceProjectId: 'p1' },
            );
        });
    });

    it('keeps the dialog open and shows why a move was refused', async () => {
        vi.mocked(projectService.transferProjectUser).mockRejectedValue(
            new ApiError(409, 'User with id u1 manages project with id p1.'),
        );

        const user = userEvent.setup();
        render(<ProjectManagementTab projects={managedProjects} />);

        await waitFor(() => {
            expect(screen.getByText('Max Mustermann')).toBeInTheDocument();
        });

        await user.click(
            screen.getByRole('combobox', {
                name: 'Move Max Mustermann to another project',
            }),
        );
        await user.click(screen.getByRole('option', { name: 'Beta' }));

        const dialog = await screen.findByRole('alertdialog');
        await user.click(within(dialog).getByRole('button', { name: 'Move' }));

        expect(
            await screen.findByText(
                'User with id u1 manages project with id p1.',
            ),
        ).toBeInTheDocument();
    });
});
