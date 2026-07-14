import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProjectAccessPanel } from '../../../../../src/features/admin/components/ProjectAccessPanel';
import type { ProjectSummary } from '../../../../../src/services/adminUserService';

vi.mock('../../../../../src/services/projectService', () => ({
    projectService: {},
}));

const assignedProjects: ProjectSummary[] = [
    { id: 'proj-1', name: 'Alpha' },
];

const availableProjects: ProjectSummary[] = [
    { id: 'proj-1', name: 'Alpha' },
    { id: 'proj-2', name: 'Beta' },
    { id: 'proj-3', name: 'Gamma' },
];

describe('ProjectAccessPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the assigned projects', () => {
        render(
            <ProjectAccessPanel
                assignedProjects={assignedProjects}
                availableProjects={availableProjects}
                onOpenProjectDetails={vi.fn()}
            />,
        );

        expect(screen.getByText('Alpha')).toBeInTheDocument();
    });

    it('shows the no-projects fallback when none are assigned', () => {
        render(
            <ProjectAccessPanel
                assignedProjects={[]}
                availableProjects={availableProjects}
                onOpenProjectDetails={vi.fn()}
            />,
        );

        expect(screen.getByText('No projects assigned')).toBeInTheDocument();
    });

    it('opens a searchable picker with unassigned projects', async () => {
        const user = userEvent.setup();
        render(
            <ProjectAccessPanel
                assignedProjects={assignedProjects}
                availableProjects={availableProjects}
                onOpenProjectDetails={vi.fn()}
            />,
        );

        await user.click(screen.getByRole('button', { name: /Add project/i }));

        expect(screen.getByPlaceholderText('Search projects...')).toBeInTheDocument();
        expect(screen.getByText('Beta')).toBeInTheDocument();
        expect(screen.getByText('Gamma')).toBeInTheDocument();
    });

    it('filters available projects by search term', async () => {
        const user = userEvent.setup();
        render(
            <ProjectAccessPanel
                assignedProjects={assignedProjects}
                availableProjects={availableProjects}
                onOpenProjectDetails={vi.fn()}
            />,
        );

        await user.click(screen.getByRole('button', { name: /Add project/i }));
        await user.type(screen.getByPlaceholderText('Search projects...'), 'gam');

        expect(screen.getByText('Gamma')).toBeInTheDocument();
        expect(screen.queryByText('Beta')).not.toBeInTheDocument();
    });

    it('adds a project from the picker to the assigned list', async () => {
        const user = userEvent.setup();
        render(
            <ProjectAccessPanel
                assignedProjects={assignedProjects}
                availableProjects={availableProjects}
                onOpenProjectDetails={vi.fn()}
            />,
        );

        await user.click(screen.getByRole('button', { name: /Add project/i }));
        await user.click(screen.getByText('Beta'));

        const alphaCards = screen.getAllByText('Alpha');
        const betaCards = screen.getAllByText('Beta');
        expect(alphaCards.length).toBeGreaterThan(0);
        expect(betaCards.length).toBeGreaterThan(0);
    });

    it('removes an assigned project via the remove button', async () => {
        const user = userEvent.setup();
        render(
            <ProjectAccessPanel
                assignedProjects={assignedProjects}
                availableProjects={availableProjects}
                onOpenProjectDetails={vi.fn()}
            />,
        );

        await user.click(screen.getByRole('button', { name: 'Remove Alpha' }));

        expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
    });

    it('calls onOpenProjectDetails when the open-details button is clicked', async () => {
        const user = userEvent.setup();
        const onOpenProjectDetails = vi.fn();
        render(
            <ProjectAccessPanel
                assignedProjects={assignedProjects}
                availableProjects={availableProjects}
                onOpenProjectDetails={onOpenProjectDetails}
            />,
        );

        await user.click(
            screen.getByRole('button', { name: 'Open Alpha project details' }),
        );

        expect(onOpenProjectDetails).toHaveBeenCalledWith('proj-1');
    });
});
