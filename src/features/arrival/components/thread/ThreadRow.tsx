import { AnimatePresence, motion, useDragControls } from "framer-motion";
import { StepRow } from "./StepRow";
import type { StepEntry } from "./threadRules";

/** Spring used for a row settling into its reordered slot. */
const LAYOUT_TRANSITION = { type: "spring", stiffness: 500, damping: 40, mass: 0.6 } as const;

type ThreadRowProps = {
  entry: StepEntry;
  readOnly: boolean;
  projectName: string | null;
  isDraggingThis: boolean;
  justDropped: boolean;
  prefersReducedMotion: boolean;
  registerElement: (element: HTMLElement | null) => void;
  onDragStart: () => void;
  onDrag: () => void;
  onDragEnd: () => void;
  onMove: (direction: "up" | "down") => void;
  onEdit: () => void;
};

/** One row of the thread: the number on the line, and the card beside it. */
export function ThreadRow({
  entry,
  readOnly,
  projectName,
  isDraggingThis,
  justDropped,
  prefersReducedMotion,
  registerElement,
  onDragStart,
  onDrag,
  onDragEnd,
  onMove,
  onEdit,
}: ThreadRowProps) {
  const dragControls = useDragControls();
  const draggable = !readOnly && !entry.replaced;

  return (
    <motion.li
      ref={registerElement}
      layout={!prefersReducedMotion}
      transition={LAYOUT_TRANSITION}
      drag={draggable ? "y" : false}
      dragListener={false}
      dragControls={dragControls}
      dragSnapToOrigin
      dragElastic={0}
      dragMomentum={false}
      onDragStart={onDragStart}
      onDrag={onDrag}
      onDragEnd={onDragEnd}
      className={`relative z-10 flex gap-3 ${isDraggingThis ? "z-20 cursor-grabbing" : ""}`}
      style={isDraggingThis ? { touchAction: "none" } : undefined}
    >
      <div className="relative flex w-8 shrink-0 items-center justify-center">
        <NumberBadge number={entry.number} prefersReducedMotion={prefersReducedMotion} />
      </div>

      <div className="min-w-0 flex-1">
        <StepRow
          step={entry.step}
          readOnly={readOnly}
          replaced={entry.replaced}
          isOverride={entry.isOverride}
          projectName={projectName}
          draggable={draggable}
          isDragging={isDraggingThis}
          justDropped={justDropped}
          canMoveUp={entry.canMoveUp}
          canMoveDown={entry.canMoveDown}
          onMove={onMove}
          onEdit={onEdit}
          onHandlePointerDown={(event) => dragControls.start(event)}
        />
      </div>
    </motion.li>
  );
}

/** The step's number, or a plain dot for a step the project replaced. */
function NumberBadge({
  number,
  prefersReducedMotion,
}: {
  number: number | null;
  prefersReducedMotion: boolean;
}) {
  if (number === null) {
    return <span aria-hidden="true" className="relative z-10 h-2 w-2 rounded-full bg-app-border" />;
  }

  return (
    <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 border-app-brand bg-app-surface text-sm font-bold text-app-brand-text">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={number}
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.7 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.7 }}
          transition={{ duration: 0.16, ease: [0.32, 0.72, 0, 1] }}
        >
          {number}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
