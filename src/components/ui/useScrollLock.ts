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
  const initialScrollTop = element.scrollTop;

  element.style.overflow = "hidden";

  if (scrollbarWidth > 0) {
    const current = parseFloat(window.getComputedStyle(element).paddingRight) || 0;
    element.style.paddingRight = `${current + scrollbarWidth}px`;
  }

  return () => {
    element.style.overflow = previousOverflow;
    element.style.paddingRight = previousPaddingRight;
    if (element.scrollTop !== initialScrollTop) {
      element.scrollTop = initialScrollTop;
    }
  };
}

/**
 * Whether a scroll gesture starting at `target` has somewhere to go inside the
 * overlay, so the lock can let it through. Shared by the wheel and touch
 * handlers so the two cannot drift apart.
 *
 * - Walks up from `target` as an `Element`, not an `HTMLElement`: a gesture
 *   over an icon starts on an SVG node, which is no HTMLElement.
 * - Checks the axis the gesture mostly moves along. A sideways swipe over a
 *   wide `overflow-x-auto` code block needs a horizontally scrollable
 *   ancestor, not a vertical one — a short drawer has none of the latter.
 * - A container already at its edge in the gesture's direction does not
 *   count, so the scroll cannot chain out to the page behind.
 */
function canScrollFrom(target: EventTarget | null, deltaX: number, deltaY: number): boolean {
  const horizontal = Math.abs(deltaX) > Math.abs(deltaY);
  const delta = horizontal ? deltaX : deltaY;
  let node: Element | null = target instanceof Element ? target : null;

  while (node && node !== document.body && node !== document.documentElement) {
    const style = window.getComputedStyle(node);
    const overflow = horizontal ? style.overflowX : style.overflowY;
    const scrollSize = horizontal ? node.scrollWidth : node.scrollHeight;
    const clientSize = horizontal ? node.clientWidth : node.clientHeight;
    const position = horizontal ? node.scrollLeft : node.scrollTop;

    if ((overflow === "auto" || overflow === "scroll") && scrollSize > clientSize) {
      const isAtStart = position <= 0 && delta < 0;
      const isAtEnd = position + clientSize >= scrollSize - 1 && delta > 0;
      if (!isAtStart && !isAtEnd) return true;
    }
    node = node.parentElement;
  }
  return false;
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
 *
 * Note: the desktop sidebar uses `position: fixed` (not `sticky`) precisely
 * because locking `<html>` with `overflow: hidden` collapses its scroll
 * container, which would cause a `sticky` element to snap to document y=0
 * and disappear above the viewport. Fixed elements are immune to this because
 * they are positioned relative to the viewport, not any scroll container.
 */
export function useScrollLock(locked: boolean) {
  useLayoutEffect(() => {
    if (!locked) return;

    if (lockCount === 0) {
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      const initialScrollY = window.scrollY;

      const restores = [
        lockElement(document.documentElement, 0),
        lockElement(document.body, scrollbarWidth),
      ];

      restores.push(() => {
        if (window.scrollY !== initialScrollY) {
          window.scrollTo(0, initialScrollY);
        }
      });

      function handleWheel(event: WheelEvent) {
        // Ctrl+wheel and trackpad pinch are browser zoom, not scrolling:
        // blocking them would take zoom away while any panel is open.
        if (event.ctrlKey) return;
        if (!canScrollFrom(event.target, event.deltaX, event.deltaY)) {
          event.preventDefault();
        }
      }

      let touchStartX = 0;
      let touchStartY = 0;

      function handleTouchStart(event: TouchEvent) {
        if (event.touches.length > 0) {
          touchStartX = event.touches[0].clientX;
          touchStartY = event.touches[0].clientY;
        }
      }

      function handleTouchMove(event: TouchEvent) {
        // Two or more fingers is a pinch zoom — the touch twin of Ctrl+wheel.
        if (event.touches.length !== 1) return;
        const deltaX = touchStartX - event.touches[0].clientX;
        const deltaY = touchStartY - event.touches[0].clientY;
        if (!canScrollFrom(event.target, deltaX, deltaY)) {
          event.preventDefault();
        }
      }

      window.addEventListener("wheel", handleWheel, { passive: false });
      window.addEventListener("touchstart", handleTouchStart, { passive: true });
      window.addEventListener("touchmove", handleTouchMove, { passive: false });

      restores.push(() => {
        window.removeEventListener("wheel", handleWheel);
        window.removeEventListener("touchstart", handleTouchStart);
        window.removeEventListener("touchmove", handleTouchMove);
      });

      document
        .querySelectorAll<HTMLElement>(`[${SCROLL_CONTAINER_ATTRIBUTE}]`)
        .forEach((element) => {
          // Its own scrollbar is inside the element, so it is measured
          // on the element rather than on the viewport.
          restores.push(lockElement(element, element.offsetWidth - element.clientWidth));
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
