import { useEffect, useRef } from "react";

type RevealInput = {
  onToggleStack: ((rootId: string) => void) | undefined;
  elementOf: (cardId: string) => HTMLElement | undefined;
  expandedStackIds: ReadonlySet<string> | undefined;
  reduceMotion: boolean | null;
};

/**
 * Opens a pile because somebody clicked one of the cards behind the top one, and takes them to
 * it.
 *
 * Opening alone would be technically right and quietly wrong: a run of five unfolds into five
 * cards, and the one they actually asked about is somewhere in the middle of them. The scroll is
 * what makes clicking a named strip feel like following a link rather than like pressing
 * "expand".
 *
 * The card is not on the board yet when this runs — the pile opens through the page's state, so
 * the members mount on the render this click causes. The pending id carries the intention across to
 * the effect, which runs after that render has attached its refs.
 */
export function useRevealMember({
  onToggleStack,
  elementOf,
  expandedStackIds,
  reduceMotion,
}: RevealInput) {
  /**
   * A card the pile was opened *for*, to be brought into view once it is on the board.
   *
   * A ref rather than state: nothing renders from it, and setting state to schedule a scroll would
   * be a second render for something the DOM answers on its own.
   */
  const revealId = useRef<string | null>(null);

  // Keyed on the open piles: this runs on exactly the render that put the members on the board.
  useEffect(() => {
    const pending = revealId.current;
    revealId.current = null;
    if (pending === null) return;

    const element = elementOf(pending);
    if (!element) return;

    // After the paint, so the card is where it is going to be rather than where the layout
    // animation started it.
    const frame = requestAnimationFrame(() =>
      element.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" }),
    );

    return () => cancelAnimationFrame(frame);
  }, [elementOf, expandedStackIds, reduceMotion]);

  return (rootId: string, cardId: string) => {
    onToggleStack?.(rootId);
    revealId.current = cardId;
  };
}
