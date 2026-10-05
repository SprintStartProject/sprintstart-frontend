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
 * The highlights that read as one with `piece`: the run itself, and every neighbour reached across
 * nothing but layout — whitespace, a line break, a list marker, `**`, a link's target — that is
 * painted the same colour.
 *
 * A highlight cannot reach across a line or out of a bold word, so one stroke over a list is
 * stored as one `==…==` per item (see `markAsSeen`). To the hire it is still one highlight, and
 * removing it or changing its colour has to act on all of it — while two items they marked
 * separately in *different* colours stay two highlights. Same colour and nothing visible between
 * them is the one case the text cannot tell apart, and there they act as one.
 *
 * `without` is the text with the whole group's delimiters taken out, by position, so a second
 * occurrence of the same words elsewhere in the note is left alone. Null when `piece` is not a
 * highlight in the text.
 */
export function markGroup(
  text: string,
  piece: string,
  colorOf: (run: string) => string,
): { texts: string[]; without: string } | null {
  const needle = piece.trim();
  const runs: { text: string; marked: boolean; start: number; end: number }[] = [];
  let offset = 0;
  for (const run of splitMarks(text)) {
    const length = run.marked ? run.text.length + 2 * MARK.length : run.text.length;
    runs.push({ ...run, start: offset, end: offset + length });
    offset += length;
  }
  // Whatever follows the last highlight is not in `splitMarks`' runs; it never joins a group.

  const at = runs.findIndex((run) => run.marked && run.text === needle);
  if (at === -1) return null;

  const color = colorOf(needle);
  const joins = (from: number, step: 1 | -1): number => {
    const gap = runs[from + step];
    const neighbour = gap?.marked ? gap : runs[from + 2 * step];
    if (!neighbour?.marked || colorOf(neighbour.text) !== color) return -1;
    if (!gap.marked && !onlyLayout(gap.text)) return -1;

    return runs.indexOf(neighbour);
  };

  const members = [at];
  for (let next = joins(at, -1); next !== -1; next = joins(next, -1)) members.unshift(next);
  for (let next = joins(at, 1); next !== -1; next = joins(next, 1)) members.push(next);

  let without = text;
  for (const index of [...members].reverse()) {
    const run = runs[index];
    without = `${without.slice(0, run.start)}${run.text}${without.slice(run.end)}`;
  }

  return { texts: members.map((index) => runs[index].text), without };
}

/** Whether a stretch of source shows nothing on the card: whitespace and Markdown syntax only. */
function onlyLayout(gap: string): boolean {
  return (
    gap
      .replace(/\]\([^)\n]*\)/g, "")
      .replace(/^[ \t]*\d+[.)]/gm, "")
      .replace(/\[[ xX]\]/g, "")
      .replace(/[\s*_~>#+\-[\]]/g, "").length === 0
  );
}

/**
 * The parts of a note's source that are not prose a person reads: Markdown link targets
 * (`](…)`), inline code, code fences, `[[…]]` links and bare app paths. A highlight placed inside
 * one of these would change what a link points at — `/==onboarding==?step=…` is a link to nothing —
 * while highlighting nothing anybody can see, so {@link toggleMark} never looks there.
 *
 * Half-open `[start, end)` ranges into the source.
 */
