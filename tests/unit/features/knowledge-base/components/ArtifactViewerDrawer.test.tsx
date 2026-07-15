import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ArtifactViewerDrawer } from '../../../../../src/features/knowledge-base/components/ArtifactViewerDrawer';
import { ApiError } from '../../../../../src/services/apiClient';
import type { Artifact, ArtifactSummaryCitation, SummaryStreamHandlers } from '../../../../../src/features/knowledge-base/types';

vi.mock('../../../../../src/services/knowledgeService', () => ({
    knowledgeService: {
        getArtifactContent: vi.fn().mockResolvedValue({
            content: '# Test content',
            mimeType: 'text/markdown',
        }),
        streamArtifactSummary: vi.fn(),
    },
}));

vi.mock('../../../../../src/components/ui/SidePanel', () => ({
    SidePanel: ({ isOpen, title, actions, children }: {
        isOpen: boolean;
        title: React.ReactNode;
        actions: React.ReactNode;
        children: React.ReactNode;
    }) =>
        isOpen ? (
            <div data-testid="side-panel">
                <div data-testid="panel-header">{title}</div>
                <div data-testid="panel-actions">{actions}</div>
                {children}
            </div>
        ) : null,
}));

function createArtifact(overrides: Partial<Artifact> = {}): Artifact {
    return {
        id: 'artifact-1',
        title: 'README.md',
        artifactType: 'FILE',
        sourceSystem: 'GITHUB',
        sourceId: 'src-1',
        sourceUrl: null,
        mime: 'text/markdown',
        language: 'Markdown',
        ingestedAt: '2026-01-01T00:00:00Z',
        createdAtSource: null,
        updatedAtSource: null,
        contentHash: 'hash123',
        ingestionRunId: null,
        ...overrides,
    };
}

function renderDrawer(artifact: Artifact | null = createArtifact()) {
    return render(
        <ArtifactViewerDrawer
            artifact={artifact}
            onClose={() => {}}
            projectId="proj-1"
        />,
    );
}

/**
 * Builds a streamArtifactSummary implementation that resolves the stream immediately
 * by invoking the captured handlers with the given token/citations/done sequence.
 */
function streamingSuccess(summary: string, citations: ArtifactSummaryCitation[] = []) {
    return (_projectId: string, _artifactId: string, handlers: SummaryStreamHandlers) => {
        handlers.onToken(summary);
        for (const citation of citations) {
            handlers.onCitation(citation);
        }
        handlers.onDone();
        return Promise.resolve();
    };
}

describe('ArtifactViewerDrawer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();
    });

    it('shows a spinner while fetching the summary', async () => {
        const { knowledgeService } = await import('../../../../../src/services/knowledgeService');
        vi.mocked(knowledgeService.streamArtifactSummary).mockReturnValue(new Promise(() => {}));

        renderDrawer();
        const summariseBtn = await screen.findByTestId('summarise-btn');
        await userEvent.click(summariseBtn);

        expect(screen.getByText('Generating summary...')).toBeInTheDocument();
    });

    it('renders the streamed summary markdown and citations on success', async () => {
        const { knowledgeService } = await import('../../../../../src/services/knowledgeService');
        vi.mocked(knowledgeService.streamArtifactSummary).mockImplementation(streamingSuccess(
            '## Key points\nThis is the summary.',
            [{ artifactId: 'artifact-1', filename: 'README.md', sourceUrl: 'https://github.com/owner/repo/blob/main/README.md' }],
        ));

        renderDrawer();
        const summariseBtn = await screen.findByTestId('summarise-btn');
        await userEvent.click(summariseBtn);

        expect(await screen.findByTestId('summary-content')).toBeInTheDocument();
        expect(screen.getByText('Key points')).toBeInTheDocument();
        expect(screen.getByTestId('summary-citations')).toBeInTheDocument();
        expect(screen.getByText('README.md')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'README.md' })).toHaveAttribute('href', 'https://github.com/owner/repo/blob/main/README.md');
    });

    it('shows "Preparing summary..." and retries on 503, then succeeds', async () => {
        const { knowledgeService } = await import('../../../../../src/services/knowledgeService');
        vi.mocked(knowledgeService.streamArtifactSummary)
            .mockRejectedValueOnce(new ApiError(503, 'Service Unavailable'))
            .mockImplementationOnce(streamingSuccess('## Summary after retry'));

        renderDrawer();
        const summariseBtn = await screen.findByTestId('summarise-btn');
        await userEvent.click(summariseBtn);

        expect(await screen.findByText('Preparing summary...', {}, { timeout: 5000 })).toBeInTheDocument();
        expect(await screen.findByText('Summary after retry', {}, { timeout: 10000 })).toBeInTheDocument();
        expect(knowledgeService.streamArtifactSummary).toHaveBeenCalledTimes(2);
    });

    it('shows error with retry and back-to-file buttons on non-503 failure', async () => {
        const { knowledgeService } = await import('../../../../../src/services/knowledgeService');
        vi.mocked(knowledgeService.streamArtifactSummary).mockRejectedValue(new Error('Network failure'));

        renderDrawer();
        const summariseBtn = await screen.findByTestId('summarise-btn');
        await userEvent.click(summariseBtn);

        expect(await screen.findByTestId('retry-summary-btn', {}, { timeout: 5000 })).toBeInTheDocument();
        expect(await screen.findByText('Network failure', {}, { timeout: 5000 })).toBeInTheDocument();
        const backBtns = screen.getAllByText('Back to File');
        expect(backBtns.length).toBeGreaterThanOrEqual(1);
    });

    it('returns to raw view on Back to File', async () => {
        const { knowledgeService } = await import('../../../../../src/services/knowledgeService');
        vi.mocked(knowledgeService.streamArtifactSummary).mockImplementation(streamingSuccess('Summary text'));

        renderDrawer();
        const summariseBtn = await screen.findByTestId('summarise-btn');
        await userEvent.click(summariseBtn);

        const backBtn = await screen.findByTestId('back-to-file-btn');
        await userEvent.click(backBtn);

        expect(screen.getByTestId('raw-content')).toBeInTheDocument();
    });

    it('hides the Summarise button in summary view', async () => {
        const { knowledgeService } = await import('../../../../../src/services/knowledgeService');
        vi.mocked(knowledgeService.streamArtifactSummary).mockReturnValue(new Promise(() => {}));

        renderDrawer();
        const summariseBtn = await screen.findByTestId('summarise-btn');
        await userEvent.click(summariseBtn);

        expect(screen.queryByTestId('summarise-btn')).not.toBeInTheDocument();
    });

    it('aborts the in-flight stream when the drawer unmounts', async () => {
        const { knowledgeService } = await import('../../../../../src/services/knowledgeService');
        let capturedSignal: AbortSignal | undefined;
        vi.mocked(knowledgeService.streamArtifactSummary).mockImplementation(
            (_projectId, _id, _handlers, signal) => {
                capturedSignal = signal;
                return new Promise<void>(() => {});
            },
        );

        const { unmount } = renderDrawer();
        const summariseBtn = await screen.findByTestId('summarise-btn');
        await userEvent.click(summariseBtn);

        unmount();

        expect(capturedSignal?.aborted).toBe(true);
    });
});
