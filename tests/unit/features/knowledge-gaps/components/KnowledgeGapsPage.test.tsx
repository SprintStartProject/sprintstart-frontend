import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KnowledgeGapsPage } from '../../../../../src/features/knowledge-gaps/components/KnowledgeGapsPage';
import type { KnowledgeGapOverview } from '../../../../../src/features/knowledge-gaps/types';
import { MemoryRouter } from 'react-router-dom';

const mockOverview: KnowledgeGapOverview = {
    gaps: [
        { id: 'gap1', component: 'Auth Service', missingTypes: ['README'], lastIngested: new Date().toISOString(), refreshedAt: new Date().toISOString(), owners: [], severity: 'high' },
        { id: 'gap2', component: 'API Gateway', missingTypes: ['API Docs'], lastIngested: new Date().toISOString(), refreshedAt: new Date().toISOString(), owners: [], severity: 'medium' },
        { id: 'gap3', component: 'Database', missingTypes: ['Schema'], lastIngested: new Date().toISOString(), refreshedAt: new Date().toISOString(), owners: [], severity: 'low' },
    ],
};

vi.mock('../../../../../src/hooks/useFetch', () => ({
    useFetch: vi.fn(),
}));

vi.mock('../../../../../src/services/knowledgeGapService', () => ({
    knowledgeGapService: { fetchKnowledgeGaps: vi.fn() },
}));

import { useFetch } from '../../../../../src/hooks/useFetch';

vi.mocked(useFetch).mockReturnValue({ data: mockOverview, loading: false, error: false });

function renderPage() {
    return render(
        <MemoryRouter>
            <KnowledgeGapsPage />
        </MemoryRouter>,
    );
}

describe('KnowledgeGapsPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(useFetch).mockReturnValue({ data: mockOverview, loading: false, error: false });
    });

    it('renders the page title and gap cards', () => {
        renderPage();
        expect(screen.getByText('Knowledge Gaps')).toBeInTheDocument();
        expect(screen.getByText('Auth Service')).toBeInTheDocument();
        expect(screen.getByText('API Gateway')).toBeInTheDocument();
        expect(screen.getByText('Database')).toBeInTheDocument();
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
            screen.getByText('No knowledge gaps yet. Trigger a refresh to detect them.'),
        ).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
    });

    // The controls are no longer behind a disclosure -- they are always on the
    // page, so there is nothing to expand first.
    it('shows the severity toggles and the sort order without expanding anything', () => {
        renderPage();

        const severityGroup = within(
            screen.getByRole('group', { name: 'Filter gaps by severity' }),
        );

        expect(severityGroup.getByRole('button', { name: 'High' })).toHaveAttribute(
            'aria-pressed',
            'true',
        );
        expect(
            screen.getByRole('combobox', { name: 'Sort knowledge gaps' }),
        ).toHaveTextContent('Severity');
    });

    it('filters gaps by severity when a filter is toggled off', async () => {
        const user = userEvent.setup();
        renderPage();

        const highFilter = within(
            screen.getByRole('group', { name: 'Filter gaps by severity' }),
        ).getByRole('button', { name: 'High' });
        await user.click(highFilter);

        expect(highFilter).toHaveAttribute('aria-pressed', 'false');
        expect(screen.queryByText('Auth Service')).not.toBeInTheDocument();
        expect(screen.getByText('API Gateway')).toBeInTheDocument();
    });

    it('changes the sort order when a sort option is chosen', async () => {
        const user = userEvent.setup();
        renderPage();

        const sorter = screen.getByRole('combobox', { name: 'Sort knowledge gaps' });
        await user.click(sorter);
        await user.click(screen.getByRole('option', { name: 'Component name' }));

        expect(sorter).toHaveTextContent('Component name');
    });

    it('shows the reset button when filters are not default', async () => {
        const user = userEvent.setup();
        renderPage();

        expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument();

        await user.click(
            within(screen.getByRole('group', { name: 'Filter gaps by severity' })).getByRole(
                'button',
                { name: 'High' },
            ),
        );

        expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument();
    });
});
