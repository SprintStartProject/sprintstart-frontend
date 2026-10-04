import { useCallback, useState, type RefCallback } from "react";

/**
 * The content-box width of an element, kept current as it resizes.
 *
 * For layout decisions a CSS container query cannot make on its own — typically choosing what
 * to *render* rather than how to style it — where the window's width is the wrong question
 * because a sidebar, a rail or the page gutter decide how much of it the element gets.
 *
 * Returns a callback ref and the width. The ref measures the moment the element is attached,
 * which is during commit and so before paint: a component that picks its content from the
 * width does not flash the wrong form first. `0` until then (and in jsdom, which has no layout).
 *
 * The content box, padding excluded, at the first measurement as at every later one — the same box
 * `ResizeObserver`'s `contentRect` reports and a CSS container query sizes against.
 *
 * Needs React 19: the observer is disconnected by the cleanup the callback ref returns, and React
 * 18 ignores a ref callback's return value, so there it would leak an observer per mount.
 */
export function useElementWidth<T extends HTMLElement>(): [RefCallback<T>, number] {
  const [width, setWidth] = useState(0);

  const ref = useCallback<RefCallback<T>>((element) => {
    if (!element) return;

    const style = getComputedStyle(element);
    setWidth(
      element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) || 0,
    );

    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return [ref, width];
}
