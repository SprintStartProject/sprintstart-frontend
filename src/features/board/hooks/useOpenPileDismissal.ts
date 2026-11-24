import { useEffect } from "react";
import { KEEPS_PILES_OPEN } from "../components/interactiveSelectors";

/** The root of the open pile a press landed in, or null when it landed in none. */
function pileRootOf(target: Element | null): string | null {
  return target?.closest("[data-stack-root]")?.getAttribute("data-stack-root") ?? null;
}

type Dismissal = {
  isArranging: boolean;
  expandedStackIds: ReadonlySet<string> | undefined;
  onToggleStack: ((rootId: string) => void) | undefined;
};

/**
 * Closes an open pile as soon as attention moves off it.
 *
 * Opening a stack is looking into something, not rearranging the board — so it should end the way
 * looking into something ends, by looking somewhere else. Without this, spreading out three
 * sequences to check them leaves three sequences spread out, and the hire has to go back and put
 * each one away by hand, which is exactly the tidying the stacks existed to save.
 *
 * Hit-tested against the card elements the grid already registers rather than against a wrapper,
 * because "outside the stack" includes *other cards*: clicking the next card along should put the
 * pile away and act on that card, not just the second of those.
 *
 * On `pointerdown` rather than `click`, so it lands before the card's own handler — a click on
 * another stack's top card closes this one and opens that one, in that order, rather than the two
 * fighting over the same event.
 *
 * Off entirely while the board is being arranged: arranging deliberately opens every stack, and a
 * press on the background to start a drag would otherwise fold them all away mid-gesture.
 */
export function useOpenPileDismissal({ isArranging, expandedStackIds, onToggleStack }: Dismissal) {
  useEffect(() => {
    if (isArranging || !onToggleStack) return;
    if (!expandedStackIds || expandedStackIds.size === 0) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target instanceof Element ? event.target : null;
      // Floating controls acting on what is in the pile — the highlighter's toolbar, the colour
      // popover, a menu or dialog — are not looking elsewhere.
      if (target?.closest(KEEPS_PILES_OPEN)) return;
      const insideRoot = pileRootOf(target);

      for (const rootId of expandedStackIds ?? []) {
        if (rootId !== insideRoot) onToggleStack?.(rootId);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [expandedStackIds, isArranging, onToggleStack]);
}
