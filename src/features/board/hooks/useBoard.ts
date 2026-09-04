import { useCallback, useState } from "react";
import { useFetch } from "../../../hooks/useFetch";
import { boardService } from "../../../services/boardService";
import type { AuthoredCardRequest, Board } from "../types";

type UseBoardResult = {
  board: Board | null;
  loading: boolean;
  error: boolean;
  /** Re-reads every card. Live cards are only as current as their last read. */
  refresh: () => void;
  /** Removes a card for good. Resolves once the board has been re-read. */
  dismiss: (cardId: string) => Promise<void>;
  /** The card currently being removed, so its own control can show it is working. */
  dismissingId: string | null;
  dismissError: boolean;
  /** Adds a card of the hire's own. Resolves false when the server refused it. */
  addCard: (request: AuthoredCardRequest) => Promise<boolean>;
  /** Replaces what one of their cards says — ticking a checklist item included. */
  editCard: (cardId: string, request: AuthoredCardRequest) => Promise<boolean>;
  /** Puts the cards in this order, showing it immediately and confirming with the server. */
  reorder: (cardIds: string[]) => Promise<void>;
  /** Set when the last write did not go through, so the page can say so and keep what was there. */
  writeError: boolean;
};

/**
 * Loads the hire's board for a project, and applies their changes to it.
 *
 * Passing an empty `projectId` yields `null` without a request, so the caller can show a
 * pick-a-project state rather than an error.
 *
 * `refresh` exists because every live card is a read: the board cannot know a pull request was
 * answered while the page was open until it asks again.
 *
 * Every write re-reads afterwards rather than patching state locally — the live cards beside
 * the one that changed may have moved on. The exception is reordering, which shows the new order
 * immediately, because a drag that visibly snaps back feels broken even when it worked.
 */
export function useBoard(projectId: string): UseBoardResult {
  const [reloadKey, setReloadKey] = useState(0);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [dismissError, setDismissError] = useState(false);
  const [writeError, setWriteError] = useState(false);
  const [order, setOrder] = useState<string[] | null>(null);

  const { data, loading, error } = useFetch<Board | null>(
    async () => (projectId ? await boardService.fetchBoard(projectId) : null),
    [projectId, reloadKey],
  );

  const reload = useCallback(() => {
    // A fresh read supersedes any order being shown ahead of the server.
    setOrder(null);
    setReloadKey((key) => key + 1);
  }, []);

  const refresh = useCallback(() => reload(), [reload]);

  const dismiss = useCallback(
    async (cardId: string) => {
      setDismissingId(cardId);
      setDismissError(false);
      try {
        await boardService.dismissCard(cardId);
        reload();
      } catch {
        // A card that looks gone but is not is worse than one that visibly refused to go,
        // so the failure is surfaced and the card stays.
        setDismissError(true);
      } finally {
        setDismissingId(null);
      }
    },
    [reload],
  );

  const write = useCallback(
    async (run: () => Promise<unknown>) => {
      setWriteError(false);
      try {
        await run();
        reload();
        return true;
      } catch {
        setWriteError(true);
        return false;
      }
    },
    [reload],
  );

  const addCard = useCallback(
    async (request: AuthoredCardRequest) =>
      projectId ? await write(() => boardService.addCard(projectId, request)) : false,
    [projectId, write],
  );

  const editCard = useCallback(
    async (cardId: string, request: AuthoredCardRequest) =>
      await write(() => boardService.editCard(cardId, request)),
    [write],
  );

  const reorder = useCallback(
    async (cardIds: string[]) => {
      setWriteError(false);
      // Shown before it is saved: a drag that snaps back while a request is in flight feels
      // broken even when it worked.
      setOrder(cardIds);
      if (!projectId) return;
      try {
        await boardService.reorder(projectId, cardIds);
      } catch {
        setWriteError(true);
        // Drop back to the order the server last confirmed rather than leaving the hire
        // looking at an arrangement that was never saved.
        setOrder(null);
      }
    },
    [projectId],
  );

  const board =
    data && order
      ? {
          ...data,
          cards: [...data.cards].sort((a, b) => indexIn(order, a.id) - indexIn(order, b.id)),
        }
      : data;

  return {
    board,
    loading,
    error,
    refresh,
    dismiss,
    dismissingId,
    dismissError,
    addCard,
    editCard,
    reorder,
    writeError,
  };
}

/** Where a card sits in a pending order; anything unlisted keeps to the end, in its own order. */
function indexIn(order: string[], cardId: string): number {
  const index = order.indexOf(cardId);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}
