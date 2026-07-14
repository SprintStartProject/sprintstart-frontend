import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { KnowledgeBasePage } from '../../../src/pages/KnowledgeBasePage';
import { DocumentStatus } from '../../../src/services/types';
import type { DocumentMetadata } from '../../../src/services/types';

const { mockProfile } = vi.hoisted(() => ({
    mockProfile: { id: 'user1', firstName: 'Test', lastName: 'User' },
}));

vi.mock('../../../src/context/useAuth', () => ({
    useAuth: () => ({ profile: mockProfile }),
}));

const { mockFetchDocuments, mockUploadDocuments, mockDeleteDocument } = vi.hoisted(() => ({
    mockFetchDocuments: vi.fn(),
    mockUploadDocuments: vi.fn(),
    mockDeleteDocument: vi.fn(),
}));

vi.mock('../../../src/services/knowledgeService', () => ({
    knowledgeService: {
        fetchDocuments: mockFetchDocuments,
        uploadDocuments: mockUploadDocuments,
        deleteDocument: mockDeleteDocument,
    },
}));

vi.mock('../../../src/features/knowledge-base/components/FileUploadZone', () => ({
    FileUploadZone: ({ onUpload, isUploading }: { onUpload: (files: File[]) => void; isUploading: boolean }) => (
        <div>
            <button onClick={() => onUpload([new File(['content'], 'test.md', { type: 'text/markdown' })])}>
                Upload documentation or images
            </button>
            {isUploading && <span>Uploading...</span>}
        </div>
    ),
}));

vi.mock('../../../src/features/knowledge-base/components/DocumentTable', () => ({
    DocumentTable: ({ documents }: { documents: DocumentMetadata[] }) => (
        <table>
            <tbody>
                {documents.map((doc) => (
                    <tr key={doc.id}><td>{doc.name}</td></tr>
                ))}
            </tbody>
        </table>
    ),
}));

describe('KnowledgeBasePage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        sessionStorage.clear();
        mockFetchDocuments.mockResolvedValue([]);
        mockUploadDocuments.mockResolvedValue([]);
        mockDeleteDocument.mockResolvedValue(undefined);
    });

    it('renders the document table after loading documents', async () => {
        const docs: DocumentMetadata[] = [
            { id: 'd1', name: 'readme.md', mime: 'text/markdown', status: DocumentStatus.COMPLETED, uploadDate: '2024-01-01' },
        ];
        mockFetchDocuments.mockResolvedValue(docs);

        render(<MemoryRouter><KnowledgeBasePage /></MemoryRouter>);

        await waitFor(() => {
            expect(screen.getByText('readme.md')).toBeInTheDocument();
        });
    });

    it('renders the upload zone', async () => {
        render(<MemoryRouter><KnowledgeBasePage /></MemoryRouter>);

        await waitFor(() => {
            expect(screen.getByText('Ingest Documentation')).toBeInTheDocument();
        });
        expect(screen.getByText('Upload documentation or images')).toBeInTheDocument();
    });

    it('persists documents to sessionStorage on load', async () => {
        const docs: DocumentMetadata[] = [
            { id: 'd1', name: 'readme.md', mime: 'text/markdown', status: DocumentStatus.COMPLETED, uploadDate: '2024-01-01' },
        ];
        mockFetchDocuments.mockResolvedValue(docs);

        render(<MemoryRouter><KnowledgeBasePage /></MemoryRouter>);

        await waitFor(() => {
            expect(screen.getByText('readme.md')).toBeInTheDocument();
            const stored = sessionStorage.getItem('kb_docs_user1');
            expect(stored).not.toBeNull();
            expect(JSON.parse(stored!)).toHaveLength(1);
        });
    });

    it('shows a batch result toast after a successful upload', async () => {
        const user = userEvent.setup();
        mockUploadDocuments.mockResolvedValue([
            { id: 'd2', filename: 'uploaded.md', status: 'ok' as const },
        ]);

        render(<MemoryRouter><KnowledgeBasePage /></MemoryRouter>);

        await waitFor(() => {
            expect(screen.getByText('Upload documentation or images')).toBeInTheDocument();
        });

        await user.click(screen.getByText('Upload documentation or images'));

        await waitFor(() => {
            expect(screen.getByText(/Upload Complete/)).toBeInTheDocument();
        });
    });

    it('refreshes documents when the refresh button is clicked', async () => {
        const user = userEvent.setup();
        mockFetchDocuments.mockResolvedValue([]);

        render(<MemoryRouter><KnowledgeBasePage /></MemoryRouter>);

        await waitFor(() => {
            expect(screen.getByText('Refresh')).toBeInTheDocument();
        });

        await user.click(screen.getByText('Refresh'));

        await waitFor(() => {
            expect(mockFetchDocuments).toHaveBeenCalledTimes(2);
        });
    });
});
