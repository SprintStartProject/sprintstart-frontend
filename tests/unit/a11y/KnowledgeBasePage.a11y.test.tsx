import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { MemoryRouter } from 'react-router-dom';
import { KnowledgeBasePage } from '../../../src/pages/KnowledgeBasePage';

vi.mock('../../../src/context/useAuth', () => ({
    useAuth: () => ({ profile: { id: 'user1', firstName: 'Test', username: 'Test', email: 'test@test.com' } })
}));

describe('KnowledgeBasePage Accessibility', () => {
    it('should not have any a11y violations', async () => {
        const { baseElement } = render(
            <MemoryRouter><KnowledgeBasePage /></MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Upload documentation or images' })).toBeInTheDocument();
        });

        expect(await axe(baseElement)).toHaveNoViolations();
    });
});
