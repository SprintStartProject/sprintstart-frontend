import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoginPage } from '../../../src/pages/LoginPage';

const mockLogin = vi.fn();

vi.mock('../../../src/context/useAuth', () => ({
    useAuth: () => ({ login: mockLogin, status: 'authenticated' }),
}));

vi.mock('../../../src/components/common/ThemeToggle', () => ({
    ThemeToggle: () => <button aria-label="Toggle light and dark mode">Theme</button>,
}));

describe('LoginPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the SprintStart branding and sign-in button', () => {
        render(<LoginPage />);
        expect(screen.getByText('SprintStart')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Sign in with SSO/i })).toBeInTheDocument();
    });

    it('calls login when the sign-in button is clicked', async () => {
        const user = userEvent.setup();
        render(<LoginPage />);
        await user.click(screen.getByRole('button', { name: /Sign in with SSO/i }));
        expect(mockLogin).toHaveBeenCalledTimes(1);
    });
});
