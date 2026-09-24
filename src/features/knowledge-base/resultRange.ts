/**
 * Words the result line: "1–20 of 412 artifacts" while a page is known, the total
 * alone otherwise. An empty result reads "No artifacts" rather than "0–0 of 0".
 *
 * @param total Matching artifacts across every page.
 * @param range 1-based positions of the first and last artifact on this page.
 */
export function formatResultRange(total: number, range?: { start: number; end: number }): string {
  const noun = total === 1 ? "artifact" : "artifacts";
  if (total === 0) return "No artifacts";
  if (!range || range.start < 1 || range.end < range.start) return `${total} ${noun}`;
  if (range.start === 1 && range.end >= total) return `${total} ${noun}`;
  return `${range.start}–${range.end} of ${total} ${noun}`;
}
