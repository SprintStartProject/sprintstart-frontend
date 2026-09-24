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

/** A line of a task, and whether the task already has it ticked. */
export type StatedStep = { text: string; done: boolean };

/** A task-list checkbox — `- [ ]`, `- [x]` — at the start of a list item. */
const CHECKBOX = /^\s{0,6}(?:[-*+]|\d+[.)])\s+\[([ xX])\]/;

/** A line that is nothing but bold text — how people head a section without a `#`. */
const BOLD_LINE = /^\s*(?:\*\*|__)(.+?)(?:\*\*|__)\s*[:：]?\s*$/;

/**
 * Section names whose lists are things to do. Anything else — References, Affected services, Out
 * of scope, Notes — is a list *about* the task, and ticking it off would mean nothing.
 */
const STEP_SECTION =
  /\b(?:steps?|tasks?|to-?dos?|checklist|acceptance criteria|definition of done|how to)\b/i;

/**
 * The steps a task body states, in the order it states them, with what it has already ticked.
 *
 * The looser reading of the same lines {@link extractChecklist} groups into blocks, and the two
 * wants are genuinely different. A buddy reply is prose that *may* contain a list, so the question
 * there is which block is the answer. A task body is a document somebody wrote as a task: its
 * checklist items and its acceptance criteria are both lists of things to do, separated by the
 * headings between them, and taking only the longest block would drop half the task.
 *
 * But not every list in a task is a list of things to do, and a card that asks the hire to tick
 * off two reference links is a card that has misread the task. So a line counts when either:
 *
 * - **it is a checkbox**, wherever it sits — somebody wrote it to be ticked; or
 * - **it is under a section named for steps** — "Steps", "Tasks", "Acceptance Criteria",
 *   "Definition of Done" — or under no section name at all, where a bare list in a task is the
 *   task's list.
 *
 * A section is named by a markdown heading or a line that is only bold text, and its name holds
 * until the next one. A lead-in sentence ending in a colon does not name one: "To reproduce:" and
 * "It fails when:" introduce steps as often as "See also:" introduces links, and a rule that
 * guessed from the wording would drop real steps to catch the odd reference list.
 *
 * A ticked box stays ticked. The task already records that line as done, and a fresh checkbox
 * beside it would tell a new hire to repeat work somebody has finished.
 *
 * No minimum, either — one acceptance criterion is still the task saying what has to be true.
 */
export function stepsIn(markdown: string): StatedStep[] {
  const steps: StatedStep[] = [];
  let section: string | null = null;

  for (const line of markdown.split("\n")) {
    const item = LIST_ITEM.exec(line);
    if (item) {
      const box = CHECKBOX.exec(line);
      const counts = box !== null || section === null || STEP_SECTION.test(section);
      const text = plain(item[1]);
      if (counts && text.length > 0) steps.push({ text, done: box !== null && box[1] !== " " });
      continue;
    }

    const name = sectionName(line);
    if (name !== null) section = name;
  }

  return steps;
}

/** The section a line opens, or null when it opens none. */
function sectionName(line: string): string | null {
  const match = HEADING.exec(line) ?? BOLD_LINE.exec(line);

  return match ? plain(match[1]) : null;
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
