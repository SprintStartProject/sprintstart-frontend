import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { MemoryRouter } from 'react-router-dom';
import { SourceDetailsPanel } from '../../../src/features/data-ingestion/components/SourceDetailsPanel';
import type { SourceDetailsSource } from '../../../src/features/data-ingestion/types';

vi.mock('../../../src/services/ingestionService', () => ({
    getIngestionRuns: vi.fn().mockResolvedValue([]),
    getIngestionStatus: vi.fn().mockResolvedValue([])
}));

const source: SourceDetailsSource = {
    sourceSystem: 'GITHUB',
    name: 'GitHub Repository',
    type: 'GitHub',
    status: 'connected',
    artifacts: 42,
    lastSync: '2026-07-01',
    errors: 0,
    latestIngestedCount: 10,
    latestUpdatedCount: 5,
    failedItems: [],
    description: 'Indexes repositories.'
};

describe('SourceDetailsPanel Accessibility', () => {
    it('should not have any a11y violations', async () => {
        const { baseElement } = render(
            <MemoryRouter>
                <SourceDetailsPanel
                    source={source}
                    onClose={vi.fn()}
                />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('GitHub Repository')).toBeInTheDocument();
        });

        expect(await axe(baseElement)).toHaveNoViolations();
    });
});
