import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { MemoryRouter } from 'react-router-dom';
import { ProjectAccessPanel } from '../../../src/features/admin/components/ProjectAccessPanel';
import type { ProjectSummary } from '../../../src/features/admin/types';

const assignedProjects: ProjectSummary[] = [
    { id: 'p1', name: 'SprintStart' }
];

const availableProjects: ProjectSummary[] = [
    { id: 'p1', name: 'SprintStart' },
    { id: 'p2', name: 'Backend' },
    { id: 'p3', name: 'AI Service' }
];

describe('ProjectAccessPanel Accessibility', () => {
    it('should not have any a11y violations', async () => {
        const { baseElement } = render(
            <MemoryRouter>
                <main>
                    <ProjectAccessPanel
                        assignedProjects={assignedProjects}
                        availableProjects={availableProjects}
                        onOpenProjectDetails={vi.fn()}
                        onAssignProject={vi.fn().mockResolvedValue(undefined)}
                        onRemoveProject={vi.fn().mockResolvedValue(undefined)}
                    />
                </main>
            </MemoryRouter>
        );

        expect(screen.getByRole('button', { name: /Add project/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Open SprintStart project details' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Remove SprintStart' })).toBeInTheDocument();

        expect(await axe(baseElement)).toHaveNoViolations();
    });
});
