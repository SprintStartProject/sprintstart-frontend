/**
 * Turning a piece of found text into the one field a note has.
 *
 * `NOTE` stores a single string, and `NoteCard.splitNote` reads its first line as the card's
 * heading. So every surface that makes a note out of something the hire did not type — a selection,
 * a chat answer, a frozen conversation — has to make the same three decisions: what the first line
 * says, whether the rest is worth repeating under it, and how the card admits where it came from.
 *
 * Kept here so those decisions are made once. They were made twice for a while, in
 * `selection/selectionCapture.ts` and here, and the two drifted on the first change — one of them
 * cut headings mid-word and the other did not.
 */

/**
 * How long a note's first line may be.
 *
 * A heading length, not a text limit: long enough to say what the note is, short enough not to wrap
 * into a paragraph pretending to be a title.
 */
export const HEADING_LIMIT = 80;

/** Collapses the whitespace a drag or a markdown block picks up, without touching the words. */
export function normalise(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

/**
 * Cuts at the last word boundary that fits, so a heading never ends mid-word.
 *
 * A single word longer than the limit is cut anyway — there is no boundary to prefer, and the full
 * text is in the body regardless.
 */
export function truncateAtWord(text: string, limit: number): string {
  if (text.length <= limit) return text;

  const cut = text.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  const kept = lastSpace > limit / 2 ? cut.slice(0, lastSpace) : cut;

  return `${kept.trimEnd()}…`;
}

/**
 * A note's text: a heading line, then the body, then where it came from.
 *
 * The heading is a lead taken from the content rather than from the source, because a board is
 * scanned for what a card *says* — "From your buddy" at the top of six cards tells the hire which
 * six cards came from the buddy and nothing about any of them. When the whole content already fits
 * in a heading it is not repeated underneath: a card that says the same thing twice reads as a bug.
 *
 * The attribution stays in the *text* even though `layout/cardOrigins.ts` also records where a card
 * came from, and the duplication is deliberate. The origin is local storage and a way back; this is
 * the part that survives a different machine. One of them is a link and the other is a sentence,
 * and the sentence is the one that is always true.
 */
export function composeNote(content: string, attribution: string | null): string {
  const text = content.trim();
  const heading = truncateAtWord(normalise(text.split("\n")[0] || text), HEADING_LIMIT);

  // The body is dropped only when the heading is the whole note — not merely when it starts it.
  const body = normalise(text) === heading ? null : text;
  const from = attribution ? `From ${attribution}` : null;

  return [heading, body, from].filter(Boolean).join("\n\n");
}
