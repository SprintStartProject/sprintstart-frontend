import {
  readBoardStructure,
  writeBoardStructure,
  type BoardStage,
  type CardStructure,
} from "../layout/boardStructure";
import { readBoardGroups, writeBoardGroups, type BoardGroup } from "../layout/boardGroups";
import { readCollapsedCards, writeCollapsedCards } from "../layout/collapsedCards";
import { readPinnedCards, writePinnedCards } from "../layout/pinnedCards";
import { readCardSizes, writeCardSizes, type CardSizes, type CardWidth } from "../layout/cardSizes";
import { readCardOrigins, writeCardOrigins, type CardOrigins } from "../layout/cardOrigins";
import { readCardMarks, writeCardMarks, type CardMarks } from "../marks/cardMarks";
import { readMarkLabels, writeMarkLabels, type MarkLabels } from "../marks/markLabels";
import { toHighlightColor, type HighlightColor } from "../marks/highlightColors";
import { notifyBoardStorageReplaced, whileApplying } from "../layout/boardStorage";

/**
 * Everything the hire has said *about* their board, gathered into one document.
 *
 * The seven things it collects are stored separately on purpose — folds, pins, areas, stages and
 * dependencies, sizes, origins and marks each have their own module, their own versioning and their
 * own reasons. Nothing here changes that. This is the one place that knows the whole set, so that
 * it can be sent somewhere as a single statement about the board and come back the same way.
 *
 * Two ids, because the layers are keyed differently and each for a reason: what the *board* holds
 * is keyed by board, and what follows the hire across a project — where a card came from, what they
 * marked — is keyed by project, since the surfaces that write those (the selection toolbar, the
 * chat, the buddy dock) know a project and not a board.
 */
export type BoardDocument = {
  cards: Record<string, CardStructure>;
  groupStages: Record<string, BoardStage>;
  groups: BoardGroup[];
  collapsedCardIds: string[];
  pinnedCardIds: string[];
  sizes: CardSizes;
  origins: CardOrigins;
  marks: CardMarks;
  /** What the hire calls each highlight colour. See `marks/markLabels.ts`. */
  markLabels: MarkLabels;
};

/**
 * The same document as the server spells it.
 *
 * Two enums are cased differently on the two sides and this is where that stops being anybody
 * else's problem: the backend writes `NARROW` and `YELLOW`, consistent with its own `BoardCardKind`
 * and everything around it, while the client has always stored these lowercase. Neither side is
 * wrong and neither should bend to the other in the twenty files that use them, so they are
 * translated once, here.
 */
export type BoardDocumentWire = {
  cards: Record<string, CardStructure>;
  groupStages: Record<string, BoardStage>;
  groups: BoardGroup[];
  collapsedCardIds: string[];
  pinnedCardIds: string[];
  sizes: Record<string, { width: "NARROW" | "NORMAL" | "WIDE" }>;
  origins: CardOrigins;
  marks: Record<string, { text: string; color: "YELLOW" | "GREEN" | "BLUE" | "PINK" }[]>;
  markLabels: Record<string, string>;
};

const WIDTH_UP: Record<CardWidth, BoardDocumentWire["sizes"][string]["width"]> = {
  narrow: "NARROW",
  normal: "NORMAL",
  wide: "WIDE",
};

const COLOR_UP: Record<HighlightColor, "YELLOW" | "GREEN" | "BLUE" | "PINK"> = {
  yellow: "YELLOW",
  green: "GREEN",
  blue: "BLUE",
  pink: "PINK",
};

/** Everything this browser holds about this board, as one document. */
export function readBoardDocument(boardId: string, projectId: string): BoardDocument {
  const structure = readBoardStructure(boardId);

  return {
    cards: structure.cards,
    groupStages: structure.groupStages,
    groups: readBoardGroups(boardId),
    collapsedCardIds: [...readCollapsedCards(boardId)],
    pinnedCardIds: [...readPinnedCards(boardId)],
    sizes: readCardSizes(boardId),
    origins: readCardOrigins(projectId),
    marks: readCardMarks(projectId),
    markLabels: readMarkLabels(projectId),
  };
}

/**
 * Puts a document back into the layers it came from, and says so.
 *
 * Every layer is written, including the empty ones: applying a document is "this is the
 * arrangement", and skipping the empty parts would silently keep whatever this browser happened to
 * have — which is exactly the local state the document was fetched to replace.
 *
 * The announcement is not optional. The layers are read once, into React state, by surfaces that
 * have no way to know this happened. See `layout/boardStorage.ts`.
 */
