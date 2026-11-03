import { useState } from "react";
import type { BlueprintGraphNode } from "../types.ts";
import type { NodeSelection } from "./useNodeSelection.ts";

/**
 * Leaving a node with unsaved fields loses them, and it makes no difference whether it was left
 * through the way out or through the way onward: both ask first, and this keeps the question.
 */
export function useUnsavedGuard(
  selection: NodeSelection,
  openNode: (node: BlueprintGraphNode) => void,
) {
  const [isOpen, setIsOpen] = useState(false);
  /** Where the author was on their way to when the unsaved-changes question stopped them. */
  const [nextId, setNextId] = useState<string | null>(null);

  return {
    isOpen,
    hasNext: nextId !== null,
    /** Steps from the open node to one of its neighbours. */
    goTo: (id: string) => {
      const node = selection.nodeById.get(id);
      if (!node) return;
      if (selection.dirty) {
        setNextId(id);
        setIsOpen(true);
        return;
      }
      openNode(node);
    },
    /**
     * Without the mode there is no Cancel, so stepping back out is the only way to walk away from
     * an edit -- and it has to say so rather than dropping the work on the floor.
     */
    requestClose: () => {
      if (selection.dirty) {
        setIsOpen(true);
        return;
      }
      selection.hide();
    },
    keepEditing: () => {
      setIsOpen(false);
      setNextId(null);
    },
    discard: () => {
      selection.revert();
      setIsOpen(false);
      const next = nextId ? selection.nodeById.get(nextId) : null;
      setNextId(null);
      if (next) {
        openNode(next);
        return;
      }
      selection.hide();
    },
  };
}

export type UnsavedGuard = ReturnType<typeof useUnsavedGuard>;
