import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from '../../../../src/components/ui/EmptyState';
import { Spinner } from '../../../../src/components/ui/Spinner';

describe('Spinner', () => {
    it('announces what is being waited for', () => {
        render(<Spinner label="Loading projects" />);
        expect(screen.getByRole('status')).toHaveTextContent('Loading projects');
    });

    it('stays silent when the surrounding element already announces the wait', () => {
        render(<Spinner label="Loading" silent />);
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
});

describe('EmptyState', () => {
    it('renders the message on its own', () => {
        render(<EmptyState>No sources connected.</EmptyState>);
        expect(screen.getByText('No sources connected.')).toBeInTheDocument();
    });

    it('renders title, message and action together', () => {
        render(
            <EmptyState title="Nothing here" action={<button>Add one</button>}>
                Connect a repository to get started.
            </EmptyState>,
        );

        expect(screen.getByText('Nothing here')).toBeInTheDocument();
        expect(screen.getByText('Connect a repository to get started.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Add one' })).toBeInTheDocument();
    });

    it('can carry a spinner, so a loading list and an empty list share one shape', () => {
        render(
            <EmptyState icon={<Spinner silent />} title="Loading connectors">
                Fetching from the backend.
            </EmptyState>,
        );
        expect(screen.getByText('Loading connectors')).toBeInTheDocument();
    });

    it('keeps the dashed box in both sizes', () => {
        const { container, rerender } = render(<EmptyState>Empty.</EmptyState>);
        expect(container.firstElementChild?.className).toContain('border-dashed');

        rerender(<EmptyState size="sm">Empty.</EmptyState>);
        expect(container.firstElementChild?.className).toContain('border-dashed');
    });
});
