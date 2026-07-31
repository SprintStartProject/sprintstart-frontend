import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { DetailsSideDrawer } from '../../../../src/components/layout/DetailsSideDrawer';

describe('DetailsSideDrawer', () => {
    // The slide itself is an inline transform written by Framer Motion, which
    // is stubbed out in the test setup. What stays assertable -- and is what
    // actually matters for correctness -- is that a closed drawer is hidden
    // from assistive tech and taken out of the tab flow.
    it('exposes the drawer only while it is open', () => {
        const { rerender } = render(
            <DetailsSideDrawer isOpen={true} onClose={vi.fn()} title="Drawer Title" leading={<span>Leading</span>}>
                <p>Drawer Content</p>
            </DetailsSideDrawer>,
        );

        expect(screen.getByText('Drawer Title')).toBeInTheDocument();

        const drawer = screen.getByText('Drawer Title').closest('[role="dialog"]');
        expect(drawer).toHaveAttribute('aria-hidden', 'false');
        expect(drawer).not.toHaveAttribute('inert');

        rerender(
            <DetailsSideDrawer isOpen={false} onClose={vi.fn()} title="Drawer Title" leading={<span>Leading</span>}>
                <p>Drawer Content</p>
            </DetailsSideDrawer>,
        );

        expect(drawer).toHaveAttribute('aria-hidden', 'true');
        expect(drawer).toHaveAttribute('inert');
    });

    it('fires onClose when the X button is clicked', async () => {
        const user = userEvent.setup();
        const onCloseMock = vi.fn();
        render(
            <DetailsSideDrawer
                isOpen={true}
                onClose={onCloseMock}
                title="Close Test"
                leading={<span>Leading</span>}
                closeAriaLabel="Close Me"
            >
                <p>Content</p>
            </DetailsSideDrawer>,
        );

        await user.click(screen.getByLabelText('Close Me'));
        expect(onCloseMock).toHaveBeenCalledOnce();
    });
});
