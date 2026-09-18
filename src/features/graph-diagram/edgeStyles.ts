// ============================================================
// features/graph-diagram/edgeStyles.ts
// ============================================================
// How the shared graph canvas draws an arrow, and how the two
// board surfaces that have something else to say about an arrow
// map what they mean onto those styles.
//
// Apart from the canvas because a legend needs it. The styles
// themselves live as classes on an SVG path inside the canvas,
// where nothing outside can read them, and a legend that
// restates a style from memory is a legend that goes quietly
// wrong.
// ============================================================

import type { JourneyEdgeTone } from "../onboarding/graph/JourneyCanvas.tsx";
import type { GraphEdgeTone } from "./graphLayout.ts";

/**
 * How firm an arrow is, said in the styles the canvas can draw.
 *
 * The canvas's styles are about *state* — satisfied, being worked through, still waiting, or in
 * the way. A hire's board asks a different question of an arrow, who set it, and the answer decides
 * whether they may take it off. The two are mapped onto the styles that carry the same feeling: the
 * settled solid line for a rule that stays, the brand line for one the hire drew themselves, and
 * the quiet dashed one for a suggestion they may change.
 */
export const EDGE_TONE_STYLE: Record<GraphEdgeTone, JourneyEdgeTone> = {
  rule: "done",
  own: "active",
  suggestion: "waiting",
};

/** What each of the canvas's edge styles looks like, for a legend drawn beside the canvas. */
export const EDGE_STYLE_SWATCH: Record<
  JourneyEdgeTone,
  { className: string; dash?: string; width: number }
> = {
  done: { className: "stroke-app-success-solid/70", width: 2 },
  active: { className: "stroke-app-brand", dash: "10 8", width: 2 },
  waiting: { className: "stroke-app-text-subtle/50", dash: "6 6", width: 2 },
  upstream: { className: "stroke-app-orange-text", width: 2 },
  rule: { className: "stroke-app-brand", width: 2 },
};
