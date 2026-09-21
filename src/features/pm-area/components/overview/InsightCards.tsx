import {
  Clock,
  Gauge,
  Hourglass,
  MessageSquareMore,
  Rocket,
  ShieldAlert,
  TrendingDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState } from "../../../../components/ui/EmptyState";
import { SkeletonGroup, SkeletonLine } from "../../../../components/ui/Skeleton";
import { Spinner } from "../../../../components/ui/Spinner";
import { useLiveFetch } from "../../../../hooks/useLiveFetch";
import { useQueryFetch } from "../../../../hooks/useQueryFetch";
import { insightsService } from "../../../../services/faqService";
import { knowledgeGapService } from "../../../../services/knowledgeGapService";
import { onboardingMetricsService } from "../../../../services/onboardingMetricsService";
import { queryKeys } from "../../../../services/queryKeys";
import { WidgetBar } from "../../../dashboard/components/WidgetBar";
import { summarizeGaps, topQuestions } from "../../../dashboard/teamInsights";
import { TrendBadge } from "../../../faq/components/TrendBadge";
import { SEVERITY_ORDER, SEVERITY_STYLES } from "../../../knowledge-gaps/severity";
import { formatDuration } from "../../../onboarding-metrics/format";
import { useProjectContext } from "../../../projects/useProjectContext";
import { PmCard, PmCardHeader, PmCardLink } from "../PmCard";

const ROWS = 4;

function CardSkeleton({ label }: { label: string }) {
  return (
    <SkeletonGroup label={label} className="space-y-3">
      {Array.from({ length: ROWS }).map((_, index) => (
        <SkeletonLine key={index} className="h-8 w-full" />
      ))}
    </SkeletonGroup>
  );
}

const rowClassName =
  "group -mx-2 block rounded-xl px-2 py-2 transition-colors hover:bg-app-surface-hover focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none";

