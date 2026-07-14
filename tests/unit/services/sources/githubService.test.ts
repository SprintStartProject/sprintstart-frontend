import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import {
    connectGithubRepository,
    getGithubPatNames,
    addGithubPat,
    updateGithubPat,
    deleteGithubPat,
    updateAllGithubRepositories,
    updateGithubRepository,
} from '../../../../src/services/sources/githubService';
import { server } from '../../../unit/setup/vitest.setup';

describe('githubService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('connectGithubRepository', () => {
        it('POSTs owner, name and tokenName and returns the transaction id', async () => {
            let capturedBody: unknown = null;
            server.use(
                http.post('/api/v1/github/connect', async ({ request }) => {
                    capturedBody = await request.json();
                    return HttpResponse.json({ transactionId: 'txn-1' });
                }),
            );

            const result = await connectGithubRepository({
                owner: 'octocat',
                name: 'Hello-World',
                tokenName: 'default',
            });

            expect(capturedBody).toEqual({ owner: 'octocat', name: 'Hello-World', tokenName: 'default' });
            expect(result.transactionId).toBe('txn-1');
        });

        it('rejects when the backend returns a non-OK response', async () => {
            server.use(http.post('/api/v1/github/connect', () => HttpResponse.json({}, { status: 400 })));

            await expect(
                connectGithubRepository({ owner: 'o', name: 'n', tokenName: 't' }),
            ).rejects.toMatchObject({ name: 'ApiError', status: 400 });
        });
    });

    describe('getGithubPatNames', () => {
        it('returns the list of PAT names', async () => {
            server.use(http.get('/api/v1/github/pat', () => HttpResponse.json(['default', 'ci'])));
            const result = await getGithubPatNames();
            expect(result).toEqual(['default', 'ci']);
        });
    });

    describe('addGithubPat', () => {
        it('POSTs name and token', async () => {
            let capturedBody: unknown = null;
            server.use(
                http.post('/api/v1/github/pat', async ({ request }) => {
                    capturedBody = await request.json();
                    return new HttpResponse(null, { status: 200 });
                }),
            );

            await addGithubPat('ci', 'secret-token');
            expect(capturedBody).toEqual({ name: 'ci', token: 'secret-token' });
        });
    });

    describe('updateGithubPat', () => {
        it('PUTs name and newToken', async () => {
            let capturedBody: unknown = null;
            server.use(
                http.put('/api/v1/github/pat/update', async ({ request }) => {
                    capturedBody = await request.json();
                    return new HttpResponse(null, { status: 200 });
                }),
            );

            await updateGithubPat('ci', 'new-secret');
            expect(capturedBody).toEqual({ name: 'ci', newToken: 'new-secret' });
        });
    });

    describe('deleteGithubPat', () => {
        it('PUTs the name to the delete endpoint', async () => {
            let capturedBody: unknown = null;
            server.use(
                http.put('/api/v1/github/pat/delete', async ({ request }) => {
                    capturedBody = await request.json();
                    return new HttpResponse(null, { status: 200 });
                }),
            );

            await deleteGithubPat('ci');
            expect(capturedBody).toEqual({ name: 'ci' });
        });
    });

    describe('updateAllGithubRepositories', () => {
        it('POSTs to update-all and returns the transaction id', async () => {
            server.use(
                http.post('/api/v1/github/update-all', () => HttpResponse.json({ transactionId: 'txn-all' })),
            );
            const result = await updateAllGithubRepositories();
            expect(result.transactionId).toBe('txn-all');
        });
    });

    describe('updateGithubRepository', () => {
        it('POSTs owner and name to update', async () => {
            let capturedBody: unknown = null;
            server.use(
                http.post('/api/v1/github/update', async ({ request }) => {
                    capturedBody = await request.json();
                    return HttpResponse.json({ transactionId: 'txn-one' });
                }),
            );

            const result = await updateGithubRepository({ owner: 'octocat', name: 'Hello-World' });
            expect(capturedBody).toEqual({ owner: 'octocat', name: 'Hello-World' });
            expect(result.transactionId).toBe('txn-one');
        });
    });
});
