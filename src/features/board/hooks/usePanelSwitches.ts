import { useCallback } from "react";
import { useToast } from "../../../context/useToast";
import { readPathWindowShown, writePathWindowShown } from "../layout/pathWindowFold";
import { readTaskPoolShown, writeTaskPoolShown } from "../layout/taskPoolShown";
import { useStoredFor } from "./useStoredFor";

/**
 * The two panels the hire can switch off the board -- the strip saying where they stand, and the
 * task pool card -- kept per board.
 *
 * Both are switches rather than dismissals. Taking one off from the thing itself comes with an
 * undo in a toast, and the switch on the rail is the way back afterwards, which is why a one-press
 * removal is allowed at all: there is no server call behind it and nothing to wait for. See
 * `layout/taskPoolShown.ts` for why the pool does not get the sticky server-side removal.
 */
export function usePanelSwitches(boardId: string, storedFor: string) {
  const toast = useToast();
  const [isPathShown, setIsPathShown] = useStoredFor(
    storedFor,
    () => readPathWindowShown(boardId),
    true,
  );
  const [isTaskPoolShown, setIsTaskPoolShown] = useStoredFor(
    storedFor,
    () => readTaskPoolShown(boardId),
    true,
  );

  const showPathWindow = useCallback(
    (shown: boolean) => {
      setIsPathShown(shown);
      writePathWindowShown(boardId, shown);
    },
    [boardId, setIsPathShown],
  );

  const removePathWindow = useCallback(() => {
    showPathWindow(false);
    toast.info("Taken off your board", {
      description: "You can put it back from the switches on the right.",
      action: { label: "Undo", onClick: () => showPathWindow(true) },
    });
  }, [showPathWindow, toast]);

  const showTaskPool = useCallback(
    (shown: boolean) => {
      setIsTaskPoolShown(shown);
      writeTaskPoolShown(boardId, shown);
    },
    [boardId, setIsTaskPoolShown],
  );

  const removeTaskPool = useCallback(() => {
    showTaskPool(false);
    toast.info("Task pool hidden", {
      description: "You can put it back from the switches on the right.",
      action: { label: "Undo", onClick: () => showTaskPool(true) },
    });
  }, [showTaskPool, toast]);

  return {
    isPathShown,
    showPathWindow,
    removePathWindow,
    isTaskPoolShown,
    showTaskPool,
    removeTaskPool,
  };
}
