import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { ROW_UNIT } from "../layout/gridBlocks";
import { centralSpringToken } from "../../../styles/tokens";

type GridBlockProps = {
  /** How many of the grid's columns this block takes. */
  span: number;
  /** The grid's gap, which the row maths has to agree with. */
  gap: number;
  /** Whether the reader asked for less motion, which the arrival and exit honour. */
  reduceMotion: boolean;
  children: ReactNode;
};

/**
 * One block in the board's grid: as wide as it was told, and as tall as it turns out to be.
 *
 * **Measured, not estimated.** A card can be one column, two, or four, and a grid places things in
 * rows, so a row is only as honest as the height it was given: the block asks the browser how tall
 * it actually is and claims that many of the grid's small rows. A wrong answer here is cards
 * overlapping.
 *
 * The `ResizeObserver` is what keeps it right afterwards: a checklist that is ticked, a card that
 * is folded, a band that opens — all of them change a height without changing anything this
 * component is passed, and all of them would otherwise leave the grid holding the old number.
 */
export function GridBlock({ span, gap, reduceMotion, children }: GridBlockProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState(1);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // No first measurement of our own: `ResizeObserver` reports the initial size as soon as it
    // observes, so calling it here as well would be a second render for the same number.
    const observer = new ResizeObserver(([entry]) => {
      // The *layout* height, never `getBoundingClientRect()`.
      //
      // This block is a motion element that arrives at `scale: 0.97` and animates to 1, and a
      // bounding rect is the drawn size — so a first measurement that lands while that animation is
      // still running reports the block three percent short. Nothing corrects it afterwards either:
      // a transform does not change the border box, so the observer never fires again, and the
      // block keeps a row count taken from a frame it was mid-animation in.
      //
      // Which is exactly the shape of the bug people saw — cards overlapping *sometimes*, depending
      // on how wide the board was and how much else was arriving at the same moment.
      // `borderBoxSize` is the geometry the grid actually places against, and it is blind to
      // transforms.
      const height =
        entry?.borderBoxSize?.[0]?.blockSize ??
        (element as HTMLElement).offsetHeight ??
        element.getBoundingClientRect().height;

      setRows(Math.max(1, Math.ceil((height + gap) / (ROW_UNIT + gap))));
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, [gap]);

  return (
    // The animation lives here rather than one level in, because `AnimatePresence` can only hold a
    // block back long enough to fade it if the block it is holding is a motion element.
    <motion.div
      style={{ gridColumn: `span ${span}`, gridRow: `span ${rows}` }}
      initial={reduceMotion ? false : { opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      // Quick and its own transition: a leaving block is out of the flow already, and a
      // spring-length exit would leave it fading over whatever moved into its place.
      exit={{
        opacity: 0,
        ...(reduceMotion ? {} : { scale: 0.97 }),
        transition: { duration: 0.12, ease: "easeIn" },
      }}
      transition={centralSpringToken}
    >
      {/* Deliberately not stretched to the grid row: a measurement that read back the height the
          grid gave it would be measuring its own answer. */}
      <div ref={ref}>{children}</div>
    </motion.div>
  );
}
