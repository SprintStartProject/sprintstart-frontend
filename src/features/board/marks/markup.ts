/**
 * The highlighter, as two equals signs.
 *
 * A hire reading a frozen conversation on their board wants the two sentences that mattered to look
 * different from the forty around them — the same thing a marker pen does on paper, and for the same
 * reason: the page is not the point, the two sentences are.
 *
 * **Stored inside the note's own text, as `==like this==`.** The alternative was a side table of
 * character ranges, and ranges are wrong here twice over: they are meaningless the moment the note
 * is edited (every offset after the edit points at the wrong word), and they live in storage that
 * belongs to one browser — a hire who marked up their board and opened it on a laptop would find
 * clean, unmarked cards and no way to tell that anything had been lost. Text carries its own marks.
 *
 * The syntax is the one people already know from Obsidian, Notion and GitHub. It is deliberately
 * *visible* in the editor: a note is the hire's own writing, and a mark they cannot see is a mark
 * they cannot remove. Typing `==` by hand works exactly as well as selecting and pressing the
 * button, which is what "it is just text" is worth.
 *
 * Nothing else here is markdown. `NoteCard` renders prose, on purpose (see its own note) — this is
 * one exception for one thing, not the beginning of a renderer.
 */

/** One run of a note's text, and whether it is marked. */
export type MarkedRun = { text: string; marked: boolean };

/** The delimiter, once, so the parser and the writer cannot disagree about it. */
const MARK = "==";

/**
 * A note's text split into marked and unmarked runs.
 *
 * An unclosed `==` is not a mark: it is somebody typing, or arithmetic, or a line of `=====` used as
 * a rule. Treating it as the start of a highlight would make the rest of the note light up while it
 * was being written, which is the sort of thing that teaches people not to type the character.
 */
export function splitMarks(text: string): MarkedRun[] {
  const runs: MarkedRun[] = [];
  let rest = text;

  while (rest.length > 0) {
    const open = rest.indexOf(MARK);
    if (open === -1) break;

    const close = rest.indexOf(MARK, open + MARK.length);
    if (close === -1) break;

    const inner = rest.slice(open + MARK.length, close);
    // `====` is not an empty highlight, it is a typo or a rule. Skipping past the opener rather
    // than past the whole thing lets a real mark that starts one character later still be found.
    if (inner.trim().length === 0) {
      runs.push({ text: rest.slice(0, open + MARK.length), marked: false });
      rest = rest.slice(open + MARK.length);
      continue;
    }

    if (open > 0) runs.push({ text: rest.slice(0, open), marked: false });
    runs.push({ text: inner, marked: true });
    rest = rest.slice(close + MARK.length);
  }

  if (rest.length > 0) runs.push({ text: rest, marked: false });

  return runs;
}

/** The text as a reader sees it, with the delimiters taken out. */
export function stripMarks(text: string): string {
  return splitMarks(text)
    .map((run) => run.text)
    .join("");
}

/** Whether a note carries any highlight at all. */
export function hasMarks(text: string): boolean {
  return splitMarks(text).some((run) => run.marked);
}

/** Whether these exact words are already highlighted in this text. */
export function isMarked(text: string, selected: string): boolean {
  const needle = selected.trim();

  return needle.length > 0 && splitMarks(text).some((run) => run.marked && run.text === needle);
}

/** Highlights some words, leaving the text alone when they already are. */
export function addMark(text: string, selected: string): string {
  return isMarked(text, selected) ? text : toggleMark(text, selected);
}

/** Takes the highlight off some words, leaving the text alone when they are not marked. */
export function removeMark(text: string, selected: string): string {
  return isMarked(text, selected) ? toggleMark(text, selected) : text;
}

/**
 * The highlighted run these words sit inside, or null when they sit outside every one.
 *
 * "Inside" includes "is exactly", so this answers the only question the eraser has to ask: is there
 * a highlight here for me to act on. Marking half a sentence and then wanting *that half* back is
 * the ordinary case — somebody marks a paragraph, reads it again, and decides only the middle
 * clause was the point.
 */
export function enclosingMark(text: string, selected: string): string | null {
  const needle = selected.trim();
  if (needle.length === 0) return null;

  return splitMarks(text).find((run) => run.marked && run.text.includes(needle))?.text ?? null;
}

/**
 * Puts `==` back around a fragment, unless it is only whitespace.
 *
 * The spaces stay *outside* the delimiters. `==deploys ==` would be a highlight with a trailing
 * space painted into it — visible as a stripe running past the last letter, and one more character
 * for the reader to wonder about.
 */
function rewrap(fragment: string): string {
  const inner = fragment.trim();
  if (inner.length === 0) return fragment;

  const lead = fragment.slice(0, fragment.indexOf(inner));
  const tail = fragment.slice(fragment.indexOf(inner) + inner.length);

  return `${lead}${MARK}${inner}${MARK}${tail}`;
}

/**
 * Takes the highlight off the selected words, keeping whatever was marked around them.
 *
 * The whole-highlight case is just the case where nothing is left on either side, so there is one
 * function rather than two: a hire rubbing out the middle of a marked sentence and a hire rubbing
 * out the whole of it are doing the same thing with a different aim, and an eraser that only worked
 * on exactly what was marked would be one that mostly refuses.
 *
 * Returns the text unchanged when the selection is not inside a highlight at all.
 */
export function unmarkPart(text: string, selected: string): string {
  const needle = selected.trim();
  const run = enclosingMark(text, needle);
  if (run === null) return text;

  const at = run.indexOf(needle);
  const before = run.slice(0, at);
  const after = run.slice(at + needle.length);

  return text.replace(`${MARK}${run}${MARK}`, `${rewrap(before)}${needle}${rewrap(after)}`);
}

/**
 * Puts `==` around one occurrence of `selected`, or takes them off again when it is already marked.
 *
 * Matched by *text* rather than by position, because the position the hire selected is a position in
 * the rendered card — where the delimiters are not — and mapping one to the other is exactly the
 * offset arithmetic this module exists to avoid.
 *
 * The first unmarked occurrence wins. Marking the second "deploy" in a note by selecting it and
 * getting the first one instead is a small wrongness; refusing to mark anything that appears twice
 * would be a large one, and in a note of ordinary prose most words appear once.
 *
 * Returns the text unchanged when the selection cannot be found in it — a selection that spans two
 * cards, or the card's heading and its body, has no single run to wrap.
 */
export function toggleMark(text: string, selected: string): string {
  const needle = selected.trim();
  if (needle.length === 0) return text;

  const marked = `${MARK}${needle}${MARK}`;
  if (text.includes(marked)) return text.replace(marked, needle);

  // Only outside an existing mark: wrapping a word that is already inside a highlight would nest
  // one pair inside another, and the parser reads the first closing `==` it finds.
  let offset = 0;
  for (const run of splitMarks(text)) {
    if (!run.marked) {
      const at = run.text.indexOf(needle);
      if (at !== -1) {
        const start = offset + at;
        return `${text.slice(0, start)}${marked}${text.slice(start + needle.length)}`;
      }
    }
    // Marked runs sit between two delimiters in the source, so stepping over one costs both.
    offset += run.marked ? run.text.length + 2 * MARK.length : run.text.length;
  }

  return text;
}
