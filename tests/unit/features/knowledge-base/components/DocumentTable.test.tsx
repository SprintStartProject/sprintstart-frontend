import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocumentTable } from '../../../../../src/features/knowledge-base/components/DocumentTable';

vi.mock('framer-motion', async (importOriginal) => {
    const actual = await importOriginal<typeof import('framer-motion')>();
    const tags = ['div', 'button', 'span', 'ul', 'li', 'section', 'nav', 'form', 'label', 'tr', 'td', 'th', 'tbody', 'thead'];
    const mockedMotion = tags.reduce((acc, tag) => {
        acc[tag] = ({ children, className, ...props }: { children?: React.ReactNode; className?: string; [key: string]: unknown }) =>
            React.createElement(tag, { className, ...props }, children);
        return acc;
    }, {} as Record<string, React.ComponentType<Record<string, unknown>>>);
    return { ...actual, AnimatePresence: ({ children }: { children: React.ReactNode }) => children, motion: mockedMotion };
});
import React from 'react';
import type { DocumentMetadata } from '../../../../../src/services/types';
import { DocumentStatus } from '../../../../../src/services/types';

function createDoc(overrides: Partial<DocumentMetadata> = {}): DocumentMetadata {
    return {
        id: 'doc1',
        name: 'test.md',
        mime: 'text/markdown',
        status: DocumentStatus.COMPLETED,
        uploadDate: '2026-07-01T00:00:00Z',
        ...overrides,
    };
}

describe('DocumentTable', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders documents with their names', () => {
        const docs = [createDoc({ id: 'd1', name: 'guide.md' }), createDoc({ id: 'd2', name: 'readme.md' })];
        render(<DocumentTable documents={docs} onDelete={vi.fn()} />);

        expect(screen.getByText('guide.md')).toBeInTheDocument();
        expect(screen.getByText('readme.md')).toBeInTheDocument();
    });

    it('renders status badges for each document status', () => {
        const statuses: DocumentStatus[] = [
            DocumentStatus.COMPLETED,
            DocumentStatus.PROCESSING,
            DocumentStatus.PENDING,
            DocumentStatus.FAILED,
        ];
        const docs = statuses.map((status, i) => createDoc({ id: `d${i}`, name: `doc${i}.md`, status }));

        render(<DocumentTable documents={docs} onDelete={vi.fn()} />);

        expect(screen.getByText('Ready')).toBeInTheDocument();
        expect(screen.getByText('Indexing')).toBeInTheDocument();
        expect(screen.getByText('Queued')).toBeInTheDocument();
        expect(screen.getByText('Error')).toBeInTheDocument();
    });

    it('calls onDelete with the document id when delete button is clicked', async () => {
        const user = userEvent.setup();
        const onDelete = vi.fn();
        const docs = [createDoc({ id: 'd1', name: 'remove-me.md' })];

        render(<DocumentTable documents={docs} onDelete={onDelete} />);

        const deleteButton = screen.getByRole('button', { name: 'Remove document remove-me.md' });
        await user.click(deleteButton);

        expect(onDelete).toHaveBeenCalledWith('d1');
    });

    it('shows the empty state when there are no documents', () => {
        render(<DocumentTable documents={[]} onDelete={vi.fn()} />);

        expect(screen.getByText('No documents indexed')).toBeInTheDocument();
    });

    it('renders the document header row', () => {
        render(<DocumentTable documents={[]} onDelete={vi.fn()} />);

        expect(screen.getByText('Document')).toBeInTheDocument();
        expect(screen.getByText('Status')).toBeInTheDocument();
        expect(screen.getByText('Actions')).toBeInTheDocument();
    });
});
