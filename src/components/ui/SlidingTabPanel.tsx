import { useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";

/** How far the panel travels, in pixels. */
const SLIDE_DISTANCE = 24;

const variants: Variants = {
    enter: (direction: number) => ({ x: direction * SLIDE_DISTANCE, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (direction: number) => ({ x: direction * -SLIDE_DISTANCE, opacity: 0 }),
};

type SlidingTabPanelProps = {
    /** Identifies the active panel; a change swaps the content. */
    activeKey: string;
    /** Position of the active tab, used to work out which way to travel. */
    index: number;
    children: ReactNode;
    className?: string;
};

/**
 * Slides tab content in from the side the user is moving towards, instead of
 * swapping it instantly.
 *
 * Direction is derived from the tab index, so moving right sends the old panel
 * out to the left and brings the new one in from the right, and vice versa.
 * That directional cue is the whole point: a symmetrical fade would leave the
 * navigation pill sliding one way while the content appears from nowhere.
 *
 * Uses `mode="wait"` so the outgoing panel is gone before the incoming one
 * arrives -- overlapping two panels of different heights makes the page jump.
 */
export function SlidingTabPanel({
    activeKey,
    index,
    children,
    className,
}: SlidingTabPanelProps) {
    const prefersReducedMotion = useReducedMotion();
    const [previousIndex, setPreviousIndex] = useState(index);
    const [direction, setDirection] = useState(1);

    // Derived during render rather than in an effect, so the direction is
    // already correct on the render that swaps the content.
    if (index !== previousIndex) {
        setDirection(index > previousIndex ? 1 : -1);
        setPreviousIndex(index);
    }

    return (
        <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
                key={activeKey}
                custom={direction}
                variants={prefersReducedMotion ? undefined : variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
                className={className}
            >
                {children}
            </motion.div>
        </AnimatePresence>
    );
}
