import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useProjectSelection } from '../../../../src/features/projects/useProjectSelection';
import { server } from '../../setup/vitest.setup';

describe('useProjectSelection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.localStorage.clear();
    });

    it('loads from the admin project listing when isAdmin is true', async () => {
        server.use(
            http.get('/api/v1/admin/projects', () =>
                HttpResponse.json([
                    {
                        id: 'admin-project-1',
                        name: 'Admin Project',
                        description: 'Full admin project',
                        sources: [{ id: 's1', name: 'repo', type: 'GITHUB', status: 'CONNECTED' }],
                        users: [],
                    },
                ]),
            ),
        );

        const { result } = renderHook(() => useProjectSelection({ isAdmin: true }));

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.projects).toHaveLength(1);
        expect(result.current.selectedProjectId).toBe('admin-project-1');
        expect(result.current.selectedProject?.sources).toHaveLength(1);
    });

    it('falls back to the self-service listing when isAdmin is false, so non-admins can still select a project', async () => {
        server.use(
            http.get('/api/v1/admin/projects', () =>
                HttpResponse.json({}, { status: 403 }),
            ),
            http.get('/api/v1/users/me/projects', () =>
                HttpResponse.json([{ id: 'my-project-1', name: 'My Project' }]),
            ),
        );

        const { result } = renderHook(() => useProjectSelection({ isAdmin: false }));

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.errorMessage).toBeNull();
        expect(result.current.projects).toHaveLength(1);
        expect(result.current.selectedProjectId).toBe('my-project-1');
    });

    it('surfaces an error when the non-admin listing fails', async () => {
        server.use(
            http.get('/api/v1/users/me/projects', () => HttpResponse.error()),
        );

        const { result } = renderHook(() => useProjectSelection({ isAdmin: false }));

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.errorMessage).not.toBeNull();
        expect(result.current.projects).toHaveLength(0);
    });
});
