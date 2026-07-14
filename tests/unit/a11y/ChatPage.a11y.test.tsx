import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { MemoryRouter } from 'react-router-dom';
import { ChatPage } from '../../../src/pages/ChatPage';

window.HTMLElement.prototype.scrollIntoView = function() {};

vi.mock('../../../src/context/useAuth', () => ({
    useAuth: () => ({ profile: { firstName: 'Test', username: 'Test', email: 'test@test.com' } })
}));

describe('ChatPage Accessibility', () => {
    it('should not have any a11y violations', async () => {
        const { baseElement } = render(
            <MemoryRouter><main><ChatPage /></main></MemoryRouter>
        );

        expect(screen.getByRole('textbox', { name: 'Message' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Toggle sidebar' })).toHaveAttribute('aria-expanded', 'false');

        expect(await axe(baseElement)).toHaveNoViolations();
    });
});