export function unmarkableRanges(text: string): [number, number][] {
  const ranges: [number, number][] = [];
  const patterns = [
    /```[\s\S]*?(?:```|$)/g,
    /`[^`\n]*`/g,
    /\]\([^)\n]*\)/g,
    /\[\[[^[\]\n]*\]\]/g,
    /(?:https?:\/\/|(?<![\w/])\/)[^\s)\]]+/g,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      ranges.push([match.index, match.index + match[0].length]);
    }
  }
  return ranges;
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
  // one pair inside another, and the parser reads the first closing `==` it finds. And only in
  // prose: never inside a link target, code or a `[[…]]` — see `unmarkableRanges`.
  const blocked = unmarkableRanges(text);
  const isFree = (start: number) =>
    !blocked.some(([from, to]) => start < to && start + needle.length > from);

  let offset = 0;
  for (const run of splitMarks(text)) {
    if (!run.marked) {
      for (let at = run.text.indexOf(needle); at !== -1; at = run.text.indexOf(needle, at + 1)) {
        const start = offset + at;
        if (isFree(start)) {
          return `${text.slice(0, start)}${marked}${text.slice(start + needle.length)}`;
        }
      }
    }
    // Marked runs sit between two delimiters in the source, so stepping over one costs both.
    offset += run.marked ? run.text.length + 2 * MARK.length : run.text.length;
  }

  return markAsSeen(text, needle) ?? text;
}

/**
 * Marks a selection the way the card *shows* it, when it is not found in the source as it stands.
 *
 * What the hire selects is the rendered note, flattened by the selection code into one line with
 * single spaces. The source has line breaks where the card has them, list markers and `**` where
 * the card has bullets and bold, and link syntax around a link's words. So a selection across two
 * lines, or over a bold word and the next, is not a substring of the source — which, for a note
 * written in Markdown, is most selections worth making.
 *
 * So the source is read the way the card shows it: syntax dropped, whitespace collapsed, each
 * visible character remembering where it sits in the source. The selection is found in that, and
 * every unbroken stretch of source it covers is wrapped on its own — `**==bold==** ==word==`,
 * `==line one==` / `==line two==` — because a highlight is drawn inside one run of text and cannot
 * reach across a line break or out of a bold word. Never inside link targets, code, `[[…]]` or an
 * existing highlight. Null when the selection is not there either.
 */
function markAsSeen(text: string, needle: string): string | null {
  const wanted = needle.replace(/\s+/g, " ").trim();
  if (wanted.length === 0) return null;

  const hidden = new Set<number>();
  const block = (from: number, to: number) => {
    for (let index = from; index < to; index++) hidden.add(index);
  };
  const markedAt = new Set<number>();

  // Not prose at all: nothing in these is visible as typed, or may be painted.
  for (const [from, to] of unmarkableRanges(text)) block(from, to);
  // Existing highlights: their delimiters are syntax, their words are off limits.
  let offset = 0;
  for (const run of splitMarks(text)) {
    if (run.marked) {
      block(offset, offset + MARK.length);
      for (
        let index = offset + MARK.length;
        index < offset + MARK.length + run.text.length;
        index++
      )
        markedAt.add(index);
      block(offset + MARK.length + run.text.length, offset + 2 * MARK.length + run.text.length);
      offset += run.text.length + 2 * MARK.length;
    } else {
      offset += run.text.length;
    }
  }
  // Line-start syntax: headings, bullets, numbers, quotes, task boxes.
  for (const match of text.matchAll(
    /^[ \t]*(?:#{1,6}[ \t]+|>[ \t]?|(?:[-*+]|\d+[.)])[ \t]+(?:\[[ xX]\][ \t]+)?)/gm,
  )) {
    block(match.index, match.index + match[0].length);
  }
  // Emphasis markers, and the bracket that opens a link's words.
  for (const match of text.matchAll(/\*\*|__|~~|\*|\[(?!\[)/g)) {
    block(match.index, match.index + match[0].length);
  }

  // The card's text, one character at a time, with where each came from. Whitespace collapses to
  // one space that remembers it was a break, so a match never stitches across one.
  const seen: { char: string; at: number }[] = [];
  for (let index = 0; index < text.length; index++) {
    if (hidden.has(index) && !markedAt.has(index)) continue;
    const char = text[index];
    if (/\s/.test(char)) {
      if (seen.length > 0 && seen[seen.length - 1].char !== " ") seen.push({ char: " ", at: -1 });
      continue;
    }
    seen.push({ char, at: index });
  }
  const flat = seen.map((entry) => entry.char).join("");

  for (let start = flat.indexOf(wanted); start !== -1; start = flat.indexOf(wanted, start + 1)) {
    const covered = seen.slice(start, start + wanted.length);
    if (covered.some((entry) => entry.at !== -1 && markedAt.has(entry.at))) continue;

    // Unbroken stretches of the source, each wrapped on its own.
    const stretches: [number, number][] = [];
    for (const entry of covered) {
      if (entry.at === -1) continue;
      const last = stretches[stretches.length - 1];
      const between = last ? text.slice(last[1], entry.at) : "";
      if (last && (entry.at === last[1] || /^[^\S\n]+$/.test(between))) last[1] = entry.at + 1;
      else stretches.push([entry.at, entry.at + 1]);
    }
    if (stretches.length === 0) return null;

    let result = text;
    for (const [from, to] of [...stretches].reverse()) {
      result = `${result.slice(0, from)}${MARK}${result.slice(from, to)}${MARK}${result.slice(to)}`;
    }
    return result;
  }

  return null;
}
