import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Field } from '../../../../src/components/ui/Field';
import { Input } from '../../../../src/components/ui/Input';
import { Textarea } from '../../../../src/components/ui/Textarea';
import { Select } from '../../../../src/components/ui/Select';

describe('Field', () => {
    it('binds the label to the control without the caller wiring an id', () => {
        render(
            <Field label="Token name">
                <Input />
            </Field>,
        );
        expect(screen.getByLabelText('Token name')).toBeInTheDocument();
    });

    it('uses a caller-provided controlId when one is given', () => {
        render(
            <Field label="Token name" controlId="fixed-id">
                <Input />
            </Field>,
        );
        expect(screen.getByLabelText('Token name')).toHaveAttribute('id', 'fixed-id');
    });

    it('describes the control with its hint', () => {
        render(
            <Field label="Token" hint="Stored encrypted.">
                <Input />
            </Field>,
        );
        expect(screen.getByLabelText('Token')).toHaveAccessibleDescription(
            'Stored encrypted.',
        );
    });

    it('marks the control invalid and announces the error', () => {
        render(
            <Field label="Token" error="Token is required.">
                <Input />
            </Field>,
        );
        const control = screen.getByLabelText('Token');
        expect(control).toHaveAttribute('aria-invalid', 'true');
        expect(control).toHaveAccessibleDescription('Token is required.');
        expect(screen.getByRole('alert')).toHaveTextContent('Token is required.');
    });

    it('describes the control with hint and error together', () => {
        render(
            <Field label="Token" hint="Stored encrypted." error="Too short.">
                <Input />
            </Field>,
        );
        expect(screen.getByLabelText('Token')).toHaveAccessibleDescription(
            'Stored encrypted. Too short.',
        );
    });

    it('is not invalid when there is no error', () => {
        render(
            <Field label="Token">
                <Input />
            </Field>,
        );
        expect(screen.getByLabelText('Token')).not.toHaveAttribute('aria-invalid');
    });

    it('passes disabled down without the caller repeating it on the control', () => {
        render(
            <Field label="Token" disabled>
                <Input />
            </Field>,
        );
        expect(screen.getByLabelText('Token')).toBeDisabled();
    });

    it('wires Textarea and Select the same way as Input', () => {
        const { unmount } = render(
            <Field label="Description" error="Required.">
                <Textarea />
            </Field>,
        );
        expect(screen.getByLabelText('Description')).toHaveAttribute(
            'aria-invalid',
            'true',
        );
        unmount();

        render(
            <Field label="Manager" error="Required.">
                <Select>
                    <option value="">None</option>
                </Select>
            </Field>,
        );
        expect(screen.getByLabelText('Manager')).toHaveAttribute(
            'aria-invalid',
            'true',
        );
    });
});

describe('Textarea', () => {
    it('grows by default, so no drag handle is offered', () => {
        render(<Textarea aria-label="Description" />);
        const control = screen.getByLabelText('Description');
        expect(control.className).toContain('resize-none');
        expect(control.className).not.toContain('resize-y');
    });

    it('offers a drag handle when growing is switched off', () => {
        render(<Textarea aria-label="Description" autoResize={false} />);
        expect(screen.getByLabelText('Description').className).toContain('resize-y');
    });

    it('starts at minRows', () => {
        render(<Textarea aria-label="Description" minRows={4} />);
        expect(screen.getByLabelText('Description')).toHaveAttribute('rows', '4');
    });
});

describe('Input', () => {
    it('works standalone, without a Field around it', () => {
        render(<Input aria-label="Search" placeholder="Search…" />);
        expect(screen.getByLabelText('Search')).toBeInTheDocument();
    });

    it('keeps the leading icon out of the accessibility tree', () => {
        render(
            <Input
                aria-label="Search"
                icon={<svg data-testid="icon" />}
            />,
        );
        expect(screen.getByTestId('icon').closest('[aria-hidden="true"]')).not.toBeNull();
    });

    it('carries the shared focus ring token', () => {
        render(<Input aria-label="Search" />);
        expect(screen.getByLabelText('Search').className).toContain(
            'focus:ring-app-focus',
        );
    });
});
