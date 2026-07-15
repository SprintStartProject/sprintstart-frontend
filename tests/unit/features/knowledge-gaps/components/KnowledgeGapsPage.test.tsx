import { render, screen } from '@testing-library/react';
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

    it('expands the filter panel when clicked', async () => {
        const user = userEvent.setup();
        renderPage();

        const filterButton = screen.getByText('Filters & Sort');
        await user.click(filterButton);

        expect(screen.getByText('Severity Filter')).toBeInTheDocument();
        expect(screen.getByText('Sort By')).toBeInTheDocument();
    });

    it('filters gaps by severity when a filter is toggled off', async () => {
        const user = userEvent.setup();
        renderPage();

        await user.click(screen.getByText('Filters & Sort'));
        const highFilter = screen.getAllByRole('button', { name: /High/ }).find(
            (btn) => btn.textContent?.includes('High') && btn.textContent?.includes('✓'),
        )!;
        await user.click(highFilter);

        expect(screen.queryByText('Auth Service')).not.toBeInTheDocument();
        expect(screen.getByText('API Gateway')).toBeInTheDocument();
    });

    it('changes the sort order when a sort option is clicked', async () => {
        const user = userEvent.setup();
        renderPage();

        await user.click(screen.getByText('Filters & Sort'));
        const componentSort = screen.getByText('Component Name');
        await user.click(componentSort);

        const buttons = screen.getAllByRole('button');
        const componentButton = buttons.find((b) => b.textContent === 'Component Name');
        expect(componentButton).toHaveClass('bg-app-brand');
    });

    it('shows the reset button when filters are not default', async () => {
        const user = userEvent.setup();
        renderPage();

        await user.click(screen.getByText('Filters & Sort'));
        const highFilter = screen.getAllByRole('button', { name: /High/ }).find(
            (btn) => btn.textContent?.includes('High') && btn.textContent?.includes('✓'),
        )!;
        await user.click(highFilter);

        expect(screen.getByText('Reset filters')).toBeInTheDocument();
    });
});
