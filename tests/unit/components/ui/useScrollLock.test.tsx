import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { useScrollLock } from '../../../../src/components/ui/useScrollLock';

function Locker({ locked = true }: { locked?: boolean }) {
    useScrollLock(locked);
    return null;
}

afterEach(() => {
    cleanup();
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
});

describe('useScrollLock', () => {
    it('freezes the page while locked and restores it afterwards', () => {
        const view = render(<Locker />);
        expect(document.body.style.overflow).toBe('hidden');

        view.unmount();
        expect(document.body.style.overflow).toBe('');
    });

    it('does nothing when not locked', () => {
        render(<Locker locked={false} />);
        expect(document.body.style.overflow).toBe('');
    });

    it('keeps the page frozen until the last of several overlays closes', () => {
        const outer = render(<Locker />);
        const inner = render(<Locker />);
        expect(document.body.style.overflow).toBe('hidden');

        // The inner overlay closing must not unlock the page — the outer one is
        // still open. This is the bug a naive implementation has.
        inner.unmount();
        expect(document.body.style.overflow).toBe('hidden');

        outer.unmount();
        expect(document.body.style.overflow).toBe('');
    });

    it('restores whatever overflow the page had before', () => {
        document.body.style.overflow = 'auto';

        const view = render(<Locker />);
        expect(document.body.style.overflow).toBe('hidden');

        view.unmount();
        expect(document.body.style.overflow).toBe('auto');
    });
});
