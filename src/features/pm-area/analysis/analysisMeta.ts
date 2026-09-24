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
import type { FindingArea, FindingSeverity } from "./findings";

/**
 * Each area in the colour its PM section is known by (see `PmTone`), so a finding reads as
 * "that's a team thing" or "that's a gaps thing" before its text does.
 */
export const AREA_META: Record<FindingArea, { label: string; icon: LucideIcon; chip: string }> = {
  team: { label: "Team", icon: Users, chip: "bg-app-brand-soft text-app-brand-text" },
  onboarding: { label: "Onboarding", icon: Gauge, chip: "bg-app-cyan-bg text-app-cyan-text" },
  escalations: { label: "Escalations", icon: Inbox, chip: "bg-app-purple-bg text-app-purple-text" },
  questions: {
    label: "Questions",
    icon: MessageSquareMore,
    chip: "bg-app-indigo-bg text-app-indigo-text",
  },
  gaps: { label: "Knowledge gaps", icon: ShieldAlert, chip: "bg-app-pink-bg text-app-pink-text" },
  ingestion: {
    label: "Data sources",
    icon: Database,
    chip: "bg-app-neutral-bg text-app-neutral-text",
  },
  industry: { label: "Industry", icon: Tag, chip: "bg-app-neutral-bg text-app-neutral-text" },
};

/** Severity always travels with its icon and its word, never as a colour alone. */
export const SEVERITY_META: Record<
  FindingSeverity,
  { label: string; icon: LucideIcon; badge: string; bar: string; text: string }
> = {
  critical: {
    label: "Critical",
    icon: CircleAlert,
    badge: "bg-app-danger-bg text-app-danger-text",
    bar: "bg-app-danger-solid",
    text: "text-app-danger-text",
  },
  warning: {
    label: "Needs a look",
    icon: TriangleAlert,
    badge: "bg-app-warning-bg text-app-warning-text",
    bar: "bg-app-warning-solid",
    text: "text-app-warning-text",
  },
  info: {
    label: "Good to know",
    icon: Info,
    badge: "bg-app-brand-soft text-app-brand-text",
    bar: "bg-app-brand",
    text: "text-app-brand-text",
  },
  good: {
    label: "Going well",
    icon: CheckCircle2,
    badge: "bg-app-success-bg text-app-success-text",
    bar: "bg-app-success-solid",
    text: "text-app-success-text",
  },
};
