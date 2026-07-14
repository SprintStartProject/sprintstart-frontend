import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { DataIngestionPage } from '../../../src/pages/DataIngestionPage';

vi.mock('../../../src/context/useAuth', () => ({
    useAuth: () => ({ profile: { id: 'user1', firstName: 'Test', lastName: 'User' } }),
}));

const {
    mockGetIngestionRuns,
    mockGetIngestionStatus,
    mockConnectGithubRepository,
    mockGetGithubPatNames,
    mockUpdateAllGithubRepositories,
    mockUpdateGithubRepository,
} = vi.hoisted(() => ({
    mockGetIngestionRuns: vi.fn(),
    mockGetIngestionStatus: vi.fn(),
    mockConnectGithubRepository: vi.fn(),
    mockGetGithubPatNames: vi.fn(),
    mockUpdateAllGithubRepositories: vi.fn(),
    mockUpdateGithubRepository: vi.fn(),
}));

vi.mock('../../../src/services/ingestionService', () => ({
    getIngestionRuns: mockGetIngestionRuns,
    getIngestionStatus: mockGetIngestionStatus,
}));

vi.mock('../../../src/services/sources/githubService', () => ({
    connectGithubRepository: mockConnectGithubRepository,
    getGithubPatNames: mockGetGithubPatNames,
    updateAllGithubRepositories: mockUpdateAllGithubRepositories,
    updateGithubRepository: mockUpdateGithubRepository,
}));

describe('DataIngestionPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetIngestionRuns.mockResolvedValue([]);
        mockGetIngestionStatus.mockResolvedValue([]);
        mockGetGithubPatNames.mockResolvedValue(['token1']);
        mockConnectGithubRepository.mockResolvedValue({ transactionId: 'tx1' });
        mockUpdateAllGithubRepositories.mockResolvedValue({ transactionId: 'tx2' });
        mockUpdateGithubRepository.mockResolvedValue({ transactionId: 'tx3' });
    });

    it('renders sources, artifacts, and runs tabs after loading', async () => {
        render(<MemoryRouter><DataIngestionPage /></MemoryRouter>);

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'sources' })).toBeInTheDocument();
        });

        expect(screen.getByRole('button', { name: 'artifacts' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'runs' })).toBeInTheDocument();
    });

    it('switches to the artifacts tab when clicked', async () => {
        const user = userEvent.setup();
        render(<MemoryRouter><DataIngestionPage /></MemoryRouter>);

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'artifacts' })).toBeInTheDocument();
        });

        await user.click(screen.getByRole('button', { name: 'artifacts' }));

        expect(screen.getByRole('button', { name: 'artifacts' })).toHaveClass('bg-app-brand');
    });

    it('switches to the runs tab when clicked', async () => {
        const user = userEvent.setup();
        render(<MemoryRouter><DataIngestionPage /></MemoryRouter>);

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'runs' })).toBeInTheDocument();
        });

        await user.click(screen.getByRole('button', { name: 'runs' }));

        expect(screen.getByRole('button', { name: 'runs' })).toHaveClass('bg-app-brand');
    });

    it('opens the source connect modal when Add Source is clicked', async () => {
        const user = userEvent.setup();
        render(<MemoryRouter><DataIngestionPage /></MemoryRouter>);

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Add Source/ })).toBeInTheDocument();
        });

        await user.click(screen.getByRole('button', { name: /Add Source/ }));

        await waitFor(() => {
            expect(screen.getByText('Add Data Source')).toBeInTheDocument();
        });
    });

    it('parses owner/repo format and calls connectGithubRepository on submit', async () => {
        const user = userEvent.setup();
        render(<MemoryRouter><DataIngestionPage /></MemoryRouter>);

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Add Source/ })).toBeInTheDocument();
        });

        await user.click(screen.getByRole('button', { name: /Add Source/ }));

        await waitFor(() => {
            expect(screen.getByLabelText('Repository owner')).toBeInTheDocument();
        });

        await user.type(screen.getByLabelText('Repository owner'), 'octocat/hello-world');

        await user.click(screen.getByRole('button', { name: 'Connect Source' }));

        await waitFor(() => {
            expect(mockConnectGithubRepository).toHaveBeenCalledWith(
                expect.objectContaining({
                    owner: 'octocat',
                    name: 'hello-world',
                    tokenName: 'token1',
                }),
            );
        });
    });
});
