import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { ThemeToggle } from '../../../src/components/common/ThemeToggle';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../../src/context/useTheme', () => ({
    useTheme: () => ({
        isDarkMode: false,
        toggleTheme: vi.fn()
    })
}));

describe('ThemeToggle Accessibility', () => {
    it('should not have any a11y violations', async () => {
        const { baseElement } = render(
            <MemoryRouter>
                <main>
                    <ThemeToggle />
                </main>
            </MemoryRouter>
        );
        expect(await axe(baseElement)).toHaveNoViolations();
    });
});
