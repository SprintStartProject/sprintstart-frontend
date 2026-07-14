// Shared severity constants for the knowledge-gaps feature. Defined once so the
// dashboard widget, list page and detail page keep an identical severity scale.
// (Presentational components live in components/SeverityIndicators.tsx.)

import type { KnowledgeGapSeverity } from "./types";

/** Sort weight so higher-impact gaps come first (high → medium → low). */
export const SEVERITY_ORDER: Record<KnowledgeGapSeverity, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

/** Severities in display order (high → medium → low). */
export const SEVERITIES: KnowledgeGapSeverity[] = ["high", "medium", "low"];

export interface SeverityStyle {
  /** Solid fill for the severity bar, legend dots and stacked-bar segments. */
  bar: string;
  /** Chip background + text pairing. */
  badge: string;
  /** Short label, e.g. "High". */
  label: string;
  /** Long label, e.g. "High severity". */
  longLabel: string;
  /** Border tint for framed containers (detail hero). */
  ring: string;
}

/**
 * Maps each severity to semantic design tokens (see AGENTS.md §7):
 * high → danger, medium → warning, low → success. Every place that uses these
 * colors also renders a text label, so meaning never depends on color alone
 * (color-blind friendly).
 */
export const SEVERITY_STYLES: Record<KnowledgeGapSeverity, SeverityStyle> = {
  high: {
    bar: "bg-app-danger-solid",
    badge: "bg-app-danger-bg text-app-danger-text",
    label: "High",
    longLabel: "High severity",
    ring: "border-app-danger-border",
  },
  medium: {
    bar: "bg-app-warning-solid",
    badge: "bg-app-warning-bg text-app-warning-text",
    label: "Medium",
    longLabel: "Medium severity",
    ring: "border-app-warning-border",
  },
  low: {
    bar: "bg-app-success-solid",
    badge: "bg-app-success-bg text-app-success-text",
    label: "Low",
    longLabel: "Low severity",
    ring: "border-app-success-border",
  },
};
