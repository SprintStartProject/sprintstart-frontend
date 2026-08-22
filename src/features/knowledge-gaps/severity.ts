// Shared severity constants for the knowledge-gaps feature. Defined once so the
// dashboard widget, list page and detail page keep an identical severity scale.
// (Presentational components live in components/SeverityIndicators.tsx.)

import type { KnowledgeGapSeverity } from "./types";

/** Sort weight so higher-impact gaps come first (high → medium → low → covered). */
export const SEVERITY_ORDER: Record<KnowledgeGapSeverity, number> = {
  high: 0,
  medium: 1,
  low: 2,
  covered: 3,
};

/** Severities in display order (high → medium → low → covered). */
export const SEVERITIES: KnowledgeGapSeverity[] = ["high", "medium", "low", "covered"];

/**
 * Width of the detail page's hero bar per step.
 *
 * The bar's colour says *which* state the component is in; its length says how
 * much of that state there is. So a gap fills further the worse it is, and
 * `covered` fills completely — a full green bar reads as "fully covered",
 * where a near-empty one would read as a component barely holding on.
 *
 * A lookup rather than a ternary chain: the chain that used to live in the
 * detail page had no branch for a fourth step, so `covered` silently inherited
 * the `low` width.
 */
export const SEVERITY_FILL: Record<KnowledgeGapSeverity, string> = {
  high: "100%",
  medium: "60%",
  low: "30%",
  covered: "100%",
};

export interface SeverityStyle {
  /** Solid fill for the severity bar, legend dots and stacked-bar segments. */
  bar: string;
  /**
   * Chip background + text pairing, for the pills on the pages, the widgets and
   * the dashboard.
   *
   * Deliberately not a `ui/Badge` variant. The primitive's variants are the
   * app's status ladder plus two named accents, and this ramp is neither — it
   * is four ordered steps on its own scale (see `SEVERITY_STYLES` below), so
   * there is no variant that carries the right colour. Mapping the steps onto
   * the nearest status roles would put a pill and the bar beside it in two
   * different reds for one and the same datum.
   */
  badge: string;
  /** Short label, e.g. "High". */
  label: string;
  /** Long label, e.g. "High severity". */
  longLabel: string;
  /** Border tint for framed containers (detail hero). */
  ring: string;
}

/**
 * Maps each severity to the four-step severity ramp in styles/index.css (see
 * AGENTS.md §7), running red → orange → amber → green.
 *
 * Its own scale rather than the status roles, because there are four ordered
 * steps and only three status colors. It also frees `low` from green, which it
 * used to share with "nothing missing at all" — two states a PM has to be able
 * to tell apart at a glance.
 *
 * Every place that uses these colors also renders a text label, so meaning
 * never depends on color alone (color-blind friendly).
 */
export const SEVERITY_STYLES: Record<KnowledgeGapSeverity, SeverityStyle> = {
  high: {
    bar: "bg-app-severity-high-solid",
    badge: "bg-app-severity-high-bg text-app-severity-high-text",
    label: "High",
    longLabel: "High severity",
    ring: "border-app-severity-high-border",
  },
  medium: {
    bar: "bg-app-severity-medium-solid",
    badge: "bg-app-severity-medium-bg text-app-severity-medium-text",
    label: "Medium",
    longLabel: "Medium severity",
    ring: "border-app-severity-medium-border",
  },
  low: {
    bar: "bg-app-severity-low-solid",
    badge: "bg-app-severity-low-bg text-app-severity-low-text",
    label: "Low",
    longLabel: "Low severity",
    ring: "border-app-severity-low-border",
  },
  // Not a severity at all, and labelled so: "Covered" says what is true about
  // the component, where "None" would only say what is absent.
  covered: {
    bar: "bg-app-severity-covered-solid",
    badge: "bg-app-severity-covered-bg text-app-severity-covered-text",
    label: "Covered",
    longLabel: "No gaps found",
    ring: "border-app-severity-covered-border",
  },
};
