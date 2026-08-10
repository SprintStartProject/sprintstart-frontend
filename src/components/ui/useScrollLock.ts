import { useLayoutEffect } from "react";

/**
 * Marks an element that scrolls instead of the document.
 *
 * Most pages let the document scroll, so locking `<body>` is enough. A page
 * that owns its scrolling — the Access Management page does, because its swipe
 * gesture needs a single element to listen on — is invisible to that lock: an
 * `overflow: hidden` on the body means nothing to a child with its own
 * `overflow-y: scroll`. Such a page carries this attribute, and the lock finds
 * it. One attribute beats threading a ref down through every dialog.
 */
export const SCROLL_CONTAINER_ATTRIBUTE = "data-scroll-container";

/** How many locks are held, so nested overlays release in the right order. */
let lockCount = 0;
let restoreStyles: (() => void) | null = null;

function lockElement(element: HTMLElement, scrollbarWidth: number): () => void {
    const previousOverflow = element.style.overflow;
    const previousPaddingRight = element.style.paddingRight;

    element.style.overflow = "hidden";

    if (scrollbarWidth > 0) {
        const current = parseFloat(window.getComputedStyle(element).paddingRight) || 0;
        element.style.paddingRight = `${current + scrollbarWidth}px`;
    }

    return () => {
        element.style.overflow = previousOverflow;
        element.style.paddingRight = previousPaddingRight;
    };
}

/**
 * Freezes the page behind an overlay while `locked` is true.
 *
 * Three things beyond `overflow: hidden`:
 *
 * - **Whatever actually scrolls gets locked** — the body, plus any element
 *   marked with {@link SCROLL_CONTAINER_ATTRIBUTE}.
 * - **The scrollbar's width is given back as padding.** Hiding the scrollbar
 *   widens the viewport, and without the compensation every fixed element jumps
 *   sideways the moment a dialog opens. On macOS, where scrollbars are overlays
 *   with no width, this is a no-op — it is for Windows and mice.
 * - **Locks are counted.** A dialog opened from inside another would otherwise
 *   unlock the page when the inner one closes, leaving the outer one floating
 *   over a scrolling background.
 *
 * Deliberately not `position: fixed` on the body: that technique loses the
 * scroll position and has to restore it by hand, which reads as a jump on every
 * close.
 */
export function useScrollLock(locked: boolean) {
    useLayoutEffect(() => {
        if (!locked) return;

        if (lockCount === 0) {
            const scrollbarWidth =
                window.innerWidth - document.documentElement.clientWidth;

            const restores = [lockElement(document.body, scrollbarWidth)];

            document
                .querySelectorAll<HTMLElement>(`[${SCROLL_CONTAINER_ATTRIBUTE}]`)
                .forEach((element) => {
                    // Its own scrollbar is inside the element, so it is measured
                    // on the element rather than on the viewport.
                    restores.push(
                        lockElement(element, element.offsetWidth - element.clientWidth),
                    );
                });

            restoreStyles = () => restores.forEach((restore) => restore());
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
