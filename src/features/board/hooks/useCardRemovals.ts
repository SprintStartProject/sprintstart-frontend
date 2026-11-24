import { useEffect, useRef, useState } from "react";
import { useToast } from "../../../context/useToast";
import { forgetCard } from "../layout/forgetCard";
import type { Board } from "../types";

/**
 * How long a removed card can be brought back, in milliseconds.
 *
 * The window exists because dismissal is sticky by design -- the board never re-adds a card the hire
 * said no to, and there is no undo behind it. So the undo has to happen *before* the write: the card
 * leaves the screen at once and the server hears about it only when the window closes.
 */
const UNDO_WINDOW_MS = 7000;

type Params = {
  board: Board | null;
  boardId: string;
  projectId: string;
  /** Tells the server, once the window has closed. */
  dismiss: (cardId: string) => Promise<void>;
  /** The task pool card is a switch, not a dismissal: it has its own way out and its own undo. */
  removeTaskPool: () => void;
};

/**
 * Cards on their way out: gone from the board on screen, not yet gone from the server. Held here
 * rather than in `useBoard` because it is a property of this page's undo affordance, not of the
 * board itself -- the hook still knows only about writes that actually happened.
 *
 * A page left while a removal is still pending drops the timer with it: the card stays on the board
 * rather than disappearing from under somebody who navigated away mid-undo.
 */
export function useCardRemovals({ board, boardId, projectId, dismiss, removeTaskPool }: Params) {
  const toast = useToast();
  const [pendingRemovals, setPendingRemovals] = useState<Set<string>>(new Set());
  const removalTimers = useRef(new Map<string, number>());

  useEffect(() => {
    const timers = removalTimers.current;

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    };
  }, []);

  function keepCard(cardId: string) {
    setPendingRemovals((current) => {
      const next = new Set(current);
      next.delete(cardId);

      return next;
    });
  }

  function handleDismiss(cardId: string) {
    if (board?.cards.find((card) => card.id === cardId)?.content.kind === "TASK_POOL") {
      removeTaskPool();
      return;
    }

    setPendingRemovals((current) => new Set(current).add(cardId));

    const timer = window.setTimeout(() => {
      removalTimers.current.delete(cardId);
      void dismiss(cardId).then(() => forgetCard(boardId, projectId, cardId));
      keepCard(cardId);
    }, UNDO_WINDOW_MS);
    removalTimers.current.set(cardId, timer);

    toast.info("Removed from your board", {
      duration: UNDO_WINDOW_MS,
      action: {
        label: "Undo",
        onClick: () => {
          window.clearTimeout(timer);
          removalTimers.current.delete(cardId);
          keepCard(cardId);
        },
      },
    });
  }

  return { pendingRemovals, handleDismiss };
}
