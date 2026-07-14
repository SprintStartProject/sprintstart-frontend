import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RunHistory } from '../../../../../src/features/data-ingestion/components/RunHistory';
import type { IngestionRun } from '../../../../../src/features/data-ingestion/types';

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

describe('RunHistory', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the empty state when no runs are provided', () => {
        render(<RunHistory runs={[]} />);

        expect(screen.getByText('No ingestion runs found')).toBeInTheDocument();
        expect(
            screen.getByText(
                'The backend did not return any ingestion runs yet.',
            ),
        ).toBeInTheDocument();
    });

    it('renders the table header row on desktop view', () => {
        const runs: IngestionRun[] = [createMockRun()];

        render(<RunHistory runs={runs} />);

        expect(screen.getByText('Source')).toBeInTheDocument();
        expect(screen.getByText('Status')).toBeInTheDocument();
        expect(screen.getAllByText('Started').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Finished').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Counts').length).toBeGreaterThan(0);
    });

    it('renders the source label and run id for each run', () => {
        const runs: IngestionRun[] = [
            createMockRun({ runId: 'run-alpha', sourceSystem: 'GITHUB' }),
            createMockRun({ runId: 'run-beta', sourceSystem: 'JIRA' }),
        ];

        render(<RunHistory runs={runs} />);

        expect(screen.getByText('run-alpha')).toBeInTheDocument();
        expect(screen.getByText('run-beta')).toBeInTheDocument();
        expect(screen.getAllByText('GitHub').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Jira').length).toBeGreaterThan(0);
    });

    it('renders a Success status badge for a completed run', () => {
        const runs: IngestionRun[] = [
            createMockRun({ status: 'COMPLETED' }),
        ];

        render(<RunHistory runs={runs} />);

        expect(screen.getByText('Success')).toBeInTheDocument();
    });

    it('renders a Running status badge for an in-progress run', () => {
        const runs: IngestionRun[] = [
            createMockRun({ status: 'RUNNING', finishedAt: null }),
        ];

        render(<RunHistory runs={runs} />);

        expect(screen.getByText('Running')).toBeInTheDocument();
    });

    it('renders a Failed status badge for a failed run', () => {
        const runs: IngestionRun[] = [
            createMockRun({ status: 'FAILED' }),
        ];

        render(<RunHistory runs={runs} />);

        expect(screen.getByText('Failed')).toBeInTheDocument();
    });

    it('renders a Partial status badge for a partial run', () => {
        const runs: IngestionRun[] = [
            createMockRun({ status: 'PARTIAL' }),
        ];

        render(<RunHistory runs={runs} />);

        expect(screen.getByText('Partial')).toBeInTheDocument();
    });

    it('renders count pills with ingested, updated, and failed values', () => {
        const runs: IngestionRun[] = [
            createMockRun({ ingestedCount: 25, updatedCount: 10, failedCount: 4 }),
        ];

        render(<RunHistory runs={runs} />);

        expect(screen.getByText('Ingested: 25')).toBeInTheDocument();
        expect(screen.getByText('Updated: 10')).toBeInTheDocument();
        expect(screen.getByText('Failed: 4')).toBeInTheDocument();
    });

    it('renders the finished timestamp for a completed run', () => {
        const runs: IngestionRun[] = [
            createMockRun({
                finishedAt: '2026-07-05T10:05:00Z',
                status: 'COMPLETED',
            }),
        ];

        render(<RunHistory runs={runs} />);

        expect(screen.getAllByText(/2026/).length).toBeGreaterThan(0);
    });

    it('renders In progress for a running run with no finishedAt', () => {
        const runs: IngestionRun[] = [
            createMockRun({ finishedAt: null, status: 'RUNNING' }),
        ];

        render(<RunHistory runs={runs} />);

        expect(screen.getByText('In progress')).toBeInTheDocument();
    });
});
