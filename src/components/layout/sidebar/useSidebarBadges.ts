import { useLocation } from "react-router-dom";
import { canAccessRoute, isOnboardingAccessible } from "../../../auth/accessPolicy";
import { useAuth } from "../../../context/useAuth";
import { useKnownOpenEscalationCount } from "../../../features/knowledge-request/useOpenEscalationCount";
import { useOnboardingJourney } from "../../../features/onboarding/generation/OnboardingJourneyContext";
import { useUnseenSkipAnswerCount } from "../../../features/onboarding/hooks/useUnseenSkipAnswerCount";
import { useProjectContext } from "../../../features/projects/useProjectContext";
import { usePmAttentionCount } from "../../../features/team-management/usePmAttentionCount";
import { ESCALATION_INBOX_PATH, pmDashboardBadge, type PmDashboardBadge } from "./pmBadge";

type SidebarBadges = {
  pmBadge: PmDashboardBadge | null;
  hasPmAttentionItems: boolean;
  unseenSkipAnswerCount: number;
};

/**
 * The counts behind the markers on the sidebar's entries.
 *
 * Owned by `SideBar`, not `SidebarContent`: that renders twice at once, once for desktop and once
 * for the mobile drawer, and fetching inside it meant every page load and every project switch
 * fired each request twice over. Passing the route as the refresh key rechecks on every view
 * change; the hooks rate-limit that so quick navigation cannot hammer the backend. Each read is
 * gated on access so a regular member never pays for a request they could not act on anyway.
 */
export function useSidebarBadges(): SidebarBadges {
  const { profile } = useAuth();
  const { canManageSelected, selectedProjectId } = useProjectContext();
  const { pathname } = useLocation();

  const pmAttention = usePmAttentionCount(
    selectedProjectId,
    canAccessRoute(profile, "/pm-dashboard", canManageSelected),
    pathname,
  );

  // Its own read: escalations are not onboarding items and have their own count endpoint. Gated
  // on the inbox route rather than the dashboard -- for a PM it additionally requires managing
  // the selected project, so a PM who is only a member of it neither pays for the request nor
  // sees it counted. `null` while loading or failed, 0 when there is nothing of it to count.
  const openEscalations = useKnownOpenEscalationCount(
    selectedProjectId,
    canAccessRoute(profile, ESCALATION_INBOX_PATH, canManageSelected),
    pathname,
  );

  const pmBadge = pmDashboardBadge(pmAttention, openEscalations);
  // While part of the number is unknown the entry shows no number, only the marker -- and only if
  // a part that is known has something in it. Better "something is waiting" than a wrong count.
  const hasPmAttentionItems =
    pmBadge === null && ((pmAttention?.total ?? 0) > 0 || (openEscalations ?? 0) > 0);

  const { availability } = useOnboardingJourney();
  const unseenSkipAnswerCount = useUnseenSkipAnswerCount(
    profile?.id,
    isOnboardingAccessible(profile) && availability === "path",
    pathname,
  );

  return { pmBadge, hasPmAttentionItems, unseenSkipAnswerCount };
}