/** The most asked questions as bars, longest first; each opens its detail panel. */
export function QuestionsCard() {
  const { selectedProjectId } = useProjectContext();
  const {
    data: overview,
    loading,
    revalidating,
    error,
  } = useLiveFetch(queryKeys.faq.groups(selectedProjectId), () =>
    insightsService.fetchFAQGroups(selectedProjectId),
  );

  const groups = overview?.groups ?? [];
  const visible = topQuestions(groups, ROWS);
  const highest = visible[0]?.count ?? 0;
  const asked = groups.reduce((sum, group) => sum + group.count, 0);

  return (
    <PmCard
      aria-label="Recurring questions"
      tone="indigo"
      className="h-full"
      to="/insights/faq"
      linkLabel="Open all recurring questions"
    >
      <PmCardHeader
        icon={MessageSquareMore}
        tone="indigo"
        title="Recurring questions"
        meta={
          revalidating ? (
            <Spinner size="sm" label="Updating recurring questions" />
          ) : overview ? (
            `${asked} asked`
          ) : undefined
        }
        action={<PmCardLink to="/insights/faq">All</PmCardLink>}
      />

      {loading ? (
        <CardSkeleton label="Loading recurring questions" />
      ) : error || !overview ? (
        <EmptyState size="sm">No recurring questions to show right now.</EmptyState>
      ) : visible.length === 0 ? (
        <EmptyState size="sm">
          No recurring questions yet — they appear as the chat is used.
        </EmptyState>
      ) : (
        <ul className="space-y-1">
          {visible.map((group) => (
            <li key={group.groupId}>
              <Link to={`/insights/faq/${group.groupId}`} className={rowClassName}>
                <span className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-sm text-app-text">{group.title}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    {group.trend === "RISING" && (
                      <TrendBadge trend={group.trend} recentCount={group.recentCount} />
                    )}
                    <span className="text-xs font-semibold text-app-text-muted tabular-nums">
                      {group.count}
                    </span>
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-app-surface-muted"
                >
                  <span
                    className={`block h-full rounded-full transition-[width] duration-700 ${group.trend === "RISING" ? "bg-app-warning-solid" : "bg-app-indigo-text/70"}`}
                    style={{ width: `${highest > 0 ? (group.count / highest) * 100 : 0}%` }}
                  />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PmCard>
  );
}

/** How the gaps split across severities, and the worst few by name. */
export function KnowledgeGapsCard() {
  const { selectedProjectId } = useProjectContext();
  const {
    data: overview,
    loading,
    error,
  } = useLiveFetch(queryKeys.knowledgeGaps.overview(selectedProjectId), () =>
    knowledgeGapService.fetchKnowledgeGaps(selectedProjectId),
  );

  const gaps = (overview?.gaps ?? []).filter((gap) => gap.severity !== "covered");
  const summary = summarizeGaps(gaps);
  const worst = [...gaps]
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
        b.missingTypes.length - a.missingTypes.length,
    )
    .slice(0, ROWS - 1);

  return (
    <PmCard
      aria-label="Knowledge gaps"
      tone="pink"
      className="h-full"
      to="/insights/knowledge-gaps"
      linkLabel="Open all knowledge gaps"
    >
      <PmCardHeader
        icon={ShieldAlert}
        tone="pink"
        title="Knowledge gaps"
        meta={overview ? `${summary.componentCount} components` : undefined}
        action={<PmCardLink to="/insights/knowledge-gaps">All</PmCardLink>}
      />

      {loading ? (
        <CardSkeleton label="Loading knowledge gaps" />
      ) : error || !overview ? (
        <EmptyState size="sm">No knowledge gaps to show right now.</EmptyState>
      ) : gaps.length === 0 ? (
        <EmptyState size="sm">Nothing needs documenting right now.</EmptyState>
      ) : (
        <>
          <WidgetBar
            segments={(["high", "medium", "low"] as const).map((severity) => ({
              label: SEVERITY_STYLES[severity].label.toLowerCase(),
              value: summary.counts[severity],
              className: SEVERITY_STYLES[severity].bar,
            }))}
          />

          <ul className="mt-3 space-y-0.5">
            {worst.map((gap) => (
              <li key={gap.id}>
                <Link to={`/insights/knowledge-gaps/${gap.id}`} className={rowClassName}>
                  <span className="flex items-center gap-2.5">
                    <span
                      aria-hidden="true"
                      className={`h-2 w-2 shrink-0 rounded-full ${SEVERITY_STYLES[gap.severity].bar}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-app-text">{gap.component}</span>
                      <span className="block truncate text-xs text-app-text-muted">
                        {gap.missingTypes.length > 0
                          ? `missing ${gap.missingTypes.join(", ")}`
                          : SEVERITY_STYLES[gap.severity].longLabel}
                      </span>
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </PmCard>
  );
}

function HealthRow({
  icon: Icon,
  label,
  value,
  attention = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  attention?: boolean;
}) {
  return (
    <li className="flex items-center gap-3 py-2">
      <span
        aria-hidden="true"
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          attention
            ? "bg-app-warning-bg text-app-warning-text"
            : "bg-app-cyan-bg text-app-cyan-text"
        }`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1 text-sm text-app-text-muted">{label}</span>
      <span className="shrink-0 text-base font-semibold text-app-text tabular-nums">{value}</span>
    </li>
  );
}

/** The onboarding readout's four figures, for a glance. */
export function OnboardingHealthCard() {
  const { selectedProjectId } = useProjectContext();
  const {
    data: metrics,
    loading,
    error,
  } = useQueryFetch(queryKeys.onboardingMetrics.project(selectedProjectId), () =>
    selectedProjectId
      ? onboardingMetricsService.fetchProjectMetrics(selectedProjectId)
      : Promise.resolve(null),
  );

  return (
    <PmCard
      aria-label="Onboarding health"
      tone="cyan"
      className="h-full"
      to="/insights/onboarding"
      linkLabel="Open onboarding details"
    >
      <PmCardHeader
        icon={Gauge}
        tone="cyan"
        title="Onboarding health"
        meta={metrics ? `${metrics.memberCount} hires` : undefined}
        action={<PmCardLink to="/insights/onboarding">Details</PmCardLink>}
      />

      {loading ? (
        <CardSkeleton label="Loading onboarding metrics" />
      ) : error || !metrics ? (
        <EmptyState size="sm">No onboarding metrics for this project yet.</EmptyState>
      ) : metrics.memberCount === 0 ? (
        <EmptyState size="sm">No hires on this project yet.</EmptyState>
      ) : (
        <ul className="-my-2 divide-y divide-app-border-muted">
          <HealthRow
            icon={Rocket}
            label="To first accepted work"
            value={formatDuration(metrics.medianHoursToFirstAcceptedContribution)}
          />
          <HealthRow
            icon={Clock}
            label="First-review wait"
            value={formatDuration(metrics.medianHoursToFirstResponse)}
          />
          <HealthRow
            icon={Hourglass}
            label="Waiting on a review"
            value={metrics.waitingOnResponseCount}
            attention={metrics.waitingOnResponseCount > 0}
          />
          <HealthRow
            icon={TrendingDown}
            label="Stalled hires"
            value={metrics.stalledCount}
            attention={metrics.stalledCount > 0}
          />
        </ul>
      )}
    </PmCard>
  );
}
