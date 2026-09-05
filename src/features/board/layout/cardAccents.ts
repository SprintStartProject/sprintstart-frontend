import type { BoardCardKind } from "../types";

/**
 * The accent one kind of card wears: its glyph's ink, the square that glyph sits in, the strip down
 * its leading edge and the bloom in its corner.
 *
 * **Six accents for eleven kinds.** It was four, and three of those four went to cards the board
 * puts there itself — so a hire whose board was mostly their own notes, links and checklists was
 * looking at a column of grey. The colour is what makes a board read as a set of different things
 * before any of it is read, and the cards somebody actually makes were the ones getting none of it.
 * The three kinds a hire writes now have three accents of their own, and no two of them are the
 * same.
 *
 * Six rather than eleven, still. One colour per kind would be a legend nobody can hold in their
 * head and a board that looks like a paint chart; a small set repeated gives the eye something to
 * sort by without pretending the colour *means* anything. Where a colour is shared, it is shared
 * between two kinds that rarely fill a board together.
 *
 * **Only decorative accents are used** — brand, cyan, indigo, purple, pink and orange. The status
 * colours are deliberately left out: `success`, `warning` and `danger` carry a fixed meaning in
 * this app, and an arrival card sitting in amber would read as a problem whether or not anything
 * was outstanding. Green is out for the same reason even as a decoration, which is why the cool
 * end of this set is cyan rather than teal. Per AGENTS.md §7 the colour is never the message here:
 * the glyph and the title carry it, and the accent only helps you find the card again.
 *
 * **Four places, one colour.** The accent used to be a glyph and a bloom so faint that a board of
 * mixed kinds read as one texture — you could not tell a link from a checklist without reading
 * either. Now the same colour also fills the square the glyph sits in and runs as a strip down the
 * card's leading edge, which is the part that survives being seen out of the corner of an eye. The
 * strip is deliberately the *only* new ink: tinting a whole card by kind would leave a board of
 * eleven cards looking like a paint chart, and would be a much louder claim than "these two are the
 * same sort of thing".
 */
export type CardAccent = {
  /** Ink for the card's glyph. */
  icon: string;
  /** The tinted square the glyph sits in. */
  chip: string;
  /** The strip down the card's leading edge. */
  edge: string;
  /** The soft bloom in the card's top-right corner. */
  bloom: string;
};

/** One accent from one token, so a hue is named once and cannot drift between its four places. */
function accent(token: string): CardAccent {
  return {
    icon: `text-app-${token}-text`,
    chip: `bg-app-${token}-text/10`,
    edge: `bg-app-${token}-text`,
    bloom: `bg-app-${token}-text/10`,
  };
}

const BRAND = accent("brand");
const CYAN = accent("cyan");
const INDIGO = accent("indigo");
const PURPLE = accent("purple");
const PINK = accent("pink");
const ORANGE = accent("orange");

const ACCENTS: Record<BoardCardKind, CardAccent> = {
  // What the board is steering by: where you are going, and what you are on right now.
  PATH_TO_FIRST_CONTRIBUTION: BRAND,
  CURRENT_TASK: BRAND,

  // Things that come from somewhere outside the board — the joining process, and the repository.
  ARRIVAL_STEPS: ORANGE,
  OPEN_PULL_REQUESTS: ORANGE,

  // What the board has worked out about the hire: what to try next, how far along they are.
  SUGGESTED_TASKS: PURPLE,
  COMPETENCY_PROGRESS: PURPLE,

  // The hire's own three, each its own colour — these are the cards a board fills up with.
  NOTE: PINK,
  LINK: CYAN,
  CHECKLIST: INDIGO,

  // Shared with a hire's kind each, because a board rarely holds many of either.
  MEMORY_RECAP: CYAN,
  DIAGRAM: INDIGO,
};

export function cardAccent(kind: BoardCardKind): CardAccent {
  return ACCENTS[kind] ?? BRAND;
}