export function applyBoardDocument(
  boardId: string,
  projectId: string,
  document: BoardDocument,
): void {
  // Wrapped, so that seven layers writing themselves does not read as seven changes worth sending
  // straight back to the server this document just came from.
  whileApplying(() => {
    writeBoardStructure(boardId, { cards: document.cards, groupStages: document.groupStages });
    writeBoardGroups(boardId, document.groups);
    writeCollapsedCards(boardId, new Set(document.collapsedCardIds));
    writePinnedCards(boardId, new Set(document.pinnedCardIds));
    writeCardSizes(boardId, document.sizes);
    writeCardOrigins(projectId, document.origins);
    writeCardMarks(projectId, document.marks);
    writeMarkLabels(projectId, document.markLabels);
  });

  notifyBoardStorageReplaced();
}

/**
 * Whether a document says nothing at all.
 *
 * What decides, on the first load of a visit, which side wins: a server that has never heard from
 * this hire takes what the browser has been keeping; anything else and the server is the answer.
 * "Arranged and then cleared" is not empty in that sense — the server would still hold the areas
 * somebody named — so this only ever fires for a board nobody has touched.
 */
export function isEmptyDocument(document: BoardDocument): boolean {
  return (
    Object.keys(document.cards).length === 0 &&
    Object.keys(document.groupStages).length === 0 &&
    document.groups.length === 0 &&
    document.collapsedCardIds.length === 0 &&
    document.pinnedCardIds.length === 0 &&
    Object.keys(document.sizes).length === 0 &&
    Object.keys(document.origins).length === 0 &&
    Object.keys(document.marks).length === 0 &&
    Object.keys(document.markLabels).length === 0
  );
}

export function toWire(document: BoardDocument): BoardDocumentWire {
  return {
    ...document,
    sizes: Object.fromEntries(
      Object.entries(document.sizes).map(([id, size]) => [id, { width: WIDTH_UP[size.width] }]),
    ),
    marks: Object.fromEntries(
      Object.entries(document.marks).map(([id, marks]) => [
        id,
        marks.map((mark) => ({ text: mark.text, color: COLOR_UP[mark.color] })),
      ]),
    ),
    // Keyed by the colour in the server's spelling, so the legend survives the same round trip its
    // colours do.
    markLabels: Object.fromEntries(
      Object.entries(document.markLabels).map(([color, name]) => [
        COLOR_UP[color as HighlightColor],
        name,
      ]),
    ),
  };
}

/**
 * A document as it came off the wire.
 *
 * Defensive in the same way the storage readers are, and for a stronger reason: this arrives from
 * a server that may be a version ahead. An unknown width or colour falls back rather than losing
 * the entry that carries it, and a missing field reads as empty rather than as undefined —
 * `applyBoardDocument` writes every field, so an undefined one would be written as such.
 */
export function fromWire(wire: Partial<BoardDocumentWire> | null | undefined): BoardDocument {
  return {
    cards: wire?.cards ?? {},
    groupStages: wire?.groupStages ?? {},
    groups: wire?.groups ?? [],
    collapsedCardIds: wire?.collapsedCardIds ?? [],
    pinnedCardIds: wire?.pinnedCardIds ?? [],
    sizes: Object.fromEntries(
      Object.entries(wire?.sizes ?? {}).map(([id, size]) => [id, { width: toWidth(size?.width) }]),
    ),
    origins: wire?.origins ?? {},
    marks: Object.fromEntries(
      Object.entries(wire?.marks ?? {}).map(([id, marks]) => [
        id,
        (marks ?? []).map((mark) => ({
          text: mark.text,
          color: toHighlightColor(String(mark.color).toLowerCase()),
        })),
      ]),
    ),
    markLabels: Object.fromEntries(
      Object.entries(wire?.markLabels ?? {})
        .filter(([, name]) => typeof name === "string" && name.trim().length > 0)
        .map(([color, name]): [HighlightColor, string] => [
          toHighlightColor(color.toLowerCase()),
          name,
        ]),
    ),
  };
}

function toWidth(value: unknown): CardWidth {
  if (value === "NARROW") return "narrow";
  if (value === "WIDE") return "wide";

  return "normal";
}
