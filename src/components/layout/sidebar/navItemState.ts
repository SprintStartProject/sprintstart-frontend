import type { AppRoute } from "../../../auth/accessPolicy";
import type { PmDashboardBadge } from "./pmBadge";

type NavItemSignals = {
  hasPmAttentionItems: boolean;
  hasUnseenKnowledgeGaps: boolean;
  unseenSkipAnswerCount: number;
  pmBadge: PmDashboardBadge | null;
  isOnboardingRunning: boolean;
  isPmSectionActive: boolean;
};

type NavItemState = {
  forceActive: boolean;
  hasAttentionMarker: boolean;
  attentionLabel: string;
  count: number;
  countLabel?: () => string;
  busy: boolean;
};

function attentionLabelFor(path: AppRoute): string {
  if (path === "/") return "A component has been assigned to you";
  if (path === "/onboarding") return "Your project manager answered a skip request";
  return "Open skip requests, unread feedback or escalations";
}

function hasAttentionMarker(path: AppRoute, signals: NavItemSignals): boolean {
  if (path === "/pm-dashboard") return signals.hasPmAttentionItems;
  if (path === "/") return signals.hasUnseenKnowledgeGaps;
  if (path === "/onboarding") return signals.unseenSkipAnswerCount > 0;
  return false;
}

/** What an entry shows beyond its label: marker, count, busy state, and whether it stands in for a section. */
export function navItemState(path: AppRoute, signals: NavItemSignals): NavItemState {
  const isPm = path === "/pm-dashboard";
  const badge = isPm ? signals.pmBadge : null;

  return {
    forceActive: isPm && signals.isPmSectionActive,
    hasAttentionMarker: hasAttentionMarker(path, signals),
    attentionLabel: attentionLabelFor(path),
    count: badge?.count ?? 0,
    countLabel: badge ? () => badge.label : undefined,
    busy: path === "/onboarding" && signals.isOnboardingRunning,
  };
}
