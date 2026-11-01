import { useRef } from "react";
import { GripVertical } from "lucide-react";
import type { DragControls } from "framer-motion";
import { Button } from "../../../components/ui/Button";
import { Select } from "../../../components/ui/Select";
import { cardName } from "../layout/cardNames";
import { sizeFromDrag, type CardSize } from "../layout/cardSizes";
import type { BoardCard } from "../types";

type PilePickerProps = {
  card: BoardCard;
  label: string;
  predecessorId: string | null;
  leadsPile: boolean;
  allCards: BoardCard[];
  onStackOnto: (cardId: string, targetId: string | null) => void;
};

export function PilePicker({
  card,
  label,
  predecessorId,
  leadsPile,
  allCards,
  onStackOnto,
}: PilePickerProps) {
  return (
    <Select
      size="sm"
      value={predecessorId ?? ""}
      aria-label={`Put the ${label} card in a pile`}
      title="Put this card under another one, so the two lie in one pile. It moves into the other card’s area, or out of its own when the other card has none."
      className="max-w-40"
      onChange={(event) => onStackOnto(card.id, event.target.value || null)}
    >
      <option value="">{leadsPile ? "Top of its pile" : "Not in a pile"}</option>
      {allCards
        .filter((other) => other.id !== card.id)
        .map((other) => (
          <option key={other.id} value={other.id}>
            Under “{cardName(other)}”
          </option>
        ))}
    </Select>
  );
}

type ResizeHandleProps = {
  label: string;
  size: CardSize;
  onResize: (size: CardSize) => void;
};

export function ResizeHandle({ label, size, onResize }: ResizeHandleProps) {
  /** Where a resize drag started, and from which size. Null when nothing is being dragged. */
  const resizeStart = useRef<{ x: number; y: number; size: CardSize } | null>(null);

  return (
    <button
      type="button"
      // Pointer capture, so a drag that leaves the little handle — which it does immediately
      // — keeps being this handle's drag rather than the page's.
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        resizeStart.current = { x: event.clientX, y: event.clientY, size };
      }}
      onPointerMove={(event) => {
        const from = resizeStart.current;
        if (!from) return;

        const next = sizeFromDrag(from.size, event.clientX - from.x);
        if (next.width !== size.width) onResize(next);
      }}
      onPointerUp={() => (resizeStart.current = null)}
      onPointerCancel={() => (resizeStart.current = null)}
      // The keyboard steps the same ramp rather than simulating a drag: a gesture nobody can
      // perform is not an affordance, it is a picture of one.
      onKeyDown={(event) => {
        const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
        if (step === 0) return;
        event.preventDefault();
        onResize(sizeFromDrag(size, step * 60));
      }}
      title="Drag sideways to make this card narrower or wider, or use the arrow keys"
      aria-label={`Resize the ${label} card — drag sideways, or use the arrow keys`}
      className="absolute right-1 bottom-1 z-20 hidden h-6 w-6 cursor-ew-resize items-center justify-center rounded text-app-text-subtle opacity-0 transition-opacity duration-150 group-hover/stack:opacity-100 focus-visible:opacity-100 lg:flex"
    >
      <span
        aria-hidden="true"
        className="h-2.5 w-2.5 rounded-[2px] border-r-2 border-b-2 border-current"
      />
    </button>
  );
}

type DragHandleProps = {
  cardId: string;
  label: string;
  index: number;
  total: number;
  dragControls: DragControls;
  onMove: (cardId: string, direction: "up" | "down") => void;
};

export function DragHandle({ cardId, label, index, total, dragControls, onMove }: DragHandleProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      iconOnly
      title="Drag to move this card, or use the arrow keys"
      aria-label={`Move the ${label} card — drag, or use the arrow keys`}
      className="cursor-grab active:cursor-grabbing"
      onPointerDown={(event) => dragControls.start(event)}
      onKeyDown={(event) => {
        const back = event.key === "ArrowUp" || event.key === "ArrowLeft";
        const on = event.key === "ArrowDown" || event.key === "ArrowRight";
        if (!back && !on) return;
        event.preventDefault();
        if (back && index > 0) onMove(cardId, "up");
        if (on && index < total - 1) onMove(cardId, "down");
      }}
    >
      <GripVertical className="h-4 w-4" aria-hidden="true" />
    </Button>
  );
}
