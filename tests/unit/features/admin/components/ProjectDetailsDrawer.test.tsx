import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ProjectDetailsDrawer } from '../../../../../src/features/admin/components/ProjectDetailsDrawer';
import type { AdminProjectDetails, ProjectOverview } from '../../../../../src/features/admin/types';

vi.mock('../../../../../src/services/projectService', () => ({
    projectService: {
        getProjectById: vi.fn(),
    },
}));

import { projectService } from '../../../../../src/services/projectService';

const projectOverview: ProjectOverview = {
    id: 'proj-1',
    name: 'Alpha',
    description: 'Overview description',
    sources: [],
    users: [],
};

const projectDetails: AdminProjectDetails = {
    id: 'proj-1',
    name: 'Alpha',
    description: 'Detailed project description',
    tags: [],
    sources: [
        { id: 'src-1', name: 'Repo A', type: 'GITHUB', status: 'CONNECTED' },
    ],
    users: [
        {
            id: 'u-1',
            username: 'jane.doe',
            email: 'jane@example.com',
            firstName: 'Jane',
            lastName: 'Doe',
            roles: ['ADMIN'],
            projectRoles: ['MEMBER'],
            enabled: true,
        },
    ],
};

describe('ProjectDetailsDrawer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(projectService.getProjectById).mockResolvedValue(projectDetails);
    });

    it('renders the drawer title from the project overview', async () => {
        render(
            <ProjectDetailsDrawer
                project={projectOverview}
                isOpen={true}
                onClose={vi.fn()}
            />,
        );
        await waitFor(() =>
            expect(vi.mocked(projectService.getProjectById)).toHaveBeenCalled(),
        );
        expect(screen.getByText('Alpha')).toBeInTheDocument();
    });

    it('shows a loading state while project details are being fetched', () => {
        vi.mocked(projectService.getProjectById).mockReturnValue(
            new Promise<AdminProjectDetails>(() => {}),
        );

        render(
            <ProjectDetailsDrawer
                project={projectOverview}
                isOpen={true}
                onClose={vi.fn()}
            />,
        );

        expect(screen.getByText('Loading project details...')).toBeInTheDocument();
        expect(vi.mocked(projectService.getProjectById)).toHaveBeenCalledWith('proj-1');
    });

    it('loads and displays project details via the service', async () => {
        vi.mocked(projectService.getProjectById).mockResolvedValue(projectDetails);

        render(
            <ProjectDetailsDrawer
                project={projectOverview}
                isOpen={true}
                onClose={vi.fn()}
            />,
        );

        await waitFor(() =>
            expect(screen.getByText('Detailed project description')).toBeInTheDocument(),
        );
        expect(screen.getByText('Repo A')).toBeInTheDocument();
        expect(screen.getByText('GITHUB')).toBeInTheDocument();
        expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    });

    it('shows an error state when the project details fail to load', async () => {
        vi.mocked(projectService.getProjectById).mockRejectedValue(
            new Error('Network down'),
        );

        render(
            <ProjectDetailsDrawer
                project={projectOverview}
                isOpen={true}
                onClose={vi.fn()}
            />,
        );

        await waitFor(() =>
            expect(
                screen.getByText('Project details could not be loaded'),
            ).toBeInTheDocument(),
        );
        expect(screen.getByText('Network down')).toBeInTheDocument();
    });

    it('does not fetch details while the drawer is closed', () => {
        render(
            <ProjectDetailsDrawer
                project={projectOverview}
                isOpen={false}
                onClose={vi.fn()}
            />,
        );

        expect(vi.mocked(projectService.getProjectById)).not.toHaveBeenCalled();
    });
});
