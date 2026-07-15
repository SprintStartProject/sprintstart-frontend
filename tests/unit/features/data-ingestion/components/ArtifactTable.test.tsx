import { render, screen, waitFor } from '@testing-library/react';
import { GitBranch } from 'lucide-react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ArtifactTable } from '../../../../../src/features/data-ingestion/components/ArtifactTable';
import * as ingestionService from '../../../../../src/services/ingestionService';
import type { ArtifactPage, DataSource } from '../../../../../src/features/data-ingestion/types';

vi.mock('../../../../../src/services/ingestionService', () => ({
    getProjectArtifacts: vi.fn(),
}));

const emptyPage: ArtifactPage = {
    items: [],
    page: {
        number: 1,
        size: 10,
        totalElements: 0,
        totalPages: 0,
        hasNext: false,
        hasPrevious: false,
    },
};

function createMockSource(overrides: Partial<DataSource> = {}): DataSource {
    return {
        sourceId: 'source-github',
        sourceSystem: 'GITHUB',
        name: 'GitHub Repository',
        type: 'GitHub',
        icon: GitBranch,
        status: 'connected',
        statusLabel: 'Synced',
        ingestionStatus: 'connected',
        ingestionStatusLabel: 'Synced',
        artifacts: 10,
        lastSync: '2026-07-05',
        errors: 0,
        latestIngestedCount: 10,
        latestUpdatedCount: 3,
        totalArtifactCount: 10,
        runIds: [],
        sharesSourceSystem: false,
        lastRunAt: '2026-07-05T10:00:00Z',
        failedItems: [],
        githubRepository: null,
        description: 'Indexes repositories.',
        ...overrides,
    };
}

describe('ArtifactTable', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(ingestionService.getProjectArtifacts).mockResolvedValue(emptyPage);
    });

    it('asks for a project before loading artifacts', () => {
        render(<ArtifactTable projectId="" sources={[]} />);

        expect(
            screen.getByText('Select a project to browse ingested artifacts.'),
        ).toBeInTheDocument();
        expect(ingestionService.getProjectArtifacts).not.toHaveBeenCalled();
    });

    it('renders summary cards from the artifact page and source errors', async () => {
        vi.mocked(ingestionService.getProjectArtifacts).mockResolvedValue({
            ...emptyPage,
            page: { ...emptyPage.page, totalElements: 30 },
        });

        render(
            <ArtifactTable
                projectId="project-1"
                sources={[createMockSource({ errors: 2 })]}
            />,
        );

        await waitFor(() => {
            expect(screen.getByText('Artifacts')).toBeInTheDocument();
        });

        expect(screen.getByText('30')).toBeInTheDocument();
        expect(screen.getByText('Latest Failures')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('renders artifact rows returned by the backend', async () => {
        vi.mocked(ingestionService.getProjectArtifacts).mockResolvedValue({
            items: [
                {
                    id: 'artifact-1',
                    title: 'README.md',
                    sourceSystem: 'GITHUB',
                    sourceUrl: 'https://github.com/acme/repo/blob/main/README.md',
                    artifactType: 'FILE',
                    ingestedAt: '2026-07-05T10:00:00Z',
                    metadata: '{}',
                },
            ],
            page: {
                ...emptyPage.page,
                totalElements: 1,
                totalPages: 1,
            },
        });

        render(<ArtifactTable projectId="project-1" sources={[]} />);

        await waitFor(() => {
            expect(screen.getByText('README.md')).toBeInTheDocument();
        });

        expect(screen.getByText('FILE')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Open/ })).toHaveAttribute(
            'href',
            'https://github.com/acme/repo/blob/main/README.md',
        );
    });

    it('shows an error message when artifact loading fails', async () => {
        vi.mocked(ingestionService.getProjectArtifacts).mockRejectedValue(
            new Error('Network failure'),
        );

        render(<ArtifactTable projectId="project-1" sources={[]} />);

        await waitFor(() => {
            expect(screen.getByText('Network failure')).toBeInTheDocument();
        });
    });
});
