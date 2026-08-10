import { useLayoutEffect } from "react";

/** How many locks are currently held, so nested overlays release in order. */
let lockCount = 0;
let restoreStyles: (() => void) | null = null;

/**
 * Freezes the page behind an overlay while `locked` is true.
 *
 * Two things beyond `overflow: hidden`:
 *
 * - **The scrollbar's width is given back as padding.** Hiding the scrollbar
 *   narrows the viewport, and without the compensation every fixed header in
 *   the page jumps sideways the moment a dialog opens.
 * - **Locks are counted.** A dialog opened from inside another dialog would
 *   otherwise unlock the page when the inner one closes, leaving the outer one
 *   floating over a scrolling background.
 *
 * Deliberately not `position: fixed` on the body: that technique loses the
 * scroll position and has to restore it by hand, which reads as a jump on every
 * close.
 */
export function useScrollLock(locked: boolean) {
    useLayoutEffect(() => {
        if (!locked) return;

        if (lockCount === 0) {
            const { body } = document;
            const previousOverflow = body.style.overflow;
            const previousPaddingRight = body.style.paddingRight;

            const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

            body.style.overflow = "hidden";
            if (scrollbarWidth > 0) {
                const current = parseFloat(window.getComputedStyle(body).paddingRight) || 0;
                body.style.paddingRight = `${current + scrollbarWidth}px`;
            }

            restoreStyles = () => {
                body.style.overflow = previousOverflow;
                body.style.paddingRight = previousPaddingRight;
            };
        }

        lockCount += 1;

        return () => {
            lockCount -= 1;

            if (lockCount === 0) {
                restoreStyles?.();
                restoreStyles = null;
            }
        };
    }, [locked]);
}
