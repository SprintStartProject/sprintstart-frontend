import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { ArrivalScope, ArrivalStep } from "../../types";
import { moveTo } from "../../../../utils/moveTo";
import { MOVE_COOLDOWN_MS, reorderByKeys, rowId, sameKeys, targetKeyUnder } from "./threadRules";

type Setter<T> = Dispatch<SetStateAction<T>>;

/** How long the row a drop just settled stays ringed. */
const SETTLE_RING_MS = 650;

/**
 * The local order of one section, kept in step with the server's own — except while that section
 * is being dragged, where the pointer is in charge until it lets go, so a row does not get pulled
 * out from under the cursor by a refetch landing mid-drag.
 *
 * The scope being dragged is read through a ref inside the sync rather than put in its dependency
 * array: a drag ending flips it back to null a beat before the silent reload it triggered actually
 * lands, and `steps` is still the pre-drop order at that instant. Depending on it directly would
 * re-run the sync right then, snapping the row that just settled back to its old spot and then
 * forward again once the fresh order arrives — the already-there-but-animating-anyway flicker this
 * guards against. Keyed only on the steps, the sync waits for that reload to finish, by which
 * point the server's order already matches what the drag left locally.
 *
 * Deferred to a microtask so this is not a synchronous setState inside the effect body, which
 * `react-hooks/set-state-in-effect` rejects.
 */
function useSectionOrder(
  steps: ArrivalStep[],
  scope: ArrivalScope,
  draggingScope: ArrivalScope | null,
): [string[], Setter<string[]>] {
  const [order, setOrder] = useState<string[]>(() => steps.map((step) => step.key));

  const draggingScopeRef = useRef<ArrivalScope | null>(null);
  useEffect(() => {
    draggingScopeRef.current = draggingScope;
  }, [draggingScope]);

  useEffect(() => {
    void Promise.resolve().then(() => {
      if (draggingScopeRef.current === scope) return;
      setOrder(steps.map((step) => step.key));
    });
  }, [steps, scope]);

  return [order, setOrder];
}

/** Which row is in hand, and which one a drop just settled — ringed briefly, then cleared. */
function useDragState() {
  const [draggingRowId, setDraggingRowId] = useState<string | null>(null);
  const [draggingScope, setDraggingScope] = useState<ArrivalScope | null>(null);
  const [justDroppedRowId, setJustDroppedRowId] = useState<string | null>(null);
  const settleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (settleTimeoutRef.current) clearTimeout(settleTimeoutRef.current);
    };
  }, []);

  const settle = (id: string) => {
    setJustDroppedRowId(id);
    if (settleTimeoutRef.current) clearTimeout(settleTimeoutRef.current);
    settleTimeoutRef.current = setTimeout(() => setJustDroppedRowId(null), SETTLE_RING_MS);
  };

  const pick = (id: string, scope: ArrivalScope) => {
    setDraggingRowId(id);
    setDraggingScope(scope);
  };

  const release = () => {
    setDraggingRowId(null);
    setDraggingScope(null);
  };

  return { draggingRowId, draggingScope, justDroppedRowId, settle, pick, release };
}

type Input = {
  companySteps: ArrivalStep[];
  projectSteps: ArrivalStep[];
  onReorder: (orderedKeys: string[], scope: ArrivalScope) => void;
};

/**
 * Both sections' local order with the drag handlers that change it. The numbers stay put until the
 * pointer is actually released: the caller reads them from the order the server still has while a
 * scope is dragged, and only picks up the live order again once the drag ends.
 */
export function useThreadOrder({ companySteps, projectSteps, onReorder }: Input) {
  const drag = useDragState();
  const [companyOrder, setCompanyOrder] = useSectionOrder(
    companySteps,
    "company",
    drag.draggingScope,
  );
  const [projectOrder, setProjectOrder] = useSectionOrder(
    projectSteps,
    "project",
    drag.draggingScope,
  );
  // Read back during a drag to work out which row the one in hand is over, keyed by row id; and
  // when the last swap happened, for the cooldown.
  const rowElements = useRef(new Map<string, HTMLElement>());
  const lastMoveAt = useRef(0);

  const orderOf = (scope: ArrivalScope) => (scope === "company" ? companyOrder : projectOrder);
  const setOrderOf = (scope: ArrivalScope) =>
    scope === "company" ? setCompanyOrder : setProjectOrder;

  const registerRow = (id: string, element: HTMLElement | null) => {
    if (element) rowElements.current.set(id, element);
    else rowElements.current.delete(id);
  };

  /**
   * Called on every pointer-move frame a drag is live for: past the cooldown, moves the row in
   * hand to the one it now sits over.
   */
  const dragRow = (key: string, scope: ArrivalScope) => {
    const now = performance.now();
    if (now - lastMoveAt.current < MOVE_COOLDOWN_MS) return;

    const target = targetKeyUnder(orderOf(scope), key, scope, rowElements.current);
    if (target === null) return;

    setOrderOf(scope)((current) => moveTo(current, key, target));
    lastMoveAt.current = now;
  };

  const startDrag = (key: string, scope: ArrivalScope) => {
    lastMoveAt.current = 0;
    drag.pick(rowId(scope, key), scope);
  };

  const endDrag = (key: string, scope: ArrivalScope) => {
    drag.release();

    const finalOrder = orderOf(scope);
    const serverSteps = scope === "company" ? companySteps : projectSteps;
    if (
      !sameKeys(
        finalOrder,
        serverSteps.map((step) => step.key),
      )
    ) {
      onReorder(finalOrder, scope);
      drag.settle(rowId(scope, key));
    }
  };

  return {
    effectiveCompanySteps: reorderByKeys(companySteps, companyOrder),
    effectiveProjectSteps: reorderByKeys(projectSteps, projectOrder),
    draggingScope: drag.draggingScope,
    draggingRowId: drag.draggingRowId,
    justDroppedRowId: drag.justDroppedRowId,
    registerRow,
    startDrag,
    dragRow,
    endDrag,
  };
}
