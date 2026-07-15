import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataIngestionTabs } from '../../../../../src/features/data-ingestion/components/DataIngestionTabs';
import type { ActiveTab } from '../../../../../src/features/data-ingestion/types';

describe('DataIngestionTabs', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders all three tab buttons', () => {
        render(
            <DataIngestionTabs
                activeTab="sources"
                onTabChange={vi.fn()}
                onAddSource={vi.fn()}
            />,
        );

        expect(screen.getByRole('button', { name: 'sources' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'artifacts' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'runs' })).toBeInTheDocument();
    });

    it('calls onTabChange with the clicked tab name', async () => {
        const user = userEvent.setup();
        const onTabChange = vi.fn();

        render(
            <DataIngestionTabs
                activeTab="sources"
                onTabChange={onTabChange}
                onAddSource={vi.fn()}
            />,
        );

        await user.click(screen.getByRole('button', { name: 'artifacts' }));

        expect(onTabChange).toHaveBeenCalledWith('artifacts' satisfies ActiveTab);
        expect(onTabChange).toHaveBeenCalledTimes(1);
    });

    it('applies active styling to the selected tab', () => {
        render(
            <DataIngestionTabs
                activeTab="runs"
                onTabChange={vi.fn()}
                onAddSource={vi.fn()}
            />,
        );

        const activeTab = screen.getByRole('button', { name: 'runs' });
        const inactiveTab = screen.getByRole('button', { name: 'sources' });

        expect(activeTab).toHaveClass('bg-app-brand');
        expect(activeTab).toHaveClass('text-app-text-inverse');
        expect(inactiveTab).not.toHaveClass('bg-app-brand');
    });

    it('renders the Add Source button', () => {
        render(
            <DataIngestionTabs
                activeTab="sources"
                onTabChange={vi.fn()}
                onAddSource={vi.fn()}
            />,
        );

        expect(
            screen.getByRole('button', { name: /Add Source/ }),
        ).toBeInTheDocument();
    });

    it('calls onAddSource when the Add Source button is clicked', async () => {
        const user = userEvent.setup();
        const onAddSource = vi.fn();

        render(
            <DataIngestionTabs
                activeTab="sources"
                onTabChange={vi.fn()}
                onAddSource={onAddSource}
            />,
        );

        await user.click(screen.getByRole('button', { name: /Add Source/ }));

        expect(onAddSource).toHaveBeenCalledTimes(1);
    });
});
