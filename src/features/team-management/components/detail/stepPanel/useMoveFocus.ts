import { useEffect, useRef, type RefObject } from "react";
import type { MoveFocus } from "./stepPanelTypes";

/**
 * After this task was moved with its buttons, puts focus back on the button that moved it. At the end
 * of the list that button is now disabled, so the other one takes it: the keyboard user can keep
 * going or go back without having to find the task again.
 */
export function useMoveFocus(
  moveFocus: MoveFocus,
  taskId: string,
): [RefObject<HTMLButtonElement | null>, RefObject<HTMLButtonElement | null>] {
  const moveUpRef = useRef<HTMLButtonElement>(null);
  const moveDownRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (moveFocus?.taskId !== taskId) return;
    const preferred = moveFocus.direction === "up" ? moveUpRef.current : moveDownRef.current;
    const other = moveFocus.direction === "up" ? moveDownRef.current : moveUpRef.current;
    (preferred && !preferred.disabled ? preferred : other)?.focus();
  }, [moveFocus, taskId]);

  return [moveUpRef, moveDownRef];
}
