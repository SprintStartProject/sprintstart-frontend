import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TokensTab } from '../../../../../src/features/admin/components/TokensTab';

vi.mock('../../../../../src/services/sources/githubService', () => ({
    addGithubPat: vi.fn(),
    deleteGithubPat: vi.fn(),
    updateGithubPat: vi.fn(),
}));

import {
    addGithubPat,
    deleteGithubPat,
    updateGithubPat,
} from '../../../../../src/services/sources/githubService';

describe('TokensTab', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(addGithubPat).mockResolvedValue(undefined);
        vi.mocked(deleteGithubPat).mockResolvedValue(undefined);
        vi.mocked(updateGithubPat).mockResolvedValue(undefined);
    });

    it('shows the token count and the empty state when there are no tokens', () => {
        render(<TokensTab tokenNames={[]} onRefresh={vi.fn()} />);

        expect(screen.getByText('0 tokens')).toBeInTheDocument();
        expect(screen.getByText('No tokens yet')).toBeInTheDocument();
    });

    it('renders a row for each token name', () => {
        render(<TokensTab tokenNames={['default', 'ci']} onRefresh={vi.fn()} />);

        expect(screen.getByText('2 tokens')).toBeInTheDocument();
        expect(screen.getByText('default')).toBeInTheDocument();
        expect(screen.getByText('ci')).toBeInTheDocument();
    });

    it('opens the add-PAT form when Add Token is clicked', async () => {
        const user = userEvent.setup();
        render(<TokensTab tokenNames={[]} onRefresh={vi.fn()} />);

        await user.click(screen.getByRole('button', { name: 'Add Token' }));

        expect(screen.getByLabelText('Token name')).toBeInTheDocument();
        expect(screen.getByLabelText('Token (ghp_...)')).toBeInTheDocument();
    });

    it('submits the add-PAT form and calls onRefresh', async () => {
        const user = userEvent.setup();
        const onRefresh = vi.fn();
        render(<TokensTab tokenNames={[]} onRefresh={onRefresh} />);

        await user.click(screen.getByRole('button', { name: 'Add Token' }));
        await user.type(screen.getByLabelText('Token name'), 'ci');
        await user.type(screen.getByLabelText('Token (ghp_...)'), 'ghp_secret');
        await user.click(screen.getByRole('button', { name: /Add Token/i }));

        await waitFor(() =>
            expect(addGithubPat).toHaveBeenCalledWith('ci', 'ghp_secret'),
        );
        await waitFor(() => expect(onRefresh).toHaveBeenCalled());
    });

    it('shows a loading indicator while adding a token', async () => {
        let resolveAdd: (value: void) => void = () => {};
        vi.mocked(addGithubPat).mockImplementation(
            () =>
                new Promise<void>((resolve) => {
                    resolveAdd = resolve;
                }),
        );

        const user = userEvent.setup();
        render(<TokensTab tokenNames={[]} onRefresh={vi.fn()} />);

        await user.click(screen.getByRole('button', { name: 'Add Token' }));
        await user.type(screen.getByLabelText('Token name'), 'ci');
        await user.type(screen.getByLabelText('Token (ghp_...)'), 'ghp_secret');
        await user.click(screen.getByRole('button', { name: /Add Token/i }));

        expect(await screen.findByText('Adding...')).toBeInTheDocument();

        resolveAdd();
        await waitFor(() =>
            expect(screen.queryByText('Adding...')).not.toBeInTheDocument(),
        );
    });

    it('displays an error when adding a token fails', async () => {
        vi.mocked(addGithubPat).mockRejectedValue(new Error('Token rejected'));
        const user = userEvent.setup();
        render(<TokensTab tokenNames={[]} onRefresh={vi.fn()} />);

        await user.click(screen.getByRole('button', { name: 'Add Token' }));
        await user.type(screen.getByLabelText('Token name'), 'ci');
        await user.type(screen.getByLabelText('Token (ghp_...)'), 'ghp_bad');
        await user.click(screen.getByRole('button', { name: /Add Token/i }));

        expect(await screen.findByText('Token rejected')).toBeInTheDocument();
    });

    it('opens the rotate form and updates the token on confirm', async () => {
        const user = userEvent.setup();
        const onRefresh = vi.fn();
        render(<TokensTab tokenNames={['default']} onRefresh={onRefresh} />);

        await user.click(screen.getByRole('button', { name: 'Rotate' }));
        const rotateInput = screen.getByPlaceholderText('ghp_... or github_pat_...');
        await user.type(rotateInput, 'ghp_new');
        await user.click(screen.getByRole('button', { name: /Confirm/i }));

        await waitFor(() =>
            expect(updateGithubPat).toHaveBeenCalledWith('default', 'ghp_new'),
        );
        await waitFor(() => expect(onRefresh).toHaveBeenCalled());
    });

    it('requests confirmation before deleting and deletes on confirm', async () => {
        const user = userEvent.setup();
        const onRefresh = vi.fn();
        render(<TokensTab tokenNames={['default']} onRefresh={onRefresh} />);

        await user.click(screen.getByRole('button', { name: 'Delete' }));
        expect(
            screen.getByText(
                (_, element) =>
                    element?.tagName === 'P' &&
                    Boolean(element.textContent?.includes('This cannot be undone')),
            ),
        ).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Delete' }));

        await waitFor(() =>
            expect(deleteGithubPat).toHaveBeenCalledWith('default'),
        );
        await waitFor(() => expect(onRefresh).toHaveBeenCalled());
    });

    it('shows a deleting indicator while a delete is in progress', async () => {
        let resolveDelete: (value: void) => void = () => {};
        vi.mocked(deleteGithubPat).mockImplementation(
            () =>
                new Promise<void>((resolve) => {
                    resolveDelete = resolve;
                }),
        );

        const user = userEvent.setup();
        render(<TokensTab tokenNames={['default']} onRefresh={vi.fn()} />);

        await user.click(screen.getByRole('button', { name: 'Delete' }));
        await user.click(screen.getByRole('button', { name: 'Delete' }));

        expect(await screen.findByText('Deleting...')).toBeInTheDocument();

        resolveDelete();
        await waitFor(() =>
            expect(screen.queryByText('Deleting...')).not.toBeInTheDocument(),
        );
    });
});
