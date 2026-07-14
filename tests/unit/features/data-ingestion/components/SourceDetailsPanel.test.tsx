import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as ingestionService from '../../../../../src/services/ingestionService';
import { SourceDetailsPanel } from '../../../../../src/features/data-ingestion/components/SourceDetailsPanel';
import type {
    GithubRepositoryReference,
    IngestionRun,
    SourceDetailsSource,
    SourceIngestionStatus,
} from '../../../../../src/features/data-ingestion/types';

vi.mock('../../../../../src/services/ingestionService', () => ({
    getIngestionRuns: vi.fn(),
    getIngestionStatus: vi.fn(),
}));

const mockSource: SourceDetailsSource = {
    sourceSystem: 'GITHUB',
    name: 'GitHub Repository',
    type: 'GitHub',
    status: 'connected',
    artifacts: 10,
    lastSync: '2026-07-05',
    errors: 0,
    latestIngestedCount: 10,
    latestUpdatedCount: 3,
    failedItems: [],
};

const mockStatus: SourceIngestionStatus = {
    sourceSystem: 'GITHUB',
    lastRunTime: '2026-07-05T10:00:00Z',
    ingestedCount: 12,
    updatedCount: 3,
    failedCount: 0,
    status: 'COMPLETED',
    failedItems: [],
};

const mockRun: IngestionRun = {
    runId: 'run-1',
    sourceSystem: 'GITHUB',
    startedAt: '2026-07-05T10:00:00Z',
    finishedAt: '2026-07-05T10:05:00Z',
    ingestedCount: 12,
    updatedCount: 3,
    failedCount: 0,
    status: 'COMPLETED',
    failedItems: [],
};

function setupMocks(
    status: SourceIngestionStatus[] = [mockStatus],
    runs: IngestionRun[] = [mockRun],
) {
    vi.mocked(ingestionService.getIngestionStatus).mockResolvedValue(status);
    vi.mocked(ingestionService.getIngestionRuns).mockResolvedValue(runs);
}

describe('SourceDetailsPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupMocks();
    });

    it('fetches status and runs on mount and renders source details', async () => {
        render(
            <SourceDetailsPanel source={mockSource} onClose={vi.fn()} />,
        );

        expect(ingestionService.getIngestionStatus).toHaveBeenCalledTimes(1);
        expect(ingestionService.getIngestionRuns).toHaveBeenCalledWith(10);

        await waitFor(() => {
            expect(screen.getByText('Source System')).toBeInTheDocument();
        });
        expect(screen.getByText('GITHUB')).toBeInTheDocument();
        expect(screen.getAllByText('Recent Runs').length).toBeGreaterThan(0);
    });

    it('derives the latest status label from the fetched status', async () => {
        render(
            <SourceDetailsPanel source={mockSource} onClose={vi.fn()} />,
        );

        await waitFor(() => {
            expect(screen.getByText('Synced')).toBeInTheDocument();
        });
    });

    it('renders recent runs in the panel', async () => {
        render(
            <SourceDetailsPanel source={mockSource} onClose={vi.fn()} />,
        );

        await waitFor(() => {
            expect(screen.getByText('run-1')).toBeInTheDocument();
        });
    });

    it('renders the Update GitHub button when onUpdateSource is provided for a GITHUB source', async () => {
        render(
            <SourceDetailsPanel
                source={mockSource}
                onUpdateSource={vi.fn().mockResolvedValue(undefined)}
                onClose={vi.fn()}
            />,
        );

        await waitFor(() => {
            expect(
                screen.getByRole('button', { name: /Update GitHub/ }),
            ).toBeInTheDocument();
        });
    });

    it('shows the repository name in the Update button when githubRepository is provided', async () => {
        const githubRepository: GithubRepositoryReference = {
            owner: 'acme',
            name: 'monorepo',
        };

        render(
            <SourceDetailsPanel
                source={mockSource}
                githubRepository={githubRepository}
                onUpdateSource={vi.fn().mockResolvedValue(undefined)}
                onClose={vi.fn()}
            />,
        );

        await waitFor(() => {
            expect(
                screen.getByRole('button', { name: /Update acme\/monorepo/ }),
            ).toBeInTheDocument();
        });
    });

    it('calls onUpdateSource when the Update GitHub button is clicked', async () => {
        const user = userEvent.setup();
        const onUpdateSource = vi.fn().mockResolvedValue(undefined);

        render(
            <SourceDetailsPanel
                source={mockSource}
                onUpdateSource={onUpdateSource}
                onClose={vi.fn()}
            />,
        );

        await waitFor(() => {
            expect(
                screen.getByRole('button', { name: /Update GitHub/ }),
            ).toBeInTheDocument();
        });

        await user.click(screen.getByRole('button', { name: /Update GitHub/ }));

        expect(onUpdateSource).toHaveBeenCalledWith('GITHUB');
    });

    it('calls the service again when the Refresh Details button is clicked', async () => {
        const user = userEvent.setup();

        render(
            <SourceDetailsPanel source={mockSource} onClose={vi.fn()} />,
        );

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Refresh Details/ })).toBeInTheDocument();
        });

        expect(ingestionService.getIngestionStatus).toHaveBeenCalledTimes(1);

        await user.click(screen.getByRole('button', { name: /Refresh Details/ }));

        await waitFor(() => {
            expect(ingestionService.getIngestionStatus).toHaveBeenCalledTimes(2);
        });
    });

    it('does not render the Update button when onUpdateSource is omitted', async () => {
        render(
            <SourceDetailsPanel source={mockSource} onClose={vi.fn()} />,
        );

        await waitFor(() => {
            expect(screen.getByText('GITHUB')).toBeInTheDocument();
        });

        expect(screen.queryByRole('button', { name: /Update/ })).not.toBeInTheDocument();
    });

    it('shows an error message when the service fetch fails', async () => {
        vi.mocked(ingestionService.getIngestionStatus).mockRejectedValue(
            new Error('Network failure'),
        );

        render(
            <SourceDetailsPanel source={mockSource} onClose={vi.fn()} />,
        );

        await waitFor(() => {
            expect(screen.getByText('Network failure')).toBeInTheDocument();
        });
    });

    it('renders failed items from the latest run', async () => {
        const failedRun: IngestionRun = {
            ...mockRun,
            failedItems: [
                { artifactIdentifier: 'FILE: broken.md', reason: 'Parse error' },
            ],
            failedCount: 1,
        };
        setupMocks([mockStatus], [failedRun]);

        render(
            <SourceDetailsPanel source={mockSource} onClose={vi.fn()} />,
        );

        await waitFor(() => {
            expect(screen.getByText('FILE: broken.md')).toBeInTheDocument();
        });
        expect(screen.getByText('Parse error')).toBeInTheDocument();
    });
});
