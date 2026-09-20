/**
 * Formats quote text as a Markdown blockquote, one quoted paragraph per line.
 *
 * The input is one logical line per paragraph — what a selection capture hands over once it has
 * dropped the empty lines (see `selectionQuoteText`). Each line becomes `> line`, and the lines
 * are separated by an empty quoted line, because consecutive `>` lines without one render as a
 * single paragraph with a line break, not as the paragraphs the answer had.
 */
export function formatMarkdownQuote(text: string): string {
  const paragraphs = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (paragraphs.length === 0) return "";

  return paragraphs
    .map((line) => (line.startsWith(">") ? line : `> ${line}`))
    .join("\n>\n");
}

/**
 * Inserts a quoted AI response at the bottom of the current draft.
 *
 * Markdown blockquotes require a blank line separation before and after normal prose,
 * otherwise subsequent text is treated as a lazy continuation of the quote block.
 */
export function insertQuoteIntoDraft(currentDraft: string, quoteText: string): string {
  const formattedQuote = formatMarkdownQuote(quoteText);
  if (!formattedQuote) return currentDraft;

  const trimmedDraft = currentDraft.trimEnd();
  if (!trimmedDraft) {
    return `${formattedQuote}\n\n`;
  }

  return `${trimmedDraft}\n\n${formattedQuote}\n\n`;
}
