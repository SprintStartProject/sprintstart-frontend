import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditableDetailRow } from '../../../../../src/features/admin/components/EditableDetailRow';

describe('EditableDetailRow', () => {
    const defaultProps = {
        label: 'Email',
        value: 'user@example.com',
        onChange: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders a label associated with the input', () => {
        render(<EditableDetailRow {...defaultProps} />);
        const input = screen.getByLabelText('Email');
        expect(input).toBeInTheDocument();
        expect(input).toHaveValue('user@example.com');
    });

    it('renders a text input by default', () => {
        render(<EditableDetailRow {...defaultProps} />);
        expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'text');
    });

    it('renders an email input when type is email', () => {
        render(<EditableDetailRow {...defaultProps} type="email" />);
        expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email');
    });

    it('fires onChange with the new value when typing', async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();
        render(<EditableDetailRow {...defaultProps} onChange={onChange} />);

        const input = screen.getByLabelText('Email');
        await user.type(input, 'x');

        expect(onChange).toHaveBeenLastCalledWith('user@example.comx');
    });

    it('fires onChange with an empty string when the field is cleared', async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();
        render(<EditableDetailRow {...defaultProps} onChange={onChange} />);

        await user.clear(screen.getByLabelText('Email'));

        expect(onChange).toHaveBeenLastCalledWith('');
    });

    it('passes the autoComplete attribute through to the input', () => {
        render(
            <EditableDetailRow {...defaultProps} autoComplete="email" />,
        );
        expect(screen.getByLabelText('Email')).toHaveAttribute(
            'autocomplete',
            'email',
        );
    });
});
