import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditableSelectDetailRow } from '../../../../../src/features/admin/components/EditableSelectDetailRow';

describe('EditableSelectDetailRow', () => {
    const options = ['Admin', 'User', 'Project Manager'];
    const defaultProps = {
        label: 'Permission group',
        value: 'User',
        onChange: vi.fn(),
        options,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders collapsed with aria-expanded false and no listbox', () => {
        render(<EditableSelectDetailRow {...defaultProps} />);

        const combobox = screen.getByRole('button', { name: 'User' });
        expect(combobox).toHaveAttribute('aria-expanded', 'false');
        expect(combobox).toHaveAttribute('aria-haspopup', 'listbox');
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('opens the listbox on click and sets aria-expanded true', async () => {
        const user = userEvent.setup();
        render(<EditableSelectDetailRow {...defaultProps} />);

        await user.click(screen.getByRole('button', { name: 'User' }));

        expect(screen.getByRole('listbox')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'User' })).toHaveAttribute(
            'aria-expanded',
            'true',
        );
        expect(screen.getAllByRole('option')).toHaveLength(options.length);
    });

    it('marks the selected option with aria-selected', async () => {
        const user = userEvent.setup();
        render(<EditableSelectDetailRow {...defaultProps} />);

        await user.click(screen.getByRole('button', { name: 'User' }));

        const selectedOption = screen.getByRole('option', { name: 'User' });
        expect(selectedOption).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByRole('option', { name: 'Admin' })).toHaveAttribute(
            'aria-selected',
            'false',
        );
    });

    it('calls onChange and closes the dropdown when an option is selected', async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();
        render(<EditableSelectDetailRow {...defaultProps} onChange={onChange} />);

        await user.click(screen.getByRole('button', { name: 'User' }));
        await user.click(screen.getByRole('option', { name: 'Admin' }));

        expect(onChange).toHaveBeenCalledWith('Admin');
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('closes the dropdown when clicking outside', async () => {
        const user = userEvent.setup();
        render(<EditableSelectDetailRow {...defaultProps} />);

        await user.click(screen.getByRole('button', { name: 'User' }));
        expect(screen.getByRole('listbox')).toBeInTheDocument();

        await user.click(screen.getByText('Permission group'));
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
});
