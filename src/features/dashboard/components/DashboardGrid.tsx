import { useCallback, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { EmptyState } from "../../../components/ui/EmptyState";
import { LayoutGrid } from "lucide-react";
import { getDashboardWidget } from "../layout/catalog";
import { DASHBOARD_GRID_CLASS } from "../layout/sizes";
import type { DashboardLayoutController } from "../layout/useDashboardLayout";
import type { DashboardWidgetId } from "../layout/types";
import { DashboardWidgetFrame } from "./DashboardWidgetFrame";

/**
 * How far inside a card the pointer has to be before it counts as "over" it.
 *
 * Reordering on the first pixel of overlap makes two cards trade places repeatedly while the
 * pointer sits on the seam between them, because each swap moves the seam back under the
 * pointer. Requiring the middle of the card gives the layout somewhere to settle.
 */
const DROP_TARGET_INSET = 0.2;

function isPointerOver(element: HTMLElement, x: number, y: number): boolean {
  const rect = element.getBoundingClientRect();
  const insetX = rect.width * DROP_TARGET_INSET;
  const insetY = rect.height * DROP_TARGET_INSET;

  return (
    x >= rect.left + insetX &&
    x <= rect.right - insetX &&
    y >= rect.top + insetY &&
    y <= rect.bottom - insetY
  );
}

/**
 * The dashboard itself: the user's widgets, on an invisible four-column grid.
 *
 * Widgets are placed in layout order and left to wrap, so there are no coordinates to store
 * and no holes to fall into — a card's size only decides how many columns and rows it eats.
 * That is also what makes dragging a single operation: find the card under the pointer, put
 * the dragged one in its place, and let the grid re-flow.
 *
 * The reflow is animated by Framer Motion's `layout`, which is why the dragged card does not
 * follow the cursor as a free-floating copy — it moves to where it would land, and the rest
 * part around it, the way a home screen does.
 */
export function DashboardGrid({
  controller,
  isEditing,
}: {
  controller: DashboardLayoutController;
  isEditing: boolean;
}) {
  const elements = useRef(new Map<DashboardWidgetId, HTMLDivElement>());
  const [draggingId, setDraggingId] = useState<DashboardWidgetId | null>(null);

  const registerElement = useCallback((id: DashboardWidgetId, element: HTMLDivElement | null) => {
    if (element) {
      elements.current.set(id, element);
    } else {
      elements.current.delete(id);
    }
  }, []);

  const handleDragStart = useCallback(
    (id: DashboardWidgetId, event: ReactPointerEvent<HTMLDivElement>) => {
      // The controls sit on top of the card; pressing one must not also grab it.
      if ((event.target as HTMLElement).closest("[data-widget-controls]")) return;

      // Optional because jsdom has no pointer capture: without it every test that renders
      // the edit mode would crash on the first pointer down.
      event.currentTarget.setPointerCapture?.(event.pointerId);
      setDraggingId(id);
    },
    [],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!draggingId) return;

      for (const [id, element] of elements.current) {
        if (id !== draggingId && isPointerOver(element, event.clientX, event.clientY)) {
          controller.moveWidgetTo(draggingId, id);
          return;
        }
      }
    },
    [controller, draggingId],
  );

  const endDrag = useCallback(() => setDraggingId(null), []);

  if (controller.layout.length === 0) {
    return (
      <EmptyState icon={<LayoutGrid className="h-6 w-6" />} title="Your dashboard is empty">
        Add a widget to start putting it back together.
      </EmptyState>
    );
  }

  return (
    <div
      className={DASHBOARD_GRID_CLASS}
      onPointerMove={isEditing ? handlePointerMove : undefined}
      onPointerUp={isEditing ? endDrag : undefined}
      onPointerCancel={isEditing ? endDrag : undefined}
    >
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
            registerElement={registerElement}
          />
        );
      })}
    </div>
  );
}
