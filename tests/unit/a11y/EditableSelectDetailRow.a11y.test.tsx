import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { EditableSelectDetailRow } from '../../../src/features/admin/components/EditableSelectDetailRow';

describe('EditableSelectDetailRow Accessibility', () => {
    it('has no axe violations and exposes its label to the trigger', async () => {
        const user = userEvent.setup();
        const { baseElement } = render(
            <main>
                <EditableSelectDetailRow
                    label="Role"
                    value="User"
                    options={['Admin', 'User']}
                    onChange={vi.fn()}
                />
            </main>,
        );

        const trigger = screen.getByRole('button', { name: 'Role' });
        await user.click(trigger);

        expect(screen.getByRole('listbox')).toBeInTheDocument();
        expect(await axe(baseElement)).toHaveNoViolations();
    });
});
