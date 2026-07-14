import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { TokensTab } from '../../../src/features/admin/components/TokensTab';

const githubServiceMock = vi.hoisted(() => ({
    addGithubPat: vi.fn(),
    updateGithubPat: vi.fn(),
    deleteGithubPat: vi.fn(),
}));

vi.mock('../../../src/services/sources/githubService', () => ({
    addGithubPat: githubServiceMock.addGithubPat,
    updateGithubPat: githubServiceMock.updateGithubPat,
    deleteGithubPat: githubServiceMock.deleteGithubPat,
}));

describe('TokensTab Accessibility', () => {
    it('has no axe violations in empty, add, and existing-token states', async () => {
        const user = userEvent.setup();
        const { baseElement, rerender } = render(
            <main>
                <TokensTab tokenNames={[]} onRefresh={vi.fn()} />
            </main>,
        );

        expect(await axe(baseElement)).toHaveNoViolations();

        await user.click(screen.getByRole('button', { name: 'Add Token' }));
        expect(screen.getByLabelText('Token name')).toBeInTheDocument();
        expect(await axe(baseElement)).toHaveNoViolations();

        rerender(
            <main>
                <TokensTab tokenNames={['default']} onRefresh={vi.fn()} />
            </main>,
        );
        expect(screen.getByText('default')).toBeInTheDocument();
        expect(await axe(baseElement)).toHaveNoViolations();
    });
});
