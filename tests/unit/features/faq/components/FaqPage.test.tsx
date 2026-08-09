import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FaqPage } from '../../../../../src/features/faq/components/FaqPage';
import type { FAQOverview } from '../../../../../src/features/faq/types';
import { MemoryRouter } from 'react-router-dom';

const mockOverview: FAQOverview = {
    groups: [
        { groupId: 'g1', count: 10, question: 'How to deploy?', topDocuments: [{ id: 'd1', title: 'Deploy Guide' }] },
        { groupId: 'g2', count: 5, question: 'What is X?', topDocuments: [{ id: 'd2', title: 'X Doc' }] },
    ],
};

vi.mock('../../../../../src/hooks/useFetch', () => ({
    useFetch: vi.fn(),
}));

vi.mock('../../../../../src/services/faqService', () => ({
    insightsService: { fetchFAQGroups: vi.fn() },
}));

import { useFetch } from '../../../../../src/hooks/useFetch';

vi.mocked(useFetch).mockReturnValue({ data: mockOverview, loading: false, error: false });

function renderPage() {
    return render(
        <MemoryRouter>
            <FaqPage />
        </MemoryRouter>,
    );
}

describe('FaqPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(useFetch).mockReturnValue({ data: mockOverview, loading: false, error: false });
    });

    it('renders the page title and header', () => {
        renderPage();
        expect(screen.getByText('Recurring Questions')).toBeInTheDocument();
    });

    it('renders the statistics header with group and question counts', () => {
        renderPage();
        expect(screen.getByText('Question groups')).toBeInTheDocument();
        expect(screen.getByText('Total questions')).toBeInTheDocument();
    });

    it('renders the hero card', () => {
        renderPage();
        expect(screen.getByText('How to deploy?')).toBeInTheDocument();
    });

    it('renders the remaining groups as list items', () => {
        renderPage();
        expect(screen.getByText('What is X?')).toBeInTheDocument();
    });

    it('shows loading state', () => {
        vi.mocked(useFetch).mockReturnValueOnce({ data: null, loading: true, error: false });
        const { container } = renderPage();
        expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('shows the empty/refresh state on error', () => {
        vi.mocked(useFetch).mockReturnValueOnce({ data: null, loading: false, error: true });
        renderPage();
        expect(
            screen.getByText('No FAQ groups yet. Trigger a refresh to generate them.'),
        ).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
    });

    it('shows the empty/refresh state when there are no groups', () => {
        vi.mocked(useFetch).mockReturnValueOnce({ data: { groups: [] }, loading: false, error: false });
        renderPage();
        expect(
            screen.getByText('No FAQ groups yet. Trigger a refresh to generate them.'),
        ).toBeInTheDocument();
    });
});

// These components read the selected project to scope their requests; the hook
// throws outside a ProjectProvider, so it is stubbed rather than provider-wrapped.
vi.mock('../../../../../src/features/projects/useProjectContext', async () => {
    const { createProjectContextValue, createSelectableProject } = await import('../../../setup/projectContext');
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

