import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, GripVertical, X } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { FilterSelect } from "../../../components/ui/FilterSelect";
import { SpotlightCard } from "../../../components/ui/SpotlightCard";
import { centralSpringToken } from "../../../styles/tokens";
import { DASHBOARD_SIZE_LABELS, dashboardCellClass, dashboardRenderSize } from "../layout/sizes";
import type {
  DashboardWidgetDefinition,
  DashboardWidgetId,
  DashboardWidgetSize,
} from "../layout/types";

/**
 * How far apart two neighbouring cards start their tilt, in seconds.
 *
 * Enough that the board shimmers rather than pulsing in lockstep, and modulo a small number
 * so a long dashboard does not end up with cards a full cycle behind each other.
 */
const WIGGLE_STAGGER_S = 0.09;
const WIGGLE_STAGGER_GROUPS = 5;

export type DashboardWidgetFrameProps = {
  definition: DashboardWidgetDefinition;
  size: DashboardWidgetSize;
  /** Position in the layout, and how many there are — the move buttons need both ends. */
  index: number;
  total: number;
  isEditing: boolean;
  isDragging: boolean;
  /**
   * Whether the board is running as a single column (below `sm`).
   *
   * The placed size still decides the cell, but on one column every card is the full width of
   * the page whatever it was given — so the *rendered* form is chosen for the column that is
   * actually there rather than for the one the user picked on a desktop. See
   * {@link dashboardRenderSize}.
   */
  isNarrow: boolean;
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
 * **The decoration sits on a child, deliberately.** The outer element is the grid cell: it
 * does `layout` and `drag`, and Framer measures it. Everything decorative — the edit-mode
 * tilt, the lift while dragging — lives on the plain `div` inside it. They were on the same
 * element until a card kept coming back about 3% larger from every drag: a scale or a
 * rotation changes an element's measured box, and a layout projection measured against a
 * transformed box stays wrong until the element is remounted. Decoration on a child Framer
 * does not measure cannot poison the measurement.
 */
export function DashboardWidgetFrame({
  definition,
  size,
  index,
  total,
  isEditing,
  isDragging,
  isNarrow,
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

  // The tilt stops the moment the pointer is over a card: a moving target is hard to aim a
  // 36px button at, and the card has already said it can be moved by the time you reach it.
  const isWiggling = isEditing && !reduceMotion && !isPointerOver && !isDragging;

  const renderSize = dashboardRenderSize(definition, size, isNarrow);

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
      className={`${dashboardCellClass(
        size,
        definition.isTallWhenWide === true,
        definition.isShortWhenWide === true,
      )} relative ${isDragging ? "z-40" : ""}`}
      style={isEditing ? { touchAction: "none" } : undefined}
    >
      {/* The tilt is a CSS animation on a plain element, not a Framer keyframe loop on a
                motion one. Two reasons, and the second is the bug the customer reported: Framer
                measures the outer cell, so decoration that changes an element's box has to live
                on a child it does not measure -- and an infinitely repeating `animate` target
                that is swapped out mid-cycle does not reliably settle, which is why a card could
                still be wiggling after "Done" until the page was reloaded. Removing a class
                cannot get stuck. */}
      <div
        className={`h-full ${isWiggling ? "app-widget-wiggle" : ""}`}
        style={
          isWiggling
            ? { animationDelay: `${(index % WIGGLE_STAGGER_GROUPS) * WIGGLE_STAGGER_S}s` }
            : undefined
        }
      >
        <SpotlightCard
          roundedClassName="rounded-3xl"
          className={`h-full ${isEditing ? "ring-2 ring-app-border-muted" : ""} ${
            isDragging ? "cursor-grabbing shadow-2xl" : isEditing ? "cursor-grab" : ""
          }`}
        >
          <div className={`h-full ${isEditing ? "pointer-events-none select-none" : ""}`}>
            {definition.render(renderSize)}
          </div>
        </SpotlightCard>
      </div>

      {isEditing && (
        <div
          data-widget-controls
          // Keeps a press on the controls from also grabbing the card underneath.
          onPointerDownCapture={(event) => event.stopPropagation()}
          // `right-2` on a phone: at the desktop inset the bar's own width plus the gutter ran
          // past the left edge of a single-column card, which put the grip and the move
          // buttons off screen.
          className={`absolute -top-4 right-2 z-50 flex max-w-[calc(100%-1rem)] items-center gap-1.5 rounded-full border border-app-border bg-app-surface-muted p-1.5 shadow-lg transition-opacity duration-150 sm:right-4 sm:max-w-none ${
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
              className="w-24 sm:w-32"
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
