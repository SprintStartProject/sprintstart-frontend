import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { KnowledgeBasePage } from '../../../src/pages/KnowledgeBasePage';
import type { Artifact } from '../../../src/features/knowledge-base/types';

const { mockProfile } = vi.hoisted(() => ({
    mockProfile: { id: 'user1', firstName: 'Test', lastName: 'User', projectIds: ['p1'] },
}));

vi.mock('../../../src/context/useAuth', () => ({
    useAuth: () => ({ profile: mockProfile }),
}));

const { mockGetUnifiedArtifacts } = vi.hoisted(() => ({
    mockGetUnifiedArtifacts: vi.fn(),
}));

vi.mock('../../../src/services/knowledgeService', () => ({
    knowledgeService: {
        getUnifiedArtifacts: mockGetUnifiedArtifacts,
    },
}));

vi.mock('../../../src/features/knowledge-base/components', () => ({
    ArtifactFilters: () => <div data-testid="artifact-filters">Filters</div>,
    ArtifactList: ({ artifacts }: { artifacts: Artifact[] }) => (
        <div data-testid="artifact-list">
            {artifacts.map((a) => (
                <div key={a.id}>{a.title}</div>
            ))}
        </div>
    ),
    ArtifactViewerDrawer: () => <div data-testid="artifact-viewer">Viewer</div>,
    UploadArtifactModal: () => <div data-testid="upload-modal">Upload Modal</div>,
}));

describe('KnowledgeBasePage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetUnifiedArtifacts.mockResolvedValue([]);
    });

    it('renders the artifact list after loading artifacts', async () => {
        const artifacts: Artifact[] = [
            { id: 'a1', title: 'readme.md', artifactType: 'FILE', sourceSystem: 'GITHUB', sourceId: 'src', sourceUrl: null, mime: 'text/markdown', language: null, ingestedAt: '2024-01-01', createdAtSource: null, updatedAtSource: '2024-01-01', contentHash: null, ingestionRunId: null },
        ];
        mockGetUnifiedArtifacts.mockResolvedValue(artifacts);

        render(<MemoryRouter><KnowledgeBasePage /></MemoryRouter>);

        await waitFor(() => {
            expect(screen.getByText('readme.md')).toBeInTheDocument();
        });
    });

    it('renders the upload button', async () => {
        render(<MemoryRouter><KnowledgeBasePage /></MemoryRouter>);

        await waitFor(() => {
            expect(screen.getByLabelText('Upload new artifact')).toBeInTheDocument();
        });
    });
});
