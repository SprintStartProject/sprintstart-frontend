import { useCallback, useEffect, useRef } from "react";

/** How close to the bottom still counts as "reading the newest message", in px. */
const STICK_THRESHOLD_PX = 120;

/**
 * Keeps a scrolling transcript pinned to its newest message.
 *
 * Each surface gets its own, and that is the point. The conversation used to expose a single
 * `bottomRef` from the shared session, which the dock and the page both attached to their own
 * sentinel `div` — one ref object, two elements. React nulls a ref when its element unmounts,
 * so closing the dock (or navigating to `/buddy`, which unmounts it) could clear the ref the
 * page had just claimed, and the page then never scrolled again. Two views of one conversation
 * may share the messages; they cannot share a pointer to a DOM node.
 *
 * It scrolls the container directly rather than calling `scrollIntoView` on a sentinel. The
 * transcript grows one token at a time, and a smooth `scrollIntoView` restarted on every token
 * spends its life cancelling its own animation — which looks exactly like not scrolling at all.
 * Setting `scrollTop` is instant and cannot fall behind.
 *
 * **It follows, it does not drag.** Scrolling up to re-read something releases the pin, and
 * coming back within {@link STICK_THRESHOLD_PX} of the bottom takes it again. Without that, a
 * hire reading an earlier answer is yanked to the newest one every time a token lands.
 *
 * @param dependency Changes whenever the transcript grows — the message list.
 */
export function useStickToBottom(dependency: unknown) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Starts pinned: a conversation opens at its newest message.
  const isPinned = useRef(true);

  const onScroll = useCallback(() => {
    const element = containerRef.current;
    if (!element) return;
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    isPinned.current = distanceFromBottom <= STICK_THRESHOLD_PX;
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || !isPinned.current) return;
    element.scrollTop = element.scrollHeight;
  }, [dependency]);

  return { containerRef, onScroll };
}
