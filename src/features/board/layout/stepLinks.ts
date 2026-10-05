/**
 * `[[Step title]]` in a note: a link to a step of the hire's path, the way Obsidian links notes.
 *
 * A note kept while a step was open is tied to that step by where it was made (its origin). This is
 * the other way: a note written anywhere — on the board, about the evening's debugging — that the
 * hire ties to a step themselves, by naming it. The link is drawn as a chip that opens the step, and
 * it files the note under that step's phase like an origin does (see `pathStages.ts`).
 *
 * **By title, in the text.** Nothing new is stored: the note's text is the note, on the server and
 * on every machine, and `[[Set up SSH]]` reads as what it means even where nothing draws it. The
 * price is that a step renamed or rebuilt away leaves a link that no longer resolves — which is
 * drawn as such, and is the same bargain Obsidian makes.
 */
const WIKI_LINK = /\[\[([^[\]\n]+?)\]\]/g;

/** One run of a note's text: plain, or the title inside a `[[…]]`. */
export type LinkRun = { text: string; link: boolean };

/** A note's text, split into plain runs and linked titles, in order. */
export function splitStepLinks(text: string): LinkRun[] {
  const runs: LinkRun[] = [];
  let last = 0;

  for (const match of text.matchAll(WIKI_LINK)) {
    const at = match.index;
    if (at > last) runs.push({ text: text.slice(last, at), link: false });
    runs.push({ text: match[1].trim(), link: true });
    last = at + match[0].length;
  }
  if (last < text.length) runs.push({ text: text.slice(last), link: false });

  return runs;
}

/** Every title a note links to, in order. */
export function linkedTitles(text: string): string[] {
  return splitStepLinks(text)
    .filter((run) => run.link)
    .map((run) => run.text);
}

/** A title as it is matched: case, and runs of whitespace, do not matter. */
export function titleKey(title: string): string {
  return title.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * The `[[` being typed right before the caret, if there is one: what has been typed after it, and
 * where it starts — what the editor's suggestions are for.
 */
export function openLinkBefore(
  text: string,
  caret: number,
): { query: string; start: number } | null {
  const match = /\[\[([^[\]\n]*)$/.exec(text.slice(0, caret));

  return match ? { query: match[1], start: match.index } : null;
}

/**
 * The text with the open `[[query` before the caret completed to `[[title]]`, and where the caret
 * goes afterwards. A `]]` already sitting after the caret is taken as the closing one rather than
 * doubled.
 */
export function completeLink(
  text: string,
  caret: number,
  title: string,
): { text: string; caret: number } | null {
  const open = openLinkBefore(text, caret);
  if (!open) return null;

  const after = text.slice(caret).replace(/^[^[\]\n]*\]\]/, "");
  const link = `[[${title}]]`;

  return { text: text.slice(0, open.start) + link + after, caret: open.start + link.length };
}
