import { useEffect, useRef, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";

/**
 * How long a first click waits for a second one before it counts as a single click.
 *
 * A single click opens the side panel, a double click the full profile. Opening the panel at once
 * would slide it in under the second click and then yank it away again as the page changes, so
 * the single click holds back for about as long as a double click takes.
 */
export const DOUBLE_CLICK_WINDOW_MS = 220;

/**
 * A click that opens the side panel and a double click that opens the full profile, for
 * anything that stands for one member — the roster's rows and the overview's tiles alike.
 */
export function usePeekClick(userId: string, onOpen: (userId: string) => void) {
  const navigate = useNavigate();
  const pendingClick = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (pendingClick.current !== null) window.clearTimeout(pendingClick.current);
    },
    [],
  );

  const cancelPendingClick = () => {
    if (pendingClick.current === null) return;
    window.clearTimeout(pendingClick.current);
    pendingClick.current = null;
  };

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    // `detail` is 0 for a click synthesized from the keyboard: no second click is coming.
    if (event.detail === 0) {
      onOpen(userId);
      return;
    }
    // The second click of a double click: the double-click handler takes it from here.
    if (event.detail > 1) return;

    cancelPendingClick();
    pendingClick.current = window.setTimeout(() => {
      pendingClick.current = null;
      onOpen(userId);
    }, DOUBLE_CLICK_WINDOW_MS);
  };

  const handleDoubleClick = () => {
    cancelPendingClick();
    void navigate(`/team/${userId}`);
  };

  return { handleClick, handleDoubleClick };
}
