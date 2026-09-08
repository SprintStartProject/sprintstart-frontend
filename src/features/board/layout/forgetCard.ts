import { readBoardStructure, writeBoardStructure } from "./boardStructure";
import { readBoardGroups, writeBoardGroups } from "./boardGroups";
import { readCollapsedCards, writeCollapsedCards } from "./collapsedCards";
import { readPinnedCards, writePinnedCards } from "./pinnedCards";
import { readCardSizes, writeCardSizes } from "./cardSizes";
import { readCardOrigins, writeCardOrigins } from "./cardOrigins";
import { readCardMarks, writeCardMarks } from "../marks/cardMarks";
import { notifyBoardStorageReplaced, whileApplying } from "./boardStorage";

/**
 * Forgets everything the arrangement said about one card.
 *
 * Called when a card is really gone — after the dismissal has been through the server and its undo
 * window has closed, never on the optimistic removal, because a card that comes back should come
 * back arranged the way it was.
 *
 * Each layer already copes with an id it cannot resolve: the structure prunes on write, the section
 * bar ignores members that are not there, a size for a card nobody can see is a row nobody reads.
 * So this is not a correctness fix, it is a housekeeping one — the arrangement is now sent to the
 * server on every change, and an arrangement that only ever grows is a request that only ever gets
 * bigger, describing cards that stopped existing months ago.
 *
 * **Dependencies pointing *at* the card go too.** That one is not housekeeping: a card that waits on
 * something dismissed is a card that waits forever, and while the derivation already drops blockers
 * it cannot find, leaving the edge stored means it comes back the moment the id is reused.
 */
export function forgetCard(boardId: string, projectId: string, cardId: string): void {
  whileApplying(() => {
    const structure = readBoardStructure(boardId);
    const cards = { ...structure.cards };
    delete cards[cardId];
    for (const [id, entry] of Object.entries(cards)) {
      const dependsOn = entry.dependsOn?.filter((dependency) => dependency.id !== cardId);
      if (dependsOn?.length !== entry.dependsOn?.length) cards[id] = { ...entry, dependsOn };
    }
    writeBoardStructure(boardId, { ...structure, cards });

    writeBoardGroups(
      boardId,
      readBoardGroups(boardId).map((group) => ({
        ...group,
        cardIds: group.cardIds.filter((id) => id !== cardId),
      })),
    );

    writeCollapsedCards(boardId, without(readCollapsedCards(boardId), cardId));
    writePinnedCards(boardId, without(readPinnedCards(boardId), cardId));

    const sizes = { ...readCardSizes(boardId) };
    delete sizes[cardId];
    writeCardSizes(boardId, sizes);

    const origins = { ...readCardOrigins(projectId) };
    delete origins[cardId];
    writeCardOrigins(projectId, origins);

    const marks = { ...readCardMarks(projectId) };
    delete marks[cardId];
    writeCardMarks(projectId, marks);
  });

  // Every surface holding a copy of one of these has to look again — the areas one in particular,
  // which would otherwise keep counting a card that is no longer on the board.
  notifyBoardStorageReplaced();
}

function without(ids: Set<string>, cardId: string): Set<string> {
  const next = new Set(ids);
  next.delete(cardId);

  return next;
}
