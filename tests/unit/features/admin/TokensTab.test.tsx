import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TokensTab } from '../../../../src/features/admin/components/TokensTab';

const githubServiceMock = vi.hoisted(() => ({
    addGithubPat: vi.fn(),
    updateGithubPat: vi.fn(),
    deleteGithubPat: vi.fn(),
}));

vi.mock('../../../../src/services/sources/githubService', () => ({
    addGithubPat: githubServiceMock.addGithubPat,
    updateGithubPat: githubServiceMock.updateGithubPat,
    deleteGithubPat: githubServiceMock.deleteGithubPat,
}));

describe('TokensTab', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('adds a new token and refreshes the list', async () => {
        const user = userEvent.setup();
        const onRefresh = vi.fn();
        githubServiceMock.addGithubPat.mockResolvedValue(undefined);

        render(<TokensTab tokenNames={[]} onRefresh={onRefresh} />);

        await user.click(screen.getByRole('button', { name: 'Add Token' }));
        await user.type(screen.getByLabelText('Token name'), 'default');
        await user.type(screen.getByLabelText('Token (ghp_...)'), 'ghp_test');
        await user.click(screen.getByRole('button', { name: 'Add Token' }));

        await waitFor(() => {
            expect(githubServiceMock.addGithubPat).toHaveBeenCalledWith(
                'default',
                'ghp_test',
            );
            expect(onRefresh).toHaveBeenCalled();
        });
    });

    it('rotates an existing token', async () => {
        const user = userEvent.setup();
        const onRefresh = vi.fn();
        githubServiceMock.updateGithubPat.mockResolvedValue(undefined);

        render(<TokensTab tokenNames={['default']} onRefresh={onRefresh} />);

        await user.click(screen.getByRole('button', { name: 'Rotate' }));
        await user.type(screen.getByLabelText('New GitHub PAT'), 'github_pat_new');
        await user.click(screen.getByRole('button', { name: 'Confirm' }));

        await waitFor(() => {
            expect(githubServiceMock.updateGithubPat).toHaveBeenCalledWith(
                'default',
                'github_pat_new',
            );
            expect(onRefresh).toHaveBeenCalled();
        });
    });

    it('deletes an existing token after inline confirmation', async () => {
        const user = userEvent.setup();
        const onRefresh = vi.fn();
        githubServiceMock.deleteGithubPat.mockResolvedValue(undefined);

        render(<TokensTab tokenNames={['default']} onRefresh={onRefresh} />);

        await user.click(screen.getByRole('button', { name: 'Delete' }));
        const confirmation = screen
            .getByText(/This cannot be undone/)
            .closest('div');
        expect(confirmation).not.toBeNull();

        await user.click(
            within(confirmation as HTMLElement).getByRole('button', {
                name: 'Delete',
            }),
        );

        await waitFor(() => {
            expect(githubServiceMock.deleteGithubPat).toHaveBeenCalledWith(
                'default',
            );
            expect(onRefresh).toHaveBeenCalled();
        });
    });
});
