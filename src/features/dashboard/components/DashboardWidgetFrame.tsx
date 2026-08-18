import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, GripVertical, X } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { FilterSelect } from "../../../components/ui/FilterSelect";
import { SpotlightCard } from "../../../components/ui/SpotlightCard";
import { centralSpringToken } from "../../../styles/tokens";
import { DASHBOARD_SIZE_LABELS, dashboardCellClass } from "../layout/sizes";
import type {
  DashboardWidgetDefinition,
  DashboardWidgetId,
  DashboardWidgetSize,
} from "../layout/types";

/**
 * The tilt that says "this can be moved".
 *
 * Under a degree, and every card starts at a different point in the cycle, so the board
 * shimmers rather than pulsing in lockstep. It stops the moment the pointer is over a card:
 * a moving target is hard to aim a 36px button at, and the card is already saying it can be
 * moved by the time you have reached it.
 */
const WIGGLE = { rotate: [-0.55, 0.55, -0.55] };

export type DashboardWidgetFrameProps = {
  definition: DashboardWidgetDefinition;
  size: DashboardWidgetSize;
  /** Position in the layout, and how many there are — the move buttons need both ends. */
  index: number;
  total: number;
  isEditing: boolean;
  isDragging: boolean;
  onRemove: (id: DashboardWidgetId) => void;
  onResize: (id: DashboardWidgetId, size: DashboardWidgetSize) => void;
  onMoveBy: (id: DashboardWidgetId, offset: number) => void;
  onDragStart: (id: DashboardWidgetId) => void;
  /** Reports that the card has moved, so the grid can decide what it is being dropped on. */
  onDrag: (id: DashboardWidgetId) => void;
  onDragEnd: () => void;
  /** Lets the grid measure this cell while a drag is looking for what is under the pointer. */
  registerElement: (id: DashboardWidgetId, element: HTMLDivElement | null) => void;
};

/**
 * One cell of the dashboard: the widget, plus everything the edit mode adds around it.
 *
 * The widget itself never learns it is being edited — it renders exactly as it does on a
 * finished dashboard, with pointer events switched off so a card that is normally a link does
 * not navigate when it is being dragged. Everything editable lives in this frame, which is
 * what keeps the eleven widgets from each needing an edit mode of their own.
 *
 * **Two nested motion elements, deliberately.** The outer one is the grid cell: it does
 * `layout` and `drag`, and Framer measures it. The inner one carries the decoration — the
 * wiggle's rotation and the lift while dragging. They were on the same element until a card
 * kept coming back about 3% larger from every drag: `whileDrag`'s scale and the wiggle's
 * rotation both change an element's measured box, and a layout projection measured against a
 * scaled or rotated box stays wrong until the element is remounted. Decoration on a child
 * Framer does not measure cannot poison the measurement.
 */
export function DashboardWidgetFrame({
  definition,
  size,
  index,
  total,
  isEditing,
  isDragging,
  onRemove,
  onResize,
  onMoveBy,
  onDragStart,
  onDrag,
  onDragEnd,
  registerElement,
}: DashboardWidgetFrameProps) {
  const reduceMotion = useReducedMotion();
  const [isPointerOver, setPointerOver] = useState(false);
  const [isFocusWithin, setFocusWithin] = useState(false);

  // The controls appear on approach and stay for the keyboard: they are always mounted, so
  // Tab can reach them, and focusing one is what reveals it.
  const showControls = isPointerOver || isFocusWithin;
  const isWiggling = isEditing && !reduceMotion && !isPointerOver && !isDragging;

  return (
    <motion.div
      layout="position"
      ref={(element) => registerElement(definition.id, element)}
      transition={centralSpringToken}
      drag={isEditing}
      dragSnapToOrigin
      // No elasticity: the card should sit under the pointer, not lag behind it on a spring.
      dragElastic={0}
      dragMomentum={false}
      onDragStart={() => onDragStart(definition.id)}
      onDrag={() => onDrag(definition.id)}
      onDragEnd={onDragEnd}
      onPointerEnter={() => setPointerOver(true)}
      onPointerLeave={() => setPointerOver(false)}
      onFocusCapture={() => setFocusWithin(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocusWithin(false);
      }}
      className={`${dashboardCellClass(size, definition.isTallWhenWide === true)} relative ${
        isDragging ? "z-40" : ""
      }`}
      style={isEditing ? { touchAction: "none" } : undefined}
    >
      <motion.div
        animate={isWiggling ? WIGGLE : { rotate: 0 }}
        transition={
          isWiggling
            ? { duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: (index % 5) * 0.08 }
            : centralSpringToken
        }
        className="h-full"
      >
        <SpotlightCard
          roundedClassName="rounded-3xl"
          className={`h-full ${isEditing ? "ring-2 ring-app-border-muted" : ""} ${
            isDragging ? "cursor-grabbing shadow-2xl" : isEditing ? "cursor-grab" : ""
          }`}
        >
          <div className={`h-full ${isEditing ? "pointer-events-none select-none" : ""}`}>
            {definition.render(size)}
          </div>
        </SpotlightCard>
      </motion.div>

      {isEditing && (
        <div
          data-widget-controls
          // Keeps a press on the controls from also grabbing the card underneath.
          onPointerDownCapture={(event) => event.stopPropagation()}
          className={`absolute -top-4 right-4 z-50 flex items-center gap-1.5 rounded-full border border-app-border bg-app-surface-muted p-1.5 shadow-lg transition-opacity duration-150 ${
            showControls ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <GripVertical aria-hidden="true" className="h-4 w-4 text-app-text-muted" />

          <Button
            variant="secondary"
            size="sm"
            iconOnly
            aria-label={`Move ${definition.title} earlier`}
            disabled={index === 0}
            onClick={() => onMoveBy(definition.id, -1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Button
            variant="secondary"
            size="sm"
            iconOnly
            aria-label={`Move ${definition.title} later`}
            disabled={index === total - 1}
            onClick={() => onMoveBy(definition.id, 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          {/* A widget with one sensible shape has nothing to choose between. */}
          {definition.sizes.length > 1 && (
            <FilterSelect
              label={`Size of ${definition.title}`}
              value={size}
              options={definition.sizes.map((option) => ({
                value: option,
                label: DASHBOARD_SIZE_LABELS[option],
              }))}
              onChange={(next) => onResize(definition.id, next)}
              className="w-32"
            />
          )}

          <Button
            variant="dangerSoft"
            size="sm"
            iconOnly
            aria-label={`Remove ${definition.title}`}
            onClick={() => onRemove(definition.id)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </motion.div>
  );
}
