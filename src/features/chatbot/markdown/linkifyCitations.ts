/**
 * Turns inline citation markers like `[3]` that the assistant writes into its
 * prose into real markdown links (`[3](#cite-3)`), so they can be rendered as
 * interactive citation references instead of literal text.
 *
 * Markers inside code spans / fenced blocks are left untouched (so `arr[1]`
 * survives), and only numbers within `[1, max]` — the count of citations that
 * were actually streamed for the message — are converted.
 */
const CODE_SEGMENTS = /(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/g;
const MARKER = /\[(\d+)\](?!\()/g;

export function linkifyCitations(markdown: string, max: number): string {
  if (max <= 0 || !markdown.includes("[")) return markdown;

  return markdown
    .split(CODE_SEGMENTS)
    .map((segment) => {
      // Leave code spans / blocks exactly as they are.
      if (/^(```|~~~|`)/.test(segment)) return segment;

      return segment.replace(MARKER, (whole, digits: string) => {
        const n = Number(digits);
        return n >= 1 && n <= max ? `[${n}](#cite-${n})` : whole;
      });
    })
    .join("");
}
