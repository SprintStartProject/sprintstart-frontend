import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { AlertDialog } from '../../../src/components/ui/AlertDialog';

describe('AlertDialog Accessibility', () => {
    it('should not have any a11y violations when open', async () => {
        // Modal usually mounts via portals to the body, so we check the baseElement or body
        const { baseElement } = render(
            <AlertDialog
                isOpen={true}
                title="Delete User"
                description="Are you sure you want to delete this user?"
                confirmLabel="Delete"
                cancelLabel="Cancel"
                variant="danger"
                onClose={vi.fn()}
                onConfirm={vi.fn()}
            />
        );
        const results = await axe(baseElement);
        expect(results).toHaveNoViolations();
    });
});
