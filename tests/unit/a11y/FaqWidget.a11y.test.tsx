import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { MemoryRouter } from 'react-router-dom';
import { FaqWidget } from '../../../src/features/faq/components/FaqWidget';

vi.mock('../../../src/hooks/useFetch', () => ({
    useFetch: () => ({
        data: {
            groups: [
                {
                    groupId: 'g1',
                    count: 5,
                    question: 'How do I reset my password?',
                    topDocuments: [{ id: 'd1', title: 'Password Guide' }]
                },
                {
                    groupId: 'g2',
                    count: 3,
                    question: 'How do I invite a teammate?',
                    topDocuments: [{ id: 'd2', title: 'Team Guide' }]
                }
            ]
        },
        loading: false,
        error: false
    })
}));

vi.mock('../../../src/services/faqService', () => ({
    insightsService: {
        fetchFAQGroups: vi.fn()
    }
}));

describe('FaqWidget Accessibility', () => {
    it('should not have any a11y violations', async () => {
        const { baseElement } = render(
            <MemoryRouter>
                <main>
                    <FaqWidget />
                </main>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('How do I reset my password?')).toBeInTheDocument();
        });

        expect(await axe(baseElement)).toHaveNoViolations();
    });
});

// These components read the selected project to scope their requests; the hook
// throws outside a ProjectProvider, so it is stubbed rather than provider-wrapped.
vi.mock('../../../src/features/projects/useProjectContext', async () => {
    const { createProjectContextValue, createSelectableProject } = await import('../setup/projectContext');
    const project = createSelectableProject({ id: 'proj1' });
    return {
        useProjectContext: () =>
            createProjectContextValue({
                projects: [project],
                selectedProject: project,
                selectedProjectId: 'proj1',
            }),
    };
});

