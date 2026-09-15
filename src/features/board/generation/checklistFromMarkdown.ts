import type { AuthoredCardRequest } from "../types";

/**
 * Reading a to-do list out of something the buddy wrote, so it can become a card.
 *
 * The buddy answers "what should I do first?" with a list, every time — that is what the question
 * deserves. Until now that list lived in a conversation which is deliberately not replayed: the
 * window is folded into the mentor's memory on the way out, so the hire came back the next morning
 * to a fresh greeting and no list. They retyped it, or they did not.
 *
 * So a reply that contains a list gets an offer to keep it. The card is made of the buddy's own
 * words, not of a second generation pass — nothing here asks a model anything, and every line on
 * the resulting card is a line the hire already read in the reply above it. That is what makes the
 * card checkable: it says what the conversation said.
 *
 * TODO(backend): the offer is the hire's, which is why it is a button rather than a tool call. A
 * `place_checklist` tool on the buddy would let it keep a list without being asked — worth having,
 * and worth being careful with, since it is the first content the mentor would ever author onto a
 * board. Whatever ships, this stays: a hire scrolling back to a list from yesterday should be able
 * to keep it then, too.
 */

/**
 * The fewest lines that count as a list worth keeping.
 *
 * Two, not one. A single bullet is how a model emphasises one thing, and offering to file it as a
 * checklist would put the button under half the replies in the thread — at which point nobody reads
 * it, including on the replies where it matters.
 */
const MIN_ITEMS = 2;

/** How many lines a card will take; beyond this the reply is prose with a list in it, not a list. */
const MAX_ITEMS = 25;

/** A bullet, a number, or a task box, with the text after it. */
const LIST_ITEM = /^\s{0,6}(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s*)?(.+?)\s*$/;

/** A markdown heading, which is the best title a list ever gets. */
const HEADING = /^\s{0,3}#{1,6}\s+(.+?)\s*$/;

export type ExtractedChecklist = {
  title: string;
  items: string[];
};

/**
 * The best to-do list in a buddy reply, or null when it holds none.
 *
 * "Best" is the longest qualifying block rather than the first: a reply that opens with two caveats
 * as bullets and then gives six steps is offering the six steps, and taking the first block would
 * file the caveats and drop the answer.
 */
export function extractChecklist(markdown: string): ExtractedChecklist | null {
  const lines = markdown.split("\n");

  let best: ExtractedChecklist | null = null;
  let items: string[] = [];
  let startedAt = 0;

  const close = () => {
    if (items.length >= MIN_ITEMS && (best === null || items.length > best.items.length)) {
      best = { title: titleBefore(lines, startedAt), items: items.slice(0, MAX_ITEMS) };
    }
    items = [];
  };

  lines.forEach((line, index) => {
    const match = LIST_ITEM.exec(line);
    if (match) {
      if (items.length === 0) startedAt = index;
      items.push(plain(match[1]));

      return;
    }

    // A blank line inside a list is ordinary markdown spacing, so it does not end the block; a line
    // of prose does. Without that, a loosely-spaced list of six would come through as six lists of
    // one and never qualify.
    if (line.trim().length > 0) close();
  });
  close();

  return best;
}

/**
 * What to call the list: the nearest heading or lead-in sentence above it.
 *
 * Looks back a few lines only. A title from further away is not a title for *this* list, and a card
 * titled with something the hire cannot see the connection to is worse than one titled generically.
 */
function titleBefore(lines: string[], listStart: number): string {
  for (let index = listStart - 1; index >= 0 && index >= listStart - 4; index -= 1) {
    const line = lines[index].trim();
    if (line.length === 0) continue;
    if (LIST_ITEM.test(line)) break;

    const heading = HEADING.exec(line);
    const text = plain(heading ? heading[1] : line).replace(/[:：]\s*$/, "");

    // A lead-in runs to a sentence or two; a paragraph above a list is context, not a name for it.
    if (text.length > 0 && text.length <= 80) return text;
    break;
  }

  return "From your buddy";
}

/** Markdown emphasis, code ticks and link syntax taken off, so a card line reads as a line. */
function plain(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__|\*|_|`)/g, "")
    .trim();
}

/** The extracted list as the board's authored-card request. */
export function toChecklistRequest(checklist: ExtractedChecklist): AuthoredCardRequest {
  return {
    kind: "CHECKLIST",
    title: checklist.title,
    items: checklist.items.map((text) => ({ text, done: false })),
  };
}
