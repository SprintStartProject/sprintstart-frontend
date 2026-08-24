// ============================================================
// features/dashboard/teamInsights.ts
// ============================================================
// Who gets the team-insights widget on the shared dashboard,
// and the two figures it puts in front of them (#288).
// ============================================================

import { canAccessRoute } from "../../auth/accessPolicy";
import type { UserProfile } from "../../services/types";
import type { FAQGroup } from "../faq/types";
import type { KnowledgeGap, KnowledgeGapSeverity } from "../knowledge-gaps/types";
import { SEVERITIES } from "../knowledge-gaps/severity";

/**
 * Whether the dashboard's flexible slot may show team insights to this user.
 *
 * Deliberately {@link canAccessRoute} on the insights route rather than a role check of
 * its own: the widget reads the selected project's questions and gaps through the same
 * endpoints the insights pages use, which the backend guards with
 * `@projectAuth.canAccessProject`. A PM who merely belongs to the selected project would
 * get 403s, so they get no widget — the same rule that already hides the sidebar entries.
 * PM, HR and ADMIN all qualify; a regular user never does.
 *
 * @param canManageSelectedProject Whether the user manages the globally selected project.
 *   Only consulted for the PM role; defaults to `false` so a caller without project
 *   context stays on the strict side.
 */
export function canSeeTeamInsights(
  profile: UserProfile | null,
  canManageSelectedProject = false,
): boolean {
  return canAccessRoute(profile, "/insights/faq", canManageSelectedProject);
}

export type GapSummary = {
  /**
   * Distinct components the gaps are spread over — the number in the middle of the ring.
   *
   * Not "components analysed": the overview carries every scanned component now, and the
   * ones it cleared are dropped below, so this counts the components with something
   * missing. The label says "components with gaps" for that reason.
   */
  componentCount: number;
  total: number;
  /** Gaps per severity, always every key, so the ring has no holes to special-case. */
  counts: Record<KnowledgeGapSeverity, number>;
};

/**
 * Counts the gaps by severity and by component, for the ring and its legend.
 *
 * Covered components are dropped rather than counted as a fourth segment. The overview is
 * the project's full component roster now, but this ring answers "how much is outstanding
 * and how bad is it" — a component with nothing missing would inflate both the number in
 * the middle and the proportions around it, which are the only two things it says.
 */
export function summarizeGaps(gaps: readonly KnowledgeGap[]): GapSummary {
  const counts = Object.fromEntries(SEVERITIES.map((severity) => [severity, 0])) as Record<
    KnowledgeGapSeverity,
    number
  >;

  const components = new Set<string>();

  const outstanding = gaps.filter((gap) => gap.severity !== "covered");

  for (const gap of outstanding) {
    counts[gap.severity] += 1;
    components.add(gap.component);
  }

  return { componentCount: components.size, total: outstanding.length, counts };
}

/**
 * The questions the project keeps asking, most asked first, capped at `limit`.
 *
 * Sorted here rather than trusted from the backend, because the widget draws a bar per
 * question and a bar chart whose longest bar is not on top reads as unordered. Ties keep
 * the order the backend returned them in, so the dashboard never disagrees with the FAQ
 * page about which of two equally asked questions comes first.
 */
export function topQuestions(groups: readonly FAQGroup[], limit: number): FAQGroup[] {
  return [...groups].sort((a, b) => b.count - a.count).slice(0, limit);
}
