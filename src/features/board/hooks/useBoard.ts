import { useCallback, useState } from "react";
import { useFetch } from "../../../hooks/useFetch";
import { boardService } from "../../../services/boardService";
import type { AuthoredCardRequest, Board, BoardCard } from "../types";

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
 * Writes that change *which* cards are on the board — adding one, dismissing one — re-read
 * afterwards, because the live cards beside them may have moved on in the meantime.
 *
 * Writes that change what one card *says* do not, and that is a deliberate exception rather than an
 * oversight. `editCard` gets the updated card back from the server and puts that one card in place.
 * Re-reading was the honest thing while an edit meant somebody had opened a note, typed, and
 * pressed Save — a rare, deliberate act where a fresh board is a bonus. It stopped being honest
 * when edits became *small*: ticking a checklist line, painting a highlight. Every one of those was
 * a full board fetch, and the page swaps the board for a spinner while one is in flight — so the
 * card being worked on vanished, everything re-rendered, and the hire was returned to the top of
 * their own board and had to scroll back to what they were doing. The exchange is one card's worth
 * of staleness on the *other* cards, which were already as stale as their last read.
 *
 * Reordering is the third case: it shows the new order immediately, because a drag that visibly
 * snaps back feels broken even when it worked.
 */
export function useBoard(projectId: string): UseBoardResult {
  const [reloadKey, setReloadKey] = useState(0);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [dismissError, setDismissError] = useState(false);
  const [writeError, setWriteError] = useState(false);
  const [order, setOrder] = useState<string[] | null>(null);
  /** Cards the server has confirmed since the last read, standing in for the ones it returned. */
  const [edited, setEdited] = useState<Record<string, BoardCard>>({});

  const { data, loading, error } = useFetch<Board | null>(
    async () => (projectId ? await boardService.fetchBoard(projectId) : null),
    [projectId, reloadKey],
  );

  const reload = useCallback(() => {
    // A fresh read supersedes any order being shown ahead of the server, and any card standing in
    // for one it is about to return.
    setOrder(null);
    setEdited({});
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

  const editCard = useCallback(async (cardId: string, request: AuthoredCardRequest) => {
    setWriteError(false);
    try {
      // The server's own answer, not the request that was sent: an edit comes back with whatever
      // the server made of it — trimmed text, minted ids for new checklist lines — and showing the
      // request instead would put a card on screen that differs from the stored one in small ways
      // nobody would think to look for.
      const updated = await boardService.editCard(cardId, request);
      setEdited((current) => ({ ...current, [cardId]: updated }));

      return true;
    } catch {
      setWriteError(true);

      return false;
    }
  }, []);

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

  const cards = data?.cards.map((card) => edited[card.id] ?? card);

  const board =
    data && cards
      ? {
          ...data,
          cards: order
            ? [...cards].sort((a, b) => indexIn(order, a.id) - indexIn(order, b.id))
            : cards,
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
