import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { MemoryRouter } from 'react-router-dom';
import { KnowledgeBasePage } from '../../../src/pages/KnowledgeBasePage';

vi.mock('../../../src/context/useAuth', () => ({
    useAuth: () => ({ profile: { id: 'user1', firstName: 'Test', username: 'Test', email: 'test@test.com', projectIds: ['proj1'] } })
}));

vi.mock('../../../src/services/knowledgeService', () => ({
    knowledgeService: {
        getUnifiedArtifacts: vi.fn().mockResolvedValue([]),
    },
}));

describe('KnowledgeBasePage Accessibility', () => {
    it('should not have any a11y violations', async () => {
        const { baseElement } = render(
            <MemoryRouter><KnowledgeBasePage /></MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Upload new artifact' })).toBeInTheDocument();
        });

        expect(await axe(baseElement)).toHaveNoViolations();
    });
});
