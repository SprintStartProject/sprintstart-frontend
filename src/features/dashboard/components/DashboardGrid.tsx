import { useCallback, useRef, useState } from "react";
import { LayoutGrid } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";
import { getDashboardWidget } from "../layout/catalog";
import { DASHBOARD_GRID_CLASS } from "../layout/sizes";
import type { DashboardWidgetId } from "../layout/types";
import type { DashboardLayoutController } from "../layout/useDashboardLayout";
import { DashboardWidgetFrame } from "./DashboardWidgetFrame";

/**
 * How long the grid ignores further reordering after a swap.
 *
 * A drag reports on every frame, but the re-flow it triggers takes a moment to land — and
 * measuring the new positions before they exist makes the next frame swap again. That is
 * how a single drag downwards used to travel two rows instead of one. Roughly the length of
 * the layout animation, so the next decision is made against where things actually are.
 */
const SWAP_COOLDOWN_MS = 160;

/**
 * Where a dragged card counts as being: its own middle.
 *
 * Deliberately not the pointer. The pointer can sit anywhere on a card the user grabbed by
 * the corner, and reordering on it means the board rearranges before the card looks like it
 * has arrived. The card's centre is what the eye is following.
 */
function centerOf(element: HTMLElement): { x: number; y: number } {
  const rect = element.getBoundingClientRect();

  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function contains(element: HTMLElement, x: number, y: number): boolean {
  const rect = element.getBoundingClientRect();

  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

/**
 * The dashboard itself: the user's widgets, on an invisible four-column grid.
 *
 * Widgets are placed in layout order and left to wrap, so there are no coordinates to store
 * and no holes to fall into — a card's size only decides how many columns it eats. That is
 * also what makes dragging a single operation: find the card the dragged one now covers, put
 * it in that place, and let the grid re-flow around it.
 */
export function DashboardGrid({
  controller,
  isEditing,
  onAddWidget,
}: {
  controller: DashboardLayoutController;
  isEditing: boolean;
  /** Offered from the empty state, which is the one place with nothing else to click. */
  onAddWidget: () => void;
}) {
  const elements = useRef(new Map<DashboardWidgetId, HTMLDivElement>());
  const lastSwapAt = useRef(0);
  const [draggingId, setDraggingId] = useState<DashboardWidgetId | null>(null);

  const registerElement = useCallback((id: DashboardWidgetId, element: HTMLDivElement | null) => {
    if (element) {
      elements.current.set(id, element);
    } else {
      elements.current.delete(id);
    }
  }, []);

  const handleDrag = useCallback(
    (id: DashboardWidgetId) => {
      const dragged = elements.current.get(id);
      if (!dragged) return;

      const now = performance.now();
      if (now - lastSwapAt.current < SWAP_COOLDOWN_MS) return;

      const { x, y } = centerOf(dragged);

      for (const [candidateId, element] of elements.current) {
        if (candidateId !== id && contains(element, x, y)) {
          controller.moveWidgetTo(id, candidateId);
          lastSwapAt.current = now;
          return;
        }
      }
    },
    [controller],
  );

  const handleDragStart = useCallback((id: DashboardWidgetId) => {
    lastSwapAt.current = 0;
    setDraggingId(id);
  }, []);

  if (controller.layout.length === 0) {
    return (
      <EmptyState
        icon={<LayoutGrid className="h-6 w-6" />}
        title="Your dashboard is empty"
        action={<Button onClick={onAddWidget}>Add a widget</Button>}
      >
        Pick the cards you want and arrange them however you work.
      </EmptyState>
    );
  }

  return (
    <div className={DASHBOARD_GRID_CLASS}>
      {controller.layout.map((item, index) => {
        const definition = getDashboardWidget(item.id);
        if (!definition) return null;

        return (
          <DashboardWidgetFrame
            key={item.id}
            definition={definition}
            size={item.size}
            index={index}
            total={controller.layout.length}
            isEditing={isEditing}
            isDragging={draggingId === item.id}
            onRemove={controller.removeWidget}
            onResize={controller.resizeWidget}
            onMoveBy={controller.moveWidgetBy}
            onDragStart={handleDragStart}
            onDrag={handleDrag}
            onDragEnd={() => setDraggingId(null)}
            registerElement={registerElement}
          />
        );
      })}
    </div>
  );
}
