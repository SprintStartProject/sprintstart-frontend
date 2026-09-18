/**
 * Formats a text snippet as a Markdown blockquote by prefixing each line with `> `.
 */
export function formatMarkdownQuote(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";

  return trimmed
    .split("\n")
    .map((line) => (line.startsWith(">") ? line : `> ${line}`))
    .join("\n");
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
