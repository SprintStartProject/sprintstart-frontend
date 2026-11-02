import { useEffect, useMemo, useState } from "react";
import type { Board } from "../types";
import { notifyBoardStorageWritten, subscribeToBoardStorageWritten } from "../layout/boardStorage";
import {
  countPlanChanges,
  revertedDocument,
  revertedOrder,
  sameOrder,
  type PlanSnapshot,
} from "../layout/planChanges";
import { applyBoardDocument, readBoardDocument, type BoardDocument } from "../sync/boardDocument";

type Params = {
  board: Board | null;
  boardId: string;
  projectId: string;
  /** Sends a new card order to the server. */
  reorder: (cardIds: string[]) => Promise<void>;
};

/**
 * Planning: arranging the board -- piles, areas, order -- with a way to undo all of it.
 *
 * Planning writes as it goes, so Cancel is not "don't save" but "undo all of it": the snapshot taken
 * on the way in is written back over the layers (and announced as a change, so the sync sends it
 * up), and the old card order is sent again if it moved.
 *
 * What is still opened is what is *folded*, and that is the page's to open (`startArranging` does
 * not know about bands): planning is about what comes after what, and a dependency you cannot see is
 * one you cannot set. It keeps the filter and the section, so a hire can plan one area without the
 * board jumping to everything first.
 */
export function useBoardPlanning({ board, boardId, projectId, reorder }: Params) {
  const [isArranging, setIsArranging] = useState(false);
  /** The arrangement as it stood when planning began, so Cancel can put it back. */
  const [planStart, setPlanStart] = useState<PlanSnapshot | null>(null);
  /** The arrangement as it is now while planning, read again on every write to it. */
  const [planDocument, setPlanDocument] = useState<BoardDocument | null>(null);

  useEffect(() => {
    if (!isArranging) return;

    // Read after the write has finished: some layers are written from inside a state updater, and
    // setting state from there would be an update during render.
    return subscribeToBoardStorageWritten(() =>
      queueMicrotask(() => setPlanDocument(readBoardDocument(boardId, projectId))),
    );
  }, [isArranging, boardId, projectId]);

  /** How much planning has changed so far. Zero outside planning. */
  const planChanges = useMemo(() => {
    if (!isArranging || !planStart || !planDocument || !board) return 0;

    return countPlanChanges(
      planStart,
      planDocument,
      board.cards.map((card) => card.id),
    );
  }, [isArranging, planStart, planDocument, board]);

  function startArranging() {
    const document = readBoardDocument(boardId, projectId);
    setPlanStart({ document, order: board?.cards.map((card) => card.id) ?? [] });
    setPlanDocument(document);
    setIsArranging(true);
  }

  /** Leaves planning and keeps what was changed -- every change is already saved as it is made. */
  function finishArranging() {
    setIsArranging(false);
    setPlanStart(null);
    setPlanDocument(null);
  }

  /** Leaves planning and puts the board back the way it was when planning began. */
  function cancelArranging() {
    if (planStart && board) {
      applyBoardDocument(
        boardId,
        projectId,
        revertedDocument(planStart, readBoardDocument(boardId, projectId)),
      );
      notifyBoardStorageWritten();

      const current = board.cards.map((card) => card.id);
      const order = revertedOrder(planStart, current);
      if (!sameOrder(order, current)) void reorder(order);
    }
    finishArranging();
  }

  return { isArranging, planChanges, startArranging, finishArranging, cancelArranging };
}
