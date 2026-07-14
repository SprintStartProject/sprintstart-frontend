import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { MemoryRouter } from 'react-router-dom';
import { TokensTab } from '../../../src/features/admin/components/TokensTab';

vi.mock('../../../src/services/sources/githubService', () => ({
    addGithubPat: vi.fn().mockResolvedValue(undefined),
    updateGithubPat: vi.fn().mockResolvedValue(undefined),
    deleteGithubPat: vi.fn().mockResolvedValue(undefined)
}));

describe('TokensTab Accessibility', () => {
    it('should not have any a11y violations', async () => {
        const { baseElement } = render(
            <MemoryRouter>
                <main>
                    <TokensTab
                        tokenNames={['default', 'ci']}
                        onRefresh={vi.fn()}
                    />
                </main>
            </MemoryRouter>
        );

        expect(screen.getByRole('button', { name: 'Add Token' })).toBeInTheDocument();
        expect(screen.getAllByRole('button', { name: 'Rotate' })).toHaveLength(2);

        expect(await axe(baseElement)).toHaveNoViolations();
    });
});
