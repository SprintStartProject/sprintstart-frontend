import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    addDraftSource,
    connectDraftSources,
    countUnconnectedSources,
    createDraftSource,
    createDraftSourceFromDiscovery,
    hasFailedSources,
    removeDraftSource,
    type DraftSource,
} from '../../../../src/features/admin/projectSourcesDraft';
import {
    addRepositoryToProject,
    connectGithubRepository,
} from '../../../../src/services/sources/githubService';
import type { DiscoverySelection } from '../../../../src/features/data-ingestion/components/GithubRepositoryDiscovery';

vi.mock('../../../../src/services/sources/githubService', () => ({
    connectGithubRepository: vi.fn(),
    addRepositoryToProject: vi.fn(),
}));

const connectGithubRepositoryMock = vi.mocked(connectGithubRepository);
const addRepositoryToProjectMock = vi.mocked(addRepositoryToProject);

beforeEach(() => {
    connectGithubRepositoryMock.mockReset();
    connectGithubRepositoryMock.mockResolvedValue({ transactionId: 'tx' });
    addRepositoryToProjectMock.mockReset();
    addRepositoryToProjectMock.mockResolvedValue({ repositoryId: 'r1', projectIds: ['p1'] });
});

describe('createDraftSource', () => {
    it('starts pending with a unique id', () => {
        const first = createDraftSource('acme', 'widgets', 'pat');
        const second = createDraftSource('acme', 'gadgets', 'pat');

        expect(first.status).toBe('pending');
        expect(first.errorMessage).toBe('');
        expect(first.id).not.toBe(second.id);
        expect(first.repositoryId).toBeUndefined();
    });

    it('carries a repository id when one is given', () => {
        expect(createDraftSource('acme', 'widgets', 'pat', 'repo-1').repositoryId).toBe(
            'repo-1',
        );
    });
});

describe('createDraftSourceFromDiscovery', () => {
    const baseSelection: DiscoverySelection = {
        owner: 'acme',
        name: 'widgets',
        isPrivate: false,
        linkState: 'new',
    };

    it('stages a new repository without a repository id', () => {
        const draft = createDraftSourceFromDiscovery(baseSelection, 'pat');

        expect(draft.owner).toBe('acme');
        expect(draft.name).toBe('widgets');
        expect(draft.tokenName).toBe('pat');
        expect(draft.repositoryId).toBeUndefined();
    });

    it('keeps the repository id for a linkable repository', () => {
        const draft = createDraftSourceFromDiscovery(
            { ...baseSelection, linkState: 'linkable', repositoryId: 'repo-9' },
            'pat',
        );

        expect(draft.repositoryId).toBe('repo-9');
    });
});

describe('addDraftSource', () => {
    it('appends a new repository', () => {
        const sources = addDraftSource([], createDraftSource('acme', 'widgets', 'pat'));

        expect(sources).toHaveLength(1);
    });

    it('ignores a duplicate regardless of casing', () => {
        const sources = addDraftSource([], createDraftSource('acme', 'widgets', 'pat'));
        const withDuplicate = addDraftSource(
            sources,
            createDraftSource('ACME', 'Widgets', 'other-pat'),
        );

        expect(withDuplicate).toBe(sources);
    });
});

describe('removeDraftSource', () => {
    it('drops the matching entry only', () => {
        const first = createDraftSource('acme', 'widgets', 'pat');
        const second = createDraftSource('acme', 'gadgets', 'pat');

        expect(removeDraftSource([first, second], first.id)).toEqual([second]);
    });
});

describe('countUnconnectedSources / hasFailedSources', () => {
    it('counts everything that is not connected yet', () => {
        const sources: DraftSource[] = [
            { ...createDraftSource('a', 'b', 'pat'), status: 'connected' },
            { ...createDraftSource('c', 'd', 'pat'), status: 'failed' },
            createDraftSource('e', 'f', 'pat'),
        ];

        expect(countUnconnectedSources(sources)).toBe(2);
        expect(hasFailedSources(sources)).toBe(true);
    });

    it('reports no failures for a clean list', () => {
        expect(hasFailedSources([createDraftSource('a', 'b', 'pat')])).toBe(false);
    });
});

describe('connectDraftSources', () => {
    it('connects every pending source against the given project', async () => {
        const sources = [
            createDraftSource('acme', 'widgets', 'pat'),
            createDraftSource('acme', 'gadgets', 'pat'),
        ];

        const result = await connectDraftSources('p1', sources);

        expect(connectGithubRepositoryMock).toHaveBeenCalledTimes(2);
        expect(connectGithubRepositoryMock).toHaveBeenCalledWith({
            owner: 'acme',
            name: 'widgets',
            tokenName: 'pat',
            projectId: 'p1',
        });
        expect(result.every((source) => source.status === 'connected')).toBe(true);
    });

    it('keeps going after a failure and records it per source', async () => {
        connectGithubRepositoryMock
            .mockRejectedValueOnce(new Error('token expired'))
            .mockResolvedValueOnce({ transactionId: 'tx' });

        const result = await connectDraftSources('p1', [
            createDraftSource('acme', 'widgets', 'pat'),
            createDraftSource('acme', 'gadgets', 'pat'),
        ]);

        expect(result[0].status).toBe('failed');
        expect(result[0].errorMessage).toBe('token expired');
        expect(result[1].status).toBe('connected');
    });

    it('skips sources that already connected, so a retry is not a re-send', async () => {
        const connected: DraftSource = {
            ...createDraftSource('acme', 'widgets', 'pat'),
            status: 'connected',
        };

        await connectDraftSources('p1', [
            connected,
            createDraftSource('acme', 'gadgets', 'pat'),
        ]);

        expect(connectGithubRepositoryMock).toHaveBeenCalledTimes(1);
        expect(connectGithubRepositoryMock).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'gadgets' }),
        );
    });

    it('links an already-ingested repository instead of re-ingesting it', async () => {
        const result = await connectDraftSources('p1', [
            createDraftSource('acme', 'linked', 'pat', 'repo-42'),
            createDraftSource('acme', 'fresh', 'pat'),
        ]);

        expect(addRepositoryToProjectMock).toHaveBeenCalledTimes(1);
        expect(addRepositoryToProjectMock).toHaveBeenCalledWith('repo-42', 'p1');
        expect(connectGithubRepositoryMock).toHaveBeenCalledTimes(1);
        expect(connectGithubRepositoryMock).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'fresh' }),
        );
        expect(result.every((source) => source.status === 'connected')).toBe(true);
    });

    it('reports progress as the run advances', async () => {
        const onProgress = vi.fn();

        await connectDraftSources('p1', [createDraftSource('acme', 'widgets', 'pat')], onProgress);

        const statuses = onProgress.mock.calls.map(
            (call) => (call[0] as DraftSource[])[0].status,
        );

        expect(statuses).toEqual(['connecting', 'connected']);
    });
});
