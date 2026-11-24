import { Children, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Layers } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { centralSpringToken } from "../../../styles/tokens";
import type { CardStack } from "../layout/cardStacks";

type ExpandedStackProps = {
  stack: CardStack;
  /** Puts the pile back together. Absent on a board whose stacks cannot be opened. */
  onCollapse?: () => void;
  children: ReactNode;
};

/**
 * A sequence that has been spread out, held together so it still reads as one.
 *
 * The point of opening a pile is seeing the run — which the layout would take straight back if the
 * cards were released into the packing: two columns and a greedy pass would deal the third card
 * beside the first and put somebody else's note between them. So the run keeps one slot and lays
 * its cards out inside it, in the order they are meant to be worked, and stays inside whatever area
 * it was filed in.
 *
 * Numbered down the left, because that is the one thing a spread-out sequence stops saying for
 * itself: closed, the pile *was* the claim that these come in an order; open, the cards look like
 * any other cards under each other.
 *
 * Quieter than an area's frame on purpose — dashed, untinted. An area is somewhere the hire filed
 * things; this is a pile they happen to have open, and it closes again the moment they look
 * elsewhere.
 */
export function ExpandedStack({ stack, onCollapse, children }: ExpandedStackProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      // `layout` so the frame grows and shrinks with what is in it rather than jumping to its
      // final height. Safe here in a way it is not around a card: nothing inside this is a drag
      // target, so there is no hit-test being measured mid-animation.
      layout
      initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{
        opacity: 0,
        ...(reduceMotion ? {} : { scale: 0.98 }),
        transition: { duration: 0.12, ease: "easeIn" },
      }}
      transition={centralSpringToken}
      aria-label={`Sequence of ${stack.memberIds.length} cards`}
      // Read by the click-away handler: a press on this frame's header, padding or numbers is a
      // press *on the open pile*, not away from it. Without it, "Put back" would be caught as a
      // click outside, close the pile, and then have its own handler open it straight back up.
      data-stack-root={stack.rootId}
      className="rounded-2xl border border-dashed border-app-border bg-app-surface-muted/40 p-3"
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-app-text-muted">
          <Layers className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">
            {stack.memberIds.length} cards, in order · {stack.remaining} still to do
          </span>
        </span>

        {onCollapse && (
          <Button variant="ghost" size="sm" onClick={onCollapse}>
            Put back
          </Button>
        )}
      </header>

      {/* Numbered so the order survives being spread out. `tabular-nums` keeps a two-digit step
          from shifting its card a pixel left of the one above it. */}
      {/* The cards arrive one after another rather than all at once. Four appearing on the same
          frame is a pop; the same four arriving down the list is a pile being dealt out, which is
          what just happened. 45ms apart — enough to read as a sequence, short enough that the last
          one is not still on its way when the eye gets there. */}
      <ol className="space-y-4">
        {Children.map(children, (child, index) => (
          <motion.li
            initial={reduceMotion ? false : { opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...centralSpringToken, delay: reduceMotion ? 0 : index * 0.045 }}
            className="flex min-w-0 items-start gap-2"
          >
            <span className="mt-4 w-4 shrink-0 text-right text-xs text-app-text-subtle tabular-nums">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">{child}</div>
          </motion.li>
        ))}
      </ol>
    </motion.section>
  );
}
