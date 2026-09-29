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
 */
export function useElementWidth<T extends HTMLElement>(): [RefCallback<T>, number] {
  const [width, setWidth] = useState(0);

  const ref = useCallback<RefCallback<T>>((element) => {
    if (!element) return;

    setWidth(element.clientWidth);

    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return [ref, width];
}
