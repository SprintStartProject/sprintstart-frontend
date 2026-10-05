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
 *
 * **A task too, the Obsidian way:** `[[Set up SSH#Generate a key]]` — the step, then `#` and one of
 * its tasks, as Obsidian points at a heading inside a note. It opens the step and files the note
 * there; the task is what the chip says.
 *
 * **And what the buddy already writes.** The buddy is handed each step's app link and writes
 * "[#3](/onboarding?step=…)" into its replies. A reply kept on the board with such a link is linked
 * to that step just the same — no new syntax for the model to learn.
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

/** What a `[[…]]` names: a step, and perhaps one of its tasks after a `#`. */
export function linkTarget(text: string): { step: string; task: string | null } {
  const at = text.indexOf("#");
  if (at === -1) return { step: text.trim(), task: null };

  return { step: text.slice(0, at).trim(), task: text.slice(at + 1).trim() || null };
}

/**
 * The step ids a text points at through in-app links — `/onboarding/<id>` or `?step=<id>`, the
 * shapes the buddy and the board write. Markdown link syntax or a bare path, either works.
 */
export function linkedStepIds(text: string): string[] {
  const ids: string[] = [];
  for (const match of text.matchAll(/\/onboarding(?:\/([\w-]+)|\?(?:[^\s)#]*&)?step=([\w-]+))/g)) {
    ids.push(match[1] ?? match[2]);
  }
  return ids;
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
