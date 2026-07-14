import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GitBranch } from 'lucide-react';
import { ArtifactTable } from '../../../../../src/features/data-ingestion/components/ArtifactTable';
import type { DataSource, IngestionRun } from '../../../../../src/features/data-ingestion/types';

function createMockSource(overrides: Partial<DataSource> = {}): DataSource {
    return {
        sourceSystem: 'GITHUB',
        name: 'GitHub Repository',
        type: 'GitHub',
        icon: GitBranch,
        status: 'connected',
        statusLabel: 'Synced',
        artifacts: 10,
        lastSync: '2026-07-05',
        errors: 0,
        latestIngestedCount: 10,
        latestUpdatedCount: 3,
        lastRunAt: '2026-07-05T10:00:00Z',
        failedItems: [],
        description: 'Indexes repositories.',
        ...overrides,
    };
}

function createMockRun(overrides: Partial<IngestionRun> = {}): IngestionRun {
    return {
        runId: 'run-1',
        sourceSystem: 'GITHUB',
        startedAt: '2026-07-05T10:00:00Z',
        finishedAt: '2026-07-05T10:05:00Z',
        ingestedCount: 10,
        updatedCount: 3,
        failedCount: 0,
        status: 'COMPLETED',
        failedItems: [],
        ...overrides,
    };
}

describe('ArtifactTable', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the summary cards with aggregated values', () => {
        const sources: DataSource[] = [
            createMockSource({ latestIngestedCount: 20, latestUpdatedCount: 5, errors: 1 }),
            createMockSource({ latestIngestedCount: 10, latestUpdatedCount: 2, errors: 4 }),
        ];
        const runs: IngestionRun[] = [];

        render(<ArtifactTable sources={sources} runs={runs} />);

        expect(screen.getByText('Latest Ingested')).toBeInTheDocument();
        expect(screen.getByText('30')).toBeInTheDocument();
        expect(screen.getByText('Latest Updated')).toBeInTheDocument();
        expect(screen.getByText('7')).toBeInTheDocument();
        expect(screen.getByText('Failed Artifacts')).toBeInTheDocument();
        expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('renders run activity entries with source label and run id', () => {
        const sources: DataSource[] = [];
        const runs: IngestionRun[] = [
            createMockRun({ runId: 'run-abc', sourceSystem: 'GITHUB' }),
        ];

        render(<ArtifactTable sources={sources} runs={runs} />);

        expect(screen.getByText('Recent Artifact Activity')).toBeInTheDocument();
        expect(screen.getByText('GitHub')).toBeInTheDocument();
        expect(screen.getByText('run-abc')).toBeInTheDocument();
    });

    it('renders count pills for each run', () => {
        const sources: DataSource[] = [];
        const runs: IngestionRun[] = [
            createMockRun({ ingestedCount: 15, updatedCount: 8, failedCount: 2 }),
        ];

        render(<ArtifactTable sources={sources} runs={runs} />);

        expect(screen.getByText('Ingested: 15')).toBeInTheDocument();
        expect(screen.getByText('Updated: 8')).toBeInTheDocument();
        expect(screen.getByText('Failed: 2')).toBeInTheDocument();
    });

    it('shows the No failures badge for a completed run with zero failures', () => {
        const sources: DataSource[] = [];
        const runs: IngestionRun[] = [
            createMockRun({ failedCount: 0, status: 'COMPLETED' }),
        ];

        render(<ArtifactTable sources={sources} runs={runs} />);

        expect(screen.getByText('No failures')).toBeInTheDocument();
    });

    it('shows the Needs review badge for a run with failures', () => {
        const sources: DataSource[] = [];
        const runs: IngestionRun[] = [
            createMockRun({ failedCount: 3, status: 'COMPLETED' }),
        ];

        render(<ArtifactTable sources={sources} runs={runs} />);

        expect(screen.getByText('Needs review')).toBeInTheDocument();
    });

    it('renders failed artifact details from source failed items', () => {
        const sources: DataSource[] = [
            createMockSource({
                sourceSystem: 'GITHUB',
                failedItems: [
                    { artifactIdentifier: 'FILE: broken.md', reason: 'Parse error' },
                ],
                lastRunAt: '2026-07-05T10:00:00Z',
            }),
        ];
        const runs: IngestionRun[] = [];

        render(<ArtifactTable sources={sources} runs={runs} />);

        expect(screen.getByText('Failed Artifact Details')).toBeInTheDocument();
        expect(screen.getByText('FILE: broken.md')).toBeInTheDocument();
        expect(screen.getByText('Parse error')).toBeInTheDocument();
    });

    it('renders failed artifact details from run failed items', () => {
        const sources: DataSource[] = [];
        const runs: IngestionRun[] = [
            createMockRun({
                failedItems: [
                    { artifactIdentifier: 'ISSUE: 42', reason: 'Connection refused' },
                ],
                failedCount: 1,
            }),
        ];

        render(<ArtifactTable sources={sources} runs={runs} />);

        expect(screen.getByText('ISSUE: 42')).toBeInTheDocument();
        expect(screen.getByText('Connection refused')).toBeInTheDocument();
    });

    it('renders an empty state when no runs are present', () => {
        const sources: DataSource[] = [];
        const runs: IngestionRun[] = [];

        render(<ArtifactTable sources={sources} runs={runs} />);

        expect(
            screen.getByText('No ingestion run activity has been returned yet.'),
        ).toBeInTheDocument();
    });

    it('renders an empty state for failed artifacts when none are reported', () => {
        const sources: DataSource[] = [createMockSource({ failedItems: [] })];
        const runs: IngestionRun[] = [createMockRun({ failedItems: [] })];

        render(<ArtifactTable sources={sources} runs={runs} />);

        expect(
            screen.getByText(
                'No failed artifacts reported in the latest source statuses or recent runs.',
            ),
        ).toBeInTheDocument();
    });

    it('renders an open source link for http artifact identifiers', () => {
        const sources: DataSource[] = [
            createMockSource({
                failedItems: [
                    {
                        artifactIdentifier: 'https://github.com/acme/repo/pull/1',
                        reason: 'Merge conflict',
                    },
                ],
            }),
        ];
        const runs: IngestionRun[] = [];

        render(<ArtifactTable sources={sources} runs={runs} />);

        const link = screen.getByText('Open source').closest('a');
        expect(link).toHaveAttribute('href', 'https://github.com/acme/repo/pull/1');
    });
});
