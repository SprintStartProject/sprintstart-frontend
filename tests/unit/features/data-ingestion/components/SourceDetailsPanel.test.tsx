import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GitBranch } from 'lucide-react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SourceDetailsPanel } from '../../../../../src/features/data-ingestion/components/SourceDetailsPanel';
import type { DataSource, GithubRepositoryDetails } from '../../../../../src/features/data-ingestion/types';

const githubRepository: GithubRepositoryDetails = {
    owner: 'acme',
    name: 'monorepo',
    repositoryId: 'repo-1',
    fullName: 'acme/monorepo',
    url: 'https://github.com/acme/monorepo',
    enabled: true,
};

const mockSource: DataSource = {
    sourceId: 'source-github',
    sourceSystem: 'GITHUB',
    name: 'GitHub Repository',
    type: 'GitHub',
    icon: GitBranch,
    status: 'connected',
    statusLabel: 'Connected',
    ingestionStatus: 'connected',
    ingestionStatusLabel: 'Synced',
    artifacts: 10,
    lastSync: '2026-07-05',
    errors: 0,
    latestIngestedCount: 10,
    latestUpdatedCount: 3,
    totalArtifactCount: 10,
    runIds: ['run-1'],
    sharesSourceSystem: false,
    lastRunAt: '2026-07-05T10:00:00Z',
    failedItems: [],
    githubRepository,
    description: 'Indexes repositories.',
};

describe('SourceDetailsPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders repository and ingestion details', () => {
        render(<SourceDetailsPanel source={mockSource} onClose={vi.fn()} />);

        expect(screen.getByText('GitHub Repository')).toBeInTheDocument();
        expect(screen.getByText('Repository')).toBeInTheDocument();
        expect(screen.getByText('acme/monorepo')).toBeInTheDocument();
        expect(screen.getByText('Ingestion')).toBeInTheDocument();
        expect(screen.getByText('10')).toBeInTheDocument();
    });

    it('calls onUpdateSource with the selected source', async () => {
        const user = userEvent.setup();
        const onUpdateSource = vi.fn().mockResolvedValue(undefined);

        render(
            <SourceDetailsPanel
                source={mockSource}
                onUpdateSource={onUpdateSource}
                onClose={vi.fn()}
            />,
        );

        await user.click(screen.getByRole('button', { name: /Update repo/ }));

        expect(onUpdateSource).toHaveBeenCalledWith(mockSource);
        await waitFor(() => {
            expect(
                screen.getByText(
                    'Repository update started. Details will refresh while ingestion runs.',
                ),
            ).toBeInTheDocument();
        });
    });

    it('calls onRefreshDetails when the refresh button is clicked', async () => {
        const user = userEvent.setup();
        const onRefreshDetails = vi.fn().mockResolvedValue(undefined);

        render(
            <SourceDetailsPanel
                source={mockSource}
                onRefreshDetails={onRefreshDetails}
                onClose={vi.fn()}
            />,
        );

        await user.click(
            screen.getByRole('button', { name: /Refresh details/ }),
        );

        expect(onRefreshDetails).toHaveBeenCalledTimes(1);
        await waitFor(() => {
            expect(screen.getByText('Repository details refreshed.')).toBeInTheDocument();
        });
    });

    it('disables repository updates when repository details are unavailable', () => {
        render(
            <SourceDetailsPanel
                source={{ ...mockSource, githubRepository: null }}
                onUpdateSource={vi.fn().mockResolvedValue(undefined)}
                onClose={vi.fn()}
            />,
        );

        expect(screen.getByRole('button', { name: /Update repo/ })).toBeDisabled();
    });

    it('renders failed items from the source', () => {
        render(
            <SourceDetailsPanel
                source={{
                    ...mockSource,
                    errors: 1,
                    failedItems: [
                        {
                            artifactIdentifier: 'FILE: broken.md',
                            reason: 'Parse error',
                        },
                    ],
                }}
                onClose={vi.fn()}
            />,
        );

        expect(screen.getByText('Failed Items')).toBeInTheDocument();
        expect(screen.getByText('FILE: broken.md')).toBeInTheDocument();
        expect(screen.getByText('Parse error')).toBeInTheDocument();
    });
});
