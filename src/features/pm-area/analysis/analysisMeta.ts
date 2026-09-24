import {
  CheckCircle2,
  CircleAlert,
  Database,
  Gauge,
  Inbox,
  Info,
  MessageSquareMore,
  ShieldAlert,
  Tag,
  TriangleAlert,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Finding, FindingArea, FindingSeverity } from "./findings";

/** The order areas are drawn in, everywhere in the analysis. */
export const AREA_ORDER = [
  "team",
  "onboarding",
  "escalations",
  "questions",
  "gaps",
  "ingestion",
  "industry",
] as const satisfies readonly FindingArea[];

/**
 * Each area in the colour its PM section is known by (see `PmTone`), so a finding reads as
 * "that's a team thing" or "that's a gaps thing" before its text does. `glow` is the same colour
 * as a CSS value, for the analysis's SVG — a palette variable, never a raw colour.
 */
export const AREA_META: Record<
  FindingArea,
  { label: string; icon: LucideIcon; chip: string; glow: string }
> = {
  team: {
    label: "Team",
    icon: Users,
    chip: "bg-app-brand-soft text-app-brand-text",
    glow: "var(--brand-text)",
  },
  onboarding: {
    label: "Onboarding",
    icon: Gauge,
    chip: "bg-app-cyan-bg text-app-cyan-text",
    glow: "var(--cyan-text)",
  },
  escalations: {
    label: "Escalations",
    icon: Inbox,
    chip: "bg-app-purple-bg text-app-purple-text",
    glow: "var(--purple-text)",
  },
  questions: {
    label: "Questions",
    icon: MessageSquareMore,
    chip: "bg-app-indigo-bg text-app-indigo-text",
    glow: "var(--indigo-text)",
  },
  gaps: {
    label: "Knowledge gaps",
    icon: ShieldAlert,
    chip: "bg-app-pink-bg text-app-pink-text",
    glow: "var(--pink-text)",
  },
  ingestion: {
    label: "Data sources",
    icon: Database,
    chip: "bg-app-neutral-bg text-app-neutral-text",
    glow: "var(--neutral-text)",
  },
  industry: {
    label: "Industry",
    icon: Tag,
    chip: "bg-app-neutral-bg text-app-neutral-text",
    glow: "var(--neutral-text)",
  },
};

/**
 * Severity always travels with its icon and its word, never as a colour alone. `glow` is the CSS
 * colour the analysis draws its luminous lines and halos in; the analysis is always dark, where
 * the `*-text` steps are the bright ones.
 */
export const SEVERITY_META: Record<
  FindingSeverity,
  { label: string; icon: LucideIcon; badge: string; bar: string; text: string; glow: string }
> = {
  critical: {
    label: "Critical",
    icon: CircleAlert,
    badge: "bg-app-danger-bg text-app-danger-text",
    bar: "bg-app-danger-solid",
    text: "text-app-danger-text",
    glow: "var(--danger-text)",
  },
  warning: {
    label: "Needs a look",
    icon: TriangleAlert,
    badge: "bg-app-warning-bg text-app-warning-text",
    bar: "bg-app-warning-solid",
    text: "text-app-warning-text",
    glow: "var(--warning-text)",
  },
  info: {
    label: "Good to know",
    icon: Info,
    badge: "bg-app-brand-soft text-app-brand-text",
    bar: "bg-app-brand",
    text: "text-app-brand-text",
    glow: "var(--brand-text)",
  },
  good: {
    label: "Going well",
    icon: CheckCircle2,
    badge: "bg-app-success-bg text-app-success-text",
    bar: "bg-app-success-solid",
    text: "text-app-success-text",
    glow: "var(--success-text)",
  },
};

export const SEVERITY_RANK: Record<FindingSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
  good: 3,
};

/** Which findings the results show: the ones to act on, the good news, or everything. */
export type FindingFilter = "act" | "good" | "all";

/** Left to right, as the filter's tabs are drawn — and as the swipe walks them. */
export const FILTER_ORDER: readonly FindingFilter[] = ["act", "good", "all"];

export function matchesFilter(finding: Finding, filter: FindingFilter): boolean {
  if (filter === "all") return true;
  return filter === "good" ? finding.severity === "good" : finding.severity !== "good";
}
