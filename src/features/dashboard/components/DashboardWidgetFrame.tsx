import type { PointerEvent as ReactPointerEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, GripVertical, X } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Select } from "../../../components/ui/Select";
import { SpotlightCard } from "../../../components/ui/SpotlightCard";
import { centralSpringToken } from "../../../styles/tokens";
import { DASHBOARD_SIZE_CLASSES, DASHBOARD_SIZE_LABELS } from "../layout/sizes";
import type {
  DashboardWidgetDefinition,
  DashboardWidgetId,
  DashboardWidgetSize,
} from "../layout/types";

/**
 * The tilt that says "this can be moved".
 *
 * Under a degree, and every card starts at a different point in the cycle, so the board
 * shimmers rather than pulsing in lockstep. Skipped entirely under reduced motion, where the
 * dashed outline and the controls carry the same message without anything moving.
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
  onDragStart: (id: DashboardWidgetId, event: ReactPointerEvent<HTMLDivElement>) => void;
  /** Lets the grid measure this cell while a drag is looking for what is under the pointer. */
  registerElement: (id: DashboardWidgetId, element: HTMLDivElement | null) => void;
};

/**
 * One cell of the dashboard: the widget, plus everything the edit mode adds around it.
 *
 * The widget itself never learns it is being edited — it renders exactly as it does on a
 * finished dashboard, with pointer events switched off so a card that is normally a link
 * does not navigate when it is being dragged. Everything editable lives in this frame, which
 * is what keeps the eleven widgets from each needing an edit mode of their own.
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
  registerElement,
}: DashboardWidgetFrameProps) {
  const reduceMotion = useReducedMotion();

  const isWiggling = isEditing && !reduceMotion;

  // The layout spring is the shared one; only the wiggle brings its own timing, because a
  // spring cannot express "rock back and forth forever".
  const transition = isWiggling
    ? {
        ...centralSpringToken,
        rotate: {
          duration: 0.6,
          repeat: Infinity,
          ease: "easeInOut" as const,
          // Offsets each card in the cycle so the board shimmers instead of pulsing.
          delay: (index % 5) * 0.08,
        },
      }
    : centralSpringToken;

  return (
    <motion.div
      layout
      ref={(element) => registerElement(definition.id, element)}
      transition={transition}
      animate={isWiggling ? WIGGLE : { rotate: 0 }}
      className={`${DASHBOARD_SIZE_CLASSES[size]} relative ${isDragging ? "z-20 opacity-80" : ""}`}
      style={isEditing ? { touchAction: "none" } : undefined}
      onPointerDown={isEditing ? (event) => onDragStart(definition.id, event) : undefined}
    >
      <SpotlightCard
        roundedClassName="rounded-3xl"
        className={`h-full ${
          isEditing ? "cursor-grab ring-2 ring-app-border-muted ring-offset-0" : ""
        } ${isDragging ? "cursor-grabbing" : ""}`}
      >
        <div className={`h-full ${isEditing ? "pointer-events-none select-none" : ""}`}>
          {definition.render()}
        </div>
      </SpotlightCard>

      {isEditing && (
        <div
          data-widget-controls
          // Stops a click on the controls from also starting a drag of the card beneath.
          onPointerDown={(event) => event.stopPropagation()}
          className="absolute -top-3 right-3 z-10 flex items-center gap-1 rounded-full border border-app-border bg-app-surface px-1.5 py-1 shadow-lg"
        >
          <GripVertical aria-hidden="true" className="h-4 w-4 text-app-text-subtle" />

          <Button
            variant="ghost"
            size="sm"
            iconOnly
            aria-label={`Move ${definition.title} earlier`}
            disabled={index === 0}
            onClick={() => onMoveBy(definition.id, -1)}
            icon={<ChevronLeft className="h-4 w-4" />}
          />

          <Button
            variant="ghost"
            size="sm"
            iconOnly
            aria-label={`Move ${definition.title} later`}
            disabled={index === total - 1}
            onClick={() => onMoveBy(definition.id, 1)}
            icon={<ChevronRight className="h-4 w-4" />}
          />

          <Select
            size="sm"
            aria-label={`Size of ${definition.title}`}
            value={size}
            onChange={(event) => onResize(definition.id, event.target.value as DashboardWidgetSize)}
            className="w-28"
          >
            {definition.sizes.map((option) => (
              <option key={option} value={option}>
                {DASHBOARD_SIZE_LABELS[option]}
              </option>
            ))}
          </Select>

          <Button
            variant="dangerGhost"
            size="sm"
            iconOnly
            aria-label={`Remove ${definition.title}`}
            onClick={() => onRemove(definition.id)}
            icon={<X className="h-4 w-4" />}
          />
        </div>
      )}
    </motion.div>
  );
}
