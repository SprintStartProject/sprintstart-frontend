/**
 * The colours the marker pen comes in.
 *
 * Four, and deliberately not more. A highlighter with twelve colours is a colour picker, and a
 * colour picker turns "mark this" into a decision — which is exactly the friction that stops people
 * marking anything. Four is enough to sort by (mine / theirs / do this / ask about this) and few
 * enough to press without looking.
 *
 * Stored as a name rather than as a hex value, so a board marked up in the light theme is still
 * legible in the dark one: the name resolves to a pastel on white and to a translucent wash on
 * black, and a stored `#fef08a` would have been unreadable in one of the two.
 */
export type HighlightColor = "yellow" | "green" | "blue" | "pink";

/** What a mark is unless somebody picked otherwise — and what an unrecognised name falls back to. */
export const DEFAULT_HIGHLIGHT: HighlightColor = "yellow";

export const HIGHLIGHT_COLORS: readonly HighlightColor[] = ["yellow", "green", "blue", "pink"];

/**
 * The background each colour paints.
 *
 * The ink is never set with it. A highlighter changes the paper, not the writing — and leaving the
 * text in the card's own colour is also what keeps a marked sentence readable in both themes
 * without a second set of tokens for the text on top of each wash.
 */
export const HIGHLIGHT_CLASS: Record<HighlightColor, string> = {
  yellow: "bg-app-highlight-yellow",
  green: "bg-app-highlight-green",
  blue: "bg-app-highlight-blue",
  pink: "bg-app-highlight-pink",
};

/** What each colour is called, for the button that paints it. Plain names — they mean nothing. */
export const HIGHLIGHT_LABEL: Record<HighlightColor, string> = {
  yellow: "Yellow",
  green: "Green",
  blue: "Blue",
  pink: "Pink",
};

/** A stored colour name, or the default when it is one this version does not know. */
export function toHighlightColor(value: unknown): HighlightColor {
  return HIGHLIGHT_COLORS.includes(value as HighlightColor)
    ? (value as HighlightColor)
    : DEFAULT_HIGHLIGHT;
}
