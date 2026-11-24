import { useEffect, useMemo, useState } from "react";
import type { Board, BoardCard } from "../types";
import { hasNewlyBehind, readBehindSeen, writeBehindSeen } from "../layout/behindSeen";
import {
  BOARD_STAGES,
  currentStage,
  type BoardStage,
  type CardState,
} from "../layout/boardStructure";
import { FOLD_THRESHOLD } from "../layout/foldThreshold";

type Params = {
  board: Board | null;
  boardId: string;
  allCards: BoardCard[];
  states: Map<string, CardState>;
  /** Whether the onboarding path has been read, which is when cards can be told to be behind. */
  pathSettled: boolean;
};

type KnownBehind = { boardId: string; key: string } | null;

/** The bands a board arrives with: small boards open but for "Behind you", big ones on the current stage only. */
function initialStages(cardCount: number, states: Map<string, CardState>): Set<BoardStage> {
  return cardCount > FOLD_THRESHOLD
    ? new Set([currentStage(states)])
    : new Set(BOARD_STAGES.filter((stage) => stage !== "BEHIND"));
}

/** The ids of the cards that are behind, sorted, once the path has been read; `null` before. */
function behindIdsOf(
  cards: BoardCard[],
  states: Map<string, CardState>,
  pathSettled: boolean,
): string[] | null {
  if (!pathSettled) return null;
  return cards
    .filter((card) => states.get(card.id)?.stage === "BEHIND")
    .map((card) => card.id)
    .sort();
}

/**
 * What has changed about the cards behind, if anything has since last looked.
 *
 * What was behind is known from this visit when the board has been seen already, and from storage
 * (`null` the very first time) when it has not -- and the very first time never opens the band.
 */
function behindChange(known: KnownBehind, boardId: string, behindIds: string[] | null) {
  if (behindIds === null) return null;
  const key = behindIds.join("|");
  if (known?.boardId === boardId && known.key === key) return null;

  const before =
    known?.boardId === boardId
      ? new Set(known.key.split("|").filter(Boolean))
      : readBehindSeen(boardId);
  return { key, opensBand: hasNewlyBehind(before, behindIds) };
}

/**
 * Which stage bands are open.
 *
 * A fold, not a mode: taking the cards that are not due *off the board* would leave the hire taking
 * the rest on trust. The bands put all of it on the page, named, counted and one click from being
 * read.
 *
 * Decided once per board rather than remembered: which shape is right is a question about how big
 * *this* board is, and a hire who opened everything on a six-card board last month should not meet
 * a forty-card one wide open. A small board arrives with every band open, because folding four cards
 * into three headings is ceremony, not help.
 */
export function useStageBands({ board, boardId, allCards, states, pathSettled }: Params) {
  const [openStages, setOpenStages] = useState<Set<BoardStage>>(new Set(BOARD_STAGES));
  const [bandsDecidedFor, setBandsDecidedFor] = useState<string | null>(null);

  if (board && boardId !== bandsDecidedFor) {
    setBandsDecidedFor(boardId);
    // "Behind you" never arrives open, at any size: it holds what is finished, and it fills in only
    // once the path has been read, after this is decided.
    setOpenStages(initialStages(allCards.length, states));
  }

  /**
   * "Behind you" opens when cards have moved into it since the hire last looked.
   *
   * It arrives folded, but cards move there without the hire touching the board: a phase finished in
   * the dock or on the Onboarding page, a note kept from a step of a finished phase. A band that
   * silently swallows them reads as the cards being gone. So what was behind last time is remembered
   * (`behindSeen.ts`) -- across visits, and while the board stays open -- and any card that is new
   * there unfolds the band once. Folding it again is the hire's call and sticks.
   */
  const behindIds = useMemo(
    () => behindIdsOf(allCards, states, pathSettled),
    [allCards, pathSettled, states],
  );
  const [knownBehind, setKnownBehind] = useState<KnownBehind>(null);

  const change = board ? behindChange(knownBehind, boardId, behindIds) : null;
  if (change) {
    setKnownBehind({ boardId, key: change.key });
    if (change.opensBand) setOpenStages((current) => new Set([...current, "BEHIND"]));
  }

  useEffect(() => {
    if (board && behindIds !== null) writeBehindSeen(boardId, behindIds);
  }, [board, boardId, behindIds]);

  function toggleStage(stage: BoardStage) {
    setOpenStages((current) => {
      const next = new Set(current);
      if (next.has(stage)) next.delete(stage);
      else next.add(stage);

      return next;
    });
  }

  return {
    openStages,
    toggleStage,
    /** Opens every band, the way planning and "show everything" want them. */
    openAllStages: () => setOpenStages(new Set(BOARD_STAGES)),
  };
}
