import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { MemoryRouter } from 'react-router-dom';
import { ProjectsTab } from '../../../src/features/admin/components/ProjectsTab';
import type { ProjectOverview } from '../../../src/features/admin/types';

const projects: ProjectOverview[] = [
    {
        id: 'p1',
        name: 'SprintStart',
        description: 'Main application',
        sources: [
            { id: 's1', name: 'GitHub', type: 'GITHUB', status: 'CONNECTED' },
            { id: 's2', name: 'Jira', type: 'JIRA', status: 'CONNECTED' }
        ],
        users: [
            { id: 'u1', username: 'asmith', email: 'alice@example.com', projectRoles: ['MEMBER'] }
        ]
    },
    {
        id: 'p2',
        name: 'Backend',
        description: '',
        sources: [],
        users: []
    }
];

describe('ProjectsTab Accessibility', () => {
    it('should not have any a11y violations', async () => {
        const { baseElement } = render(
            <MemoryRouter>
                <main>
                    <ProjectsTab
                        filteredProjects={projects}
                        onOpenProjectDetails={vi.fn()}
                    />
                </main>
            </MemoryRouter>
        );

        expect(screen.getByRole('button', { name: 'Open details for SprintStart' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Open details for Backend' })).toBeInTheDocument();

        expect(await axe(baseElement)).toHaveNoViolations();
    });
});
