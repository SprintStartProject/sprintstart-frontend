import type { BoardCardKind } from "../types";

/**
 * The accent one kind of card wears: its glyph's ink, and the bloom behind the corner.
 *
 * Four accents for eleven kinds, on purpose. Eleven colours would be a legend nobody can hold in
 * their head, and a board that looks like a paint chart. Repeating a small set gives the eye
 * something to sort by without pretending the colour *means* anything.
 *
 * **Only decorative accents are used** — brand, purple, orange and the muted default. The status
 * colours are deliberately left out: `success`, `warning` and `danger` carry a fixed meaning in
 * this app, and an arrival card sitting in amber would read as a problem whether or not anything
 * was outstanding. Per AGENTS.md §7 the colour is never the message here: the glyph and the title
 * carry it, and the accent only helps you find the card again.
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

const BRAND: CardAccent = {
  icon: "text-app-brand-text",
  chip: "bg-app-brand/10",
  edge: "bg-app-brand",
  bloom: "bg-app-brand/10",
};
const PURPLE: CardAccent = {
  icon: "text-app-purple-text",
  chip: "bg-app-purple-text/10",
  edge: "bg-app-purple-text",
  bloom: "bg-app-purple-text/10",
};
const ORANGE: CardAccent = {
  icon: "text-app-orange-text",
  chip: "bg-app-orange-text/10",
  edge: "bg-app-orange-text",
  bloom: "bg-app-orange-text/10",
};
/** The hire's own cards, and the mentor's notes: quiet by design. */
const QUIET: CardAccent = {
  icon: "text-app-text-muted",
  chip: "bg-app-neutral-text/10",
  edge: "bg-app-neutral-text/40",
  bloom: "bg-app-neutral-text/10",
};

const ACCENTS: Record<BoardCardKind, CardAccent> = {
  PATH_TO_FIRST_CONTRIBUTION: BRAND,
  CURRENT_TASK: BRAND,
  DIAGRAM: BRAND,
  ARRIVAL_STEPS: ORANGE,
  OPEN_PULL_REQUESTS: ORANGE,
  SUGGESTED_TASKS: PURPLE,
  COMPETENCY_PROGRESS: PURPLE,
  MEMORY_RECAP: QUIET,
  NOTE: QUIET,
  LINK: QUIET,
  CHECKLIST: QUIET,
};

export function cardAccent(kind: BoardCardKind): CardAccent {
  return ACCENTS[kind] ?? QUIET;
}
