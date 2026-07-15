import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { MemoryRouter } from 'react-router-dom';
import { SelectionCheckbox } from '../../../src/features/admin/components/SelectionCheckbox';

describe('SelectionCheckbox Accessibility', () => {
    it('should not have any a11y violations', async () => {
        const { baseElement } = render(
            <MemoryRouter>
                <main>
                    <SelectionCheckbox
                        checked={false}
                        onChange={vi.fn()}
                        ariaLabel="Select user"
                    />
                </main>
            </MemoryRouter>
        );

        expect(screen.getByRole('checkbox', { name: 'Select user' })).toHaveAttribute('aria-checked', 'false');

        expect(await axe(baseElement)).toHaveNoViolations();
    });
});
