import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { MemoryRouter } from 'react-router-dom';
import { EditableSelectDetailRow } from '../../../src/features/admin/components/EditableSelectDetailRow';

describe('EditableSelectDetailRow Accessibility', () => {
    it('should not have any a11y violations', async () => {
        const { baseElement } = render(
            <MemoryRouter>
                <main>
                    <EditableSelectDetailRow
                        label="Role"
                        value="Admin"
                        onChange={vi.fn()}
                        options={['Admin', 'User', 'Project Manager']}
                    />
                </main>
            </MemoryRouter>
        );

        expect(screen.getByRole('button', { name: /Admin/ })).toHaveAttribute('aria-haspopup', 'listbox');

        expect(await axe(baseElement)).toHaveNoViolations();
    });
});
