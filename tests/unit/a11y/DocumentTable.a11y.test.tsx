import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { MemoryRouter } from 'react-router-dom';
import { DocumentTable } from '../../../src/features/knowledge-base/components/DocumentTable';
import { DocumentStatus } from '../../../src/services/types';
import type { DocumentMetadata } from '../../../src/services/types';

vi.mock('framer-motion', () => ({
    motion: new Proxy({}, {
        get: () => (props: Record<string, unknown>) => props.children
    }),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

const documents: DocumentMetadata[] = [
    {
        id: 'd1',
        name: 'README.md',
        mime: 'text/markdown',
        status: DocumentStatus.COMPLETED,
        uploadDate: '2026-07-01T00:00:00.000Z'
    },
    {
        id: 'd2',
        name: 'guide.md',
        mime: 'text/markdown',
        status: DocumentStatus.PROCESSING,
        uploadDate: '2026-07-02T00:00:00.000Z'
    }
];

describe('DocumentTable Accessibility', () => {
    it('should not have any a11y violations', async () => {
        const { baseElement } = render(
            <MemoryRouter>
                <main>
                    <DocumentTable
                        documents={documents}
                        onDelete={vi.fn()}
                    />
                </main>
            </MemoryRouter>
        );

        expect(screen.getByRole('button', { name: 'Remove document README.md' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Remove document guide.md' })).toBeInTheDocument();

        expect(await axe(baseElement)).toHaveNoViolations();
    });
});
