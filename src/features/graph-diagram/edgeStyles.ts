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

/** How one edge style is drawn: colour class, dash pattern, width and the end cap of a dash. */
export type EdgeStyleSwatch = {
  className: string;
  dash?: string;
  width: number;
  linecap: "round" | "butt";
};

/**
 * What each of the canvas's edge styles looks like. The canvas strokes its arrows from this table
 * and the legends draw their swatches from it, so the two cannot drift apart.
 *
 * Every style has its own line pattern as well as its colour (WCAG 1.4.1): solid for done, dashed
 * for what is ready now, dotted for what is still waiting, dash-dot for what has to come first. The
 * dotted pattern is a dash of almost no length with round caps, which draws as a dot. The dash-dot
 * keeps flat caps, because round ones would eat the short gaps between its parts.
 */
export const EDGE_STYLE_SWATCH: Record<JourneyEdgeTone, EdgeStyleSwatch> = {
  done: { className: "stroke-app-success-solid/70", width: 2.5, linecap: "round" },
  active: { className: "stroke-app-brand", dash: "10 8", width: 2.5, linecap: "round" },
  waiting: { className: "stroke-app-text-subtle/50", dash: "0.1 6", width: 2.5, linecap: "round" },
  upstream: { className: "stroke-app-orange-text", dash: "14 4 2 4", width: 2, linecap: "butt" },
  rule: { className: "stroke-app-brand", width: 2, linecap: "round" },
};
