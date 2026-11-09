import { useState } from "react";
import type { DragEvent, HTMLAttributes } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { BlueprintScope } from "../../services/blueprintService.ts";
import {
  applyPositionUpdates,
  findItem,
  moveItem,
  savePosition,
  siblingIds,
} from "./pathOrdering.ts";
import type { SortKind } from "./pathEditorTypes.ts";
import type { BlueprintPath } from "./types.ts";

type Dragged = { kind: SortKind; id: string } | null;

interface OrderContext {
  path: BlueprintPath | null;
  setPath: Dispatch<SetStateAction<BlueprintPath | null>>;
  scope: BlueprintScope;
  loadPath: (showLoading?: boolean) => Promise<void>;
  setPageError: (message: string | null) => void;
  whenEditable: (run: () => void) => void;
}

/** Moves an item to a new place in its list at once, then tells the server and keeps its answer. */
async function reorder(context: OrderContext, kind: SortKind, id: string, position: number) {
  const { path, setPath } = context;
  if (!path) return;
  const item = findItem(path, kind, id);
  setPath((current) => (current ? moveItem(current, kind, id, position) : current));
  try {
    const updates = item ? await savePosition(context.scope, kind, item, position) : [];
    setPath((current) => (current ? applyPositionUpdates(current, kind, id, updates) : current));
  } catch (reason) {
    // Back to what the server has, not to the snapshot this call started from: anything saved
    // meanwhile would be thrown away with the failed move.
    void context.loadPath(false);
    context.setPageError(
      reason instanceof Error ? reason.message : "The item could not be reordered.",
    );
  }
}

/** Dragging items of the outline to reorder them within their own list. */
export function useOutlineOrder(context: OrderContext) {
  const [dragged, setDragged] = useState<Dragged>(null);

  function onDrop(event: DragEvent<HTMLElement>, kind: SortKind, id: string, position: number) {
    event.preventDefault();
    event.stopPropagation();
    const source = dragged;
    setDragged(null);
    // Dropped on an item of another list, the target's position means nothing in the source's.
    if (source?.kind !== kind || source.id === id) return;
    if (!siblingIds(context.path, kind, id).includes(source.id)) return;
    context.whenEditable(() => void reorder(context, kind, source.id, position));
  }

  function dragProps(kind: SortKind, id: string, position: number): HTMLAttributes<HTMLElement> {
    return {
      draggable: true,
      onDragStart: (event) => {
        event.stopPropagation();
        event.dataTransfer.effectAllowed = "move";
        setDragged({ kind, id });
      },
      onDragOver: (event) => {
        event.preventDefault();
        event.stopPropagation();
      },
      onDrop: (event) => onDrop(event, kind, id, position),
      onDragEnd: () => setDragged(null),
    };
  }

  return { dragProps };
}
