import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { MemoryRouter } from 'react-router-dom';
import { DataIngestionPage } from '../../../src/pages/DataIngestionPage';

vi.mock('../../../src/context/useAuth', () => ({
    useAuth: () => ({ profile: { id: 'user1', firstName: 'Test', lastName: 'User' } }),
}));

vi.mock('../../../src/services/ingestionService', () => ({
    getIngestionRuns: vi.fn().mockResolvedValue([]),
    getIngestionStatus: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../src/services/sources/githubService', () => ({
    connectGithubRepository: vi.fn().mockResolvedValue({ transactionId: 'tx1' }),
    getGithubPatNames: vi.fn().mockResolvedValue(['token1']),
    updateAllGithubRepositories: vi.fn().mockResolvedValue({ transactionId: 'tx2' }),
    updateGithubRepository: vi.fn().mockResolvedValue({ transactionId: 'tx3' }),
}));

vi.mock('../../../src/features/data-ingestion/components/DataIngestionHeader', () => ({
    DataIngestionHeader: () => <header><h1>Data Ingestion</h1></header>,
}));

vi.mock('../../../src/features/data-ingestion/components/IngestionMetrics', () => ({
    IngestionMetrics: () => <section aria-label="Ingestion metrics"><h2>Metrics</h2></section>,
}));

vi.mock('../../../src/features/data-ingestion/components/SourceList', () => ({
    SourceList: () => <div>No sources connected yet.</div>,
}));

vi.mock('../../../src/features/data-ingestion/components/ArtifactTable', () => ({
    ArtifactTable: () => <div>No artifacts.</div>,
}));

vi.mock('../../../src/features/data-ingestion/components/RunHistory', () => ({
    RunHistory: () => <div>No runs.</div>,
}));

describe('DataIngestionPage Accessibility', () => {
    it('should not have any a11y violations', async () => {
        const { baseElement } = render(
            <MemoryRouter><DataIngestionPage /></MemoryRouter>,
        );

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'sources' })).toBeInTheDocument();
        });

        expect(await axe(baseElement)).toHaveNoViolations();
    });
});
