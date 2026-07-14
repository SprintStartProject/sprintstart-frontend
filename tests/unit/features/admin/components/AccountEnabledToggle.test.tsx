import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccountEnabledToggle } from '../../../../../src/features/admin/components/AccountEnabledToggle';

describe('AccountEnabledToggle', () => {
    const defaultProps = {
        enabled: false,
        disabled: false,
        onChange: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders a switch role with an accessible label', () => {
        render(<AccountEnabledToggle {...defaultProps} />);
        expect(
            screen.getByRole('switch', { name: 'Toggle account access' }),
        ).toBeInTheDocument();
    });

    it('reflects aria-checked based on the enabled prop', () => {
        const { rerender } = render(<AccountEnabledToggle {...defaultProps} enabled={true} />);
        expect(
            screen.getByRole('switch', { name: 'Toggle account access' }),
        ).toHaveAttribute('aria-checked', 'true');

        rerender(<AccountEnabledToggle {...defaultProps} enabled={false} />);
        expect(
            screen.getByRole('switch', { name: 'Toggle account access' }),
        ).toHaveAttribute('aria-checked', 'false');
    });

    it('calls onChange with the inverted value when clicked', async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();
        render(
            <AccountEnabledToggle
                {...defaultProps}
                enabled={false}
                onChange={onChange}
            />,
        );

        await user.click(screen.getByRole('switch', { name: 'Toggle account access' }));
        expect(onChange).toHaveBeenCalledWith(true);
    });

    it('calls onChange with false when clicking an enabled toggle', async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();
        render(
            <AccountEnabledToggle
                {...defaultProps}
                enabled={true}
                onChange={onChange}
            />,
        );

        await user.click(screen.getByRole('switch', { name: 'Toggle account access' }));
        expect(onChange).toHaveBeenCalledWith(false);
    });

    it('does not fire onChange and renders disabled when disabled is true', async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();
        render(
            <AccountEnabledToggle
                {...defaultProps}
                disabled={true}
                onChange={onChange}
            />,
        );

        const toggle = screen.getByRole('switch', { name: 'Toggle account access' });
        expect(toggle).toBeDisabled();

        await user.click(toggle);
        expect(onChange).not.toHaveBeenCalled();
    });
});
