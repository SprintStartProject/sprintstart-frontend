/**
 * The escalation inbox's route. It is a section of the PM dashboard, but the access check that
 * decides whether to read the open count is still the inbox's own; the count rides on the PM
 * dashboard's entry.
 */
export const ESCALATION_INBOX_PATH = "/insights/knowledge-requests" as const;

export type PmDashboardBadge = {
  count: number;
  /** What the number counts, for a screen reader: the total and its parts. */
  label: string;
};

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * The number on the PM Dashboard entry: pending skip requests, unread onboarding feedback and
 * open escalations, added up.
 *
 * `null` unless every part is known. A part still loading or whose read failed would otherwise
 * count as nothing and quietly shrink the total -- a smaller number that looks just as sure of
 * itself as the right one. Escalations are part of it because the entry already carried their
 * count, and a second number beside the first would have to explain which is which.
 *
 * Handed only to the PM dashboard entry: a future counted entry inheriting the label would
 * announce its own total as skip requests and feedback.
 */
export function pmDashboardBadge(
  attention: { pendingSkips: number; unreadFeedback: number } | null,
  openEscalations: number | null,
): PmDashboardBadge | null {
  if (attention === null || openEscalations === null) return null;

  const count = attention.pendingSkips + attention.unreadFeedback + openEscalations;
  const parts = [
    attention.pendingSkips > 0 &&
      plural(attention.pendingSkips, "pending skip request", "pending skip requests"),
    attention.unreadFeedback > 0 &&
      plural(attention.unreadFeedback, "unread feedback", "unread feedback items"),
    openEscalations > 0 && plural(openEscalations, "open escalation", "open escalations"),
  ].filter(Boolean);

  return {
    count,
    label: `${plural(count, "item needs", "items need")} your attention: ${parts.join(", ")}`,
  };
}

const PM_SECTION_PREFIXES = [
  "/pm-dashboard",
  "/team-management",
  // The member detail route, which `accessPolicy` already treats as a prefix of `/team-management`.
  "/team/",
  "/insights/faq",
  "/insights/knowledge-gaps",
  "/insights/onboarding",
  ESCALATION_INBOX_PATH,
];

/**
 * Team management and a member's detail page are reached from the PM dashboard and have no entry of
 * their own, so the dashboard's entry stands in for them the same way it does for the insights
 * pages -- otherwise the sidebar claims the PM is nowhere while they are looking at their own team.
 */
export function isPmSectionActive(pathname: string): boolean {
  return PM_SECTION_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
