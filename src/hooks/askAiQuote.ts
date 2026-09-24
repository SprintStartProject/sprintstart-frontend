/**
 * The prompts the app hands to the chat on the reader's behalf.
 *
 * Both exist so that a click can carry context with it. The chat is retrieval
 * over the knowledge base, so a bare "what does this mean?" arrives with nothing
 * to retrieve against — the quoted words, or the artifact's name and link, are
 * what make the first answer worth reading.
 *
 * String builders rather than logic inside the toolbar and the drawer: the
 * wording is the part most likely to be argued with, and the easiest thing in
 * the app to test on a string.
 */

/**
 * Anything longer than this is trimmed.
 *
 * A selection can be a whole page — the reader drags from a heading to the
 * bottom and means "all of this" — but the composer is not a document viewer,
 * and a quote that long buries the question underneath it.
 */
export const MAX_QUOTE_CHARS = 1500;

export type AskAiQuote = {
  /** The selected words. */
  text: string;
  /** Where they came from, in words — the nearest heading, or the page title. */
  source?: string | null;
  /** The link the selection stands for, when it is one. */
  url?: string | null;
};

/**
 * A selection, as a message the reader can edit before sending.
 *
 * The words are quoted rather than pasted flat: the blockquote is what tells the
 * model — and the reader, scrolling back a week later — which part of the
 * message is the document and which part is the question. The source line is
 * what lets the answer be checked afterwards.
 */
export function quoteForChat({ text, source, url }: AskAiQuote): string {
  const quoted = trimQuote(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => `> ${line}`)
    .join("\n");

  const attribution = [clean(source), clean(url)].filter((part) => part !== null).join(" — ");

  return [quoted, attribution ? `From ${attribution}` : null, "Explain this in context."]
    .filter((part) => part !== null)
    .join("\n\n");
}

/**
 * A whole artifact, as a message — for the drawer's own "Ask AI", where there is
 * no selection to quote and the title and link are all the context there is.
 */
export function questionForArtifact({
  title,
  url,
}: {
  title?: string | null;
  url?: string | null;
}): string {
  const name = clean(title);
  const link = clean(url);
  const subject = name ? `**${name}**` : "this artifact";

  const opening = link
    ? `About ${subject} in the Knowledge Base — ${link}`
    : `About ${subject} in the Knowledge Base`;

  return [opening, "What should I know about it?"].join("\n\n");
}

/** Trims a quote to something the composer can hold, and shows that it did. */
function trimQuote(text: string): string {
  if (text.length <= MAX_QUOTE_CHARS) return text;

  return `${text.slice(0, MAX_QUOTE_CHARS).trimEnd()} […]`;
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";

  return trimmed.length > 0 ? trimmed : null;
}
