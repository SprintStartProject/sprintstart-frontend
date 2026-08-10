import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RunDetailsPanel } from '../../../../../src/features/data-ingestion/components/RunDetailsPanel';
import type { IngestionRun } from '../../../../../src/features/data-ingestion/types';

function makeRun(overrides: Partial<IngestionRun> = {}): IngestionRun {
    return {
        runId: 'run-1',
        sourceSystem: 'GITHUB',
        sourceId: null,
        owner: null,
        name: null,
        repositoryId: null,
        startedAt: '2026-07-05T10:00:00Z',
        finishedAt: '2026-07-05T10:03:12Z',
        ingestedCount: 543,
        updatedCount: 10,
        deletedCount: 0,
        failedCount: 3,
        status: 'PARTIAL',
        failedItems: [{ artifactIdentifier: 'FILE: broken.md', reason: 'Parse error' }],
        failureReason: null,
        aiSyncStatus: 'SUCCEEDED',
        aiSyncFailureReason: null,
        ...overrides,
    };
}

describe('RunDetailsPanel', () => {
    it('shows the result tiles and the pipeline stages', () => {
        render(<RunDetailsPanel run={makeRun()} onClose={vi.fn()} />);

        expect(screen.getByText('Run · GitHub')).toBeInTheDocument();
        expect(screen.getByText('Ingested')).toBeInTheDocument();
        expect(screen.getByText('543')).toBeInTheDocument();
        expect(screen.getByText('Failed')).toBeInTheDocument();

        expect(screen.getByText('Fetched from GitHub')).toBeInTheDocument();
        expect(screen.getByText('Saved locally')).toBeInTheDocument();
        expect(screen.getByText('Indexed into AI')).toBeInTheDocument();
    });

    it('names the source system in the fetch stage for a Jira run', () => {
        render(
            <RunDetailsPanel
                run={makeRun({ sourceSystem: 'JIRA' })}
                sourceLabel="My Jira"
                onClose={vi.fn()}
            />,
        );

        expect(screen.getByText('Fetched from Jira')).toBeInTheDocument();
        expect(screen.queryByText('Fetched from GitHub')).not.toBeInTheDocument();
    });

    it('shows the GitHub owner in the timing section', () => {
        render(
            <RunDetailsPanel
                run={makeRun({ sourceSystem: 'GITHUB', sourceId: 'acme/widgets', owner: 'acme' })}
                onClose={vi.fn()}
            />,
        );

        expect(screen.getByText('Owner')).toBeInTheDocument();
        expect(screen.getByText('acme')).toBeInTheDocument();
    });

    it('derives the GitHub owner from the sourceId when owner is absent', () => {
        render(
            <RunDetailsPanel
                run={makeRun({ sourceSystem: 'GITHUB', sourceId: 'acme/widgets', owner: null })}
                onClose={vi.fn()}
            />,
        );

        expect(screen.getByText('Owner')).toBeInTheDocument();
        expect(screen.getByText('acme')).toBeInTheDocument();
    });

    it('shows the Jira instance domain in the timing section', () => {
        render(
            <RunDetailsPanel
                run={makeRun({ sourceSystem: 'JIRA', sourceId: 'https://acme.atlassian.net', owner: null })}
                sourceLabel="My Jira"
                onClose={vi.fn()}
            />,
        );

        expect(screen.getByText('Domain')).toBeInTheDocument();
        expect(screen.getByText('acme.atlassian.net')).toBeInTheDocument();
    });

    it('lists failed items', () => {
        render(<RunDetailsPanel run={makeRun()} onClose={vi.fn()} />);

        expect(screen.getByText('Failed items (1)')).toBeInTheDocument();
        expect(screen.getByText('FILE: broken.md')).toBeInTheDocument();
        expect(screen.getByText('Parse error')).toBeInTheDocument();
    });

    it('shows an in-progress index stage while running', () => {
        render(
            <RunDetailsPanel
                run={makeRun({ status: 'RUNNING', finishedAt: null, aiSyncStatus: 'PENDING', failedItems: [], failedCount: 0 })}
                onClose={vi.fn()}
            />,
        );

        expect(screen.getByText('Indexing into AI')).toBeInTheDocument();
        expect(screen.getByText('Running…')).toBeInTheDocument();
    });

    it('shows the deleted counter from the run', () => {
        render(<RunDetailsPanel run={makeRun({ deletedCount: 17 })} onClose={vi.fn()} />);

        expect(screen.getByText('Deleted')).toBeInTheDocument();
        expect(screen.getByText('17')).toBeInTheDocument();
    });

    it('surfaces a run-level failure reason as a banner and in the pipeline', () => {
        render(
            <RunDetailsPanel
                run={makeRun({ status: 'FAILED', failureReason: 'GitHub rate limit exceeded' })}
                onClose={vi.fn()}
            />,
        );

        expect(screen.getByText('This run failed')).toBeInTheDocument();
        expect(screen.getAllByText('GitHub rate limit exceeded').length).toBeGreaterThan(0);
    });

    it('omits the failure banner when the run has no run-level failure', () => {
        render(<RunDetailsPanel run={makeRun()} onClose={vi.fn()} />);

        expect(screen.queryByText('This run failed')).not.toBeInTheDocument();
    });

    it('closes when the close control is used', async () => {
        const onClose = vi.fn();
        render(<RunDetailsPanel run={makeRun()} onClose={onClose} />);

        const closeButtons = screen.getAllByRole('button', { name: /close run details/i });
        await userEvent.click(closeButtons[closeButtons.length - 1]);
        expect(onClose).toHaveBeenCalled();
    });
});
