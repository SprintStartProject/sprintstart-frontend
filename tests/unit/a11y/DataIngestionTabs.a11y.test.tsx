import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { MemoryRouter } from 'react-router-dom';
import { DataIngestionTabs } from '../../../src/features/data-ingestion/components/DataIngestionTabs';

describe('DataIngestionTabs Accessibility', () => {
    it('should not have any a11y violations', async () => {
        const { baseElement } = render(
            <MemoryRouter>
                <main>
                    <DataIngestionTabs
                        activeTab="sources"
                        onTabChange={vi.fn()}
                        onAddSource={vi.fn()}
                    />
                </main>
            </MemoryRouter>
        );

        expect(screen.getByRole('button', { name: 'sources' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'artifacts' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'runs' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Add Source' })).toBeInTheDocument();

        expect(await axe(baseElement)).toHaveNoViolations();
    });
});
