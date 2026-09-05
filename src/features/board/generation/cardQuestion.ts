import { HEADING_LIMIT, normalise, truncateAtWord } from "./noteComposition";
import { stripMarks } from "../marks/markup";

/**
 * The first sentence of a question about a card, for the composer to open with.
 *
 * The live cards have had this since they were built: a card is a thing you are looking at, and
 * "ask about it" is the shortest path from looking to understanding. The hire's *own* cards did not,
 * which was an odd gap — a note somebody kept from a paragraph they did not follow is precisely the
 * thing they want to ask about, and it was the one kind of card with no way to.
 *
 * A first sentence and never a command. The draft is pre-filled rather than sent, so the hire can
 * change it before it goes: it is their question, and a card that speaks for somebody is a card they
 * stop trusting.
 *
 * **What is marked wins.** A hire who highlighted two sentences in a frozen answer has already said
 * which part of it they are stuck on, and asking about the whole card would throw that away — it is
 * the difference between "explain this page" and "explain this bit".
 */
export function questionAboutNote(text: string, marks: string[]): string {
  const marked = quoteMarks(marks);
  if (marked) return `On a note I kept: ${marked} — what does that mean for me?`;

  return `I kept this note on my board: "${lead(stripMarks(text))}" — can you help me with it?`;
}

export function questionAboutLink(label: string | null, url: string): string {
  return `I kept this link on my board: ${label ? `"${lead(label)}" (${url})` : url} — what is it for?`;
}

export function questionAboutChecklist(
  title: string | null,
  open: number,
  marks: string[],
): string {
  const marked = quoteMarks(marks);
  const name = title ? `"${lead(title)}"` : "a checklist";

  if (marked) return `On ${name} I marked ${marked} — where do I start with that?`;
  if (open === 0) return `I have finished ${name} on my board — what comes after it?`;

  return `I have ${name} on my board with ${open} still to do — where should I start?`;
}

/**
 * The marked bits, quoted, or null when nothing is marked.
 *
 * Two at most. A question that opens with six quotations is not a question, it is a transcript, and
 * the composer is a box somebody is about to type in.
 */
function quoteMarks(marks: string[]): string | null {
  const quoted = marks
    .map((mark) => normalise(mark))
    .filter((mark) => mark.length > 0)
    .slice(0, 2)
    .map((mark) => `"${truncateAtWord(mark, HEADING_LIMIT)}"`);

  if (quoted.length === 0) return null;

  return quoted.join(" and ");
}

/** The opening of a card's text, short enough to sit inside a sentence. */
function lead(text: string): string {
  return truncateAtWord(normalise(text), HEADING_LIMIT);
}
