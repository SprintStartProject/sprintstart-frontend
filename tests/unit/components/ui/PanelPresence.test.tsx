import { act, render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PanelPresence } from '../../../../src/components/ui/PanelPresence';
import { SIDE_PANEL_SLIDE_MS } from '../../../../src/styles/tokens';
import { SidePanel } from '../../../../src/components/ui/SidePanel';

/**
 * Detail panels are rendered as `{selected && <Panel />}`, which used to make an
 * exit animation impossible -- clearing the selection unmounted the panel in the
 * same commit, so there was nothing left to animate. These tests pin the
 * retention behaviour that makes the slide-out possible.
 */
describe('PanelPresence', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    function renderWithValue(value: { id: string } | null) {
        return (
            <PanelPresence value={value}>
                {(item) => (
                    <SidePanel isOpen onClose={vi.fn()} title={`Panel ${item.id}`}>
                        <p>Panel body</p>
                    </SidePanel>
                )}
            </PanelPresence>
        );
    }

    it('keeps the panel mounted and slides it out after the value is cleared', () => {
        const { rerender, baseElement } = render(renderWithValue({ id: 'a' }));
        // Queried through the DOM rather than by role: a closing panel is
        // `aria-hidden`, so it is deliberately absent from the a11y tree while
        // it animates away.
        const findPanel = () => baseElement.querySelector('[role="dialog"]');

        expect(findPanel()).toHaveAttribute('aria-hidden', 'false');

        rerender(renderWithValue(null));

        // Still in the DOM, but now travelling back off-screen. The transform
        // itself is written inline by Framer Motion, which is stubbed out in
        // tests -- `aria-hidden` is the observable half of the closing state.
        expect(findPanel()).toHaveAttribute('aria-hidden', 'true');
        expect(screen.getByText('Panel body')).toBeInTheDocument();

        act(() => {
            vi.advanceTimersByTime(SIDE_PANEL_SLIDE_MS + 100);
        });

        expect(findPanel()).toBeNull();
    });

    it('cancels the pending unmount when the panel is reopened mid-slide', () => {
        const { rerender } = render(renderWithValue({ id: 'a' }));

        rerender(renderWithValue(null));
        act(() => {
            vi.advanceTimersByTime(SIDE_PANEL_SLIDE_MS / 2);
        });

        rerender(renderWithValue({ id: 'b' }));
        act(() => {
            vi.advanceTimersByTime(SIDE_PANEL_SLIDE_MS + 100);
        });

        const panel = screen.getByRole('dialog');
        expect(panel).toHaveAttribute('aria-hidden', 'false');
        expect(screen.getByRole('heading', { name: 'Panel b' })).toBeInTheDocument();
    });

    it('renders nothing while there is no value at all', () => {
        render(renderWithValue(null));

        act(() => {
            vi.advanceTimersByTime(SIDE_PANEL_SLIDE_MS + 100);
        });

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});
