import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { axe } from 'vitest-axe';
import { Badge } from '../../../src/components/ui/Badge';

describe('Badge Accessibility', () => {
    it('should not have any a11y violations in its default state', async () => {
        const { container } = render(<Badge>Status OK</Badge>);
        const results = await axe(container);
        expect(results).toHaveNoViolations();
    });

    it('should not have any a11y violations with success variant', async () => {
        const { container } = render(<Badge variant="success">Completed</Badge>);
        const results = await axe(container);
        expect(results).toHaveNoViolations();
    });
});
