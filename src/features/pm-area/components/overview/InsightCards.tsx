import {
  CheckCircle2,
  Clock,
  Gauge,
  Inbox,
  Hourglass,
  MessageSquareMore,
  Rocket,
  ShieldAlert,
  TrendingDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { UserAvatar } from "../../../../components/common/UserAvatar";
import { EmptyState } from "../../../../components/ui/EmptyState";
import { SkeletonGroup, SkeletonLine } from "../../../../components/ui/Skeleton";
import { Spinner } from "../../../../components/ui/Spinner";
import { useLiveFetch } from "../../../../hooks/useLiveFetch";
import { useQueryFetch } from "../../../../hooks/useQueryFetch";
import { insightsService } from "../../../../services/faqService";
import { knowledgeGapService } from "../../../../services/knowledgeGapService";
import { knowledgeRequestService } from "../../../../services/knowledgeRequestService";
import { onboardingMetricsService } from "../../../../services/onboardingMetricsService";
import { queryKeys } from "../../../../services/queryKeys";
import { WidgetBar } from "../../../dashboard/components/WidgetBar";
import { summarizeGaps, topQuestions } from "../../../dashboard/teamInsights";
import { TrendBadge } from "../../../faq/components/TrendBadge";
import { SEVERITY_ORDER, SEVERITY_STYLES } from "../../../knowledge-gaps/severity";
import { formatWaiting, hasWaitedADay } from "../../../knowledge-request/format";
import { formatDuration } from "../../../onboarding-metrics/format";
import { hireMoments } from "../../../onboarding-metrics/moments";
import { useProjectContext } from "../../../projects/useProjectContext";
import { FunnelChart, type FunnelStage } from "../charts/FunnelChart";
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

function HealthFigure({
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
    <li className="flex min-w-0 items-center gap-2 rounded-xl bg-app-surface-muted px-2.5 py-2">
      <span
        aria-hidden="true"
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
          attention
            ? "bg-app-warning-bg text-app-warning-text"
            : "bg-app-cyan-bg text-app-cyan-text"
        }`}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm leading-tight font-semibold text-app-text tabular-nums">
          {value}
        </span>
        <span className="block truncate text-[11px] text-app-text-muted">{label}</span>
      </span>
    </li>
  );
}

/**
 * How far the project's hires have come — joined, claimed a task, put work up, heard back, had
 * it accepted — as a funnel, with the four figures onboarding is judged on underneath. The funnel
 * is where a drop shows: ten hires who claimed a task and two who ever heard back is a review
 * problem, not a hiring one.
 *
 * No card of its own: it is the right half of the team card (`TeamProgressCard`), beside the
 * team's stages, so the overview reads team and onboarding as one picture.
 */
export function OnboardingHealthSummary() {
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

  const hires = metrics?.hires ?? [];
  const stages: FunnelStage[] =
    hires.length === 0
      ? []
      : hireMoments(hires[0]).map((moment, index) => ({
          key: moment.label,
          label: moment.label,
          icon: moment.icon,
          value: hires.filter((hire) => hireMoments(hire)[index].at !== null).length,
        }));

  return (
    <section aria-label="Onboarding health" className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-[10px] font-semibold tracking-widest text-app-cyan-text uppercase">
          <Gauge aria-hidden="true" className="h-3.5 w-3.5" />
          Onboarding health
          {metrics && (
            <span className="font-medium tracking-normal text-app-text-muted normal-case">
              · {metrics.memberCount} hires
            </span>
          )}
        </p>
        <PmCardLink to="/insights/onboarding">Details</PmCardLink>
      </div>

      {loading ? (
        <CardSkeleton label="Loading onboarding metrics" />
      ) : error || !metrics ? (
        <EmptyState size="sm">No onboarding metrics for this project yet.</EmptyState>
      ) : metrics.memberCount === 0 ? (
        <EmptyState size="sm">No hires on this project yet.</EmptyState>
      ) : (
        <>
          {stages.length > 0 && (
            <FunnelChart
              stages={stages}
              ariaLabel="Hires by how far they have come"
              colorClassName="text-app-cyan-text"
            />
          )}
          <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <HealthFigure
              icon={Rocket}
              label="To accepted work"
              value={formatDuration(metrics.medianHoursToFirstAcceptedContribution)}
            />
            <HealthFigure
              icon={Clock}
              label="First-review wait"
              value={formatDuration(metrics.medianHoursToFirstResponse)}
            />
            <HealthFigure
              icon={Hourglass}
              label="Waiting on a review"
              value={metrics.waitingOnResponseCount}
              attention={metrics.waitingOnResponseCount > 0}
            />
            <HealthFigure
              icon={TrendingDown}
              label="Stalled hires"
              value={metrics.stalledCount}
              attention={metrics.stalledCount > 0}
            />
          </ul>
        </>
      )}
    </section>
  );
}

/** How long ago, in the fewest words: "today", "3d ago", "5w ago". */
function ago(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "today";
  if (days < 14) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

/** How many milestones the list shows. */
const MILESTONES = 6;

/**
 * The team's latest milestones — a hire joining, claiming a first task, putting work up, hearing
 * back, having it accepted — newest first. The funnel beside it says how many got how far; this
 * says what happened lately, and to whom, which is what a manager glancing in wants to hear.
 */
export function RecentMilestones() {
  const { selectedProjectId } = useProjectContext();
  const { data: metrics, loading } = useQueryFetch(
    queryKeys.onboardingMetrics.project(selectedProjectId),
    () =>
      selectedProjectId
        ? onboardingMetricsService.fetchProjectMetrics(selectedProjectId)
        : Promise.resolve(null),
  );

  const milestones = (metrics?.hires ?? [])
    .flatMap((hire) =>
      hireMoments(hire)
        .filter((moment): moment is typeof moment & { at: string } => moment.at !== null)
        .map((moment) => ({ ...moment, hire })),
    )
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, MILESTONES);

  return (
    <section aria-label="Recent milestones" className="min-w-0">
      <p className="mb-3 text-[10px] font-semibold tracking-widest text-app-brand-text uppercase">
        Recent milestones
      </p>
      {loading ? (
        <CardSkeleton label="Loading milestones" />
      ) : milestones.length === 0 ? (
        <p className="text-sm text-app-text-muted">Nothing has happened yet.</p>
      ) : (
        <ol className="relative space-y-2.5 before:absolute before:top-2 before:bottom-2 before:left-[13px] before:w-px before:bg-app-border">
          {milestones.map((milestone) => {
            const Icon = milestone.icon;
            return (
              <li
                key={`${milestone.hire.userId}-${milestone.label}`}
                className="relative flex items-center gap-2.5"
              >
                <span
                  aria-hidden="true"
                  className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-app-border bg-app-surface text-app-cyan-text"
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-app-text">
                    {milestone.hire.displayName}
                  </span>
                  <span className="block truncate text-xs text-app-text-muted">
                    {milestone.label}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-app-text-subtle tabular-nums">
                  {ago(milestone.at)}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

/**
 * The escalation inbox, previewed: the questions the buddy could not answer, oldest first — who
 * asked and how long they have been waiting. The figure above only said how many; a hire who has
 * waited a week on an answer looks the same there as one who asked five minutes ago. Answering
 * needs room, so every row leads to the Escalations section rather than answering in place.
 */
export function EscalationsCard() {
  const { selectedProjectId } = useProjectContext();
  const {
    data: open,
    loading,
    error,
  } = useQueryFetch(
    queryKeys.knowledgeRequest.open(selectedProjectId),
    () => knowledgeRequestService.listOpen(selectedProjectId),
    { enabled: Boolean(selectedProjectId) },
  );

  const requests = [...(open ?? [])].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const visible = requests.slice(0, ROWS);

  return (
    <PmCard
      aria-label="Escalations"
      tone="purple"
      className="h-full"
      to="/insights/knowledge-requests"
      linkLabel="Open the escalation inbox"
    >
      <PmCardHeader
        icon={Inbox}
        tone="purple"
        title="Escalations"
        meta={open ? `${requests.length} open` : undefined}
        action={<PmCardLink to="/insights/knowledge-requests">Inbox</PmCardLink>}
      />

      {loading ? (
        <CardSkeleton label="Loading escalations" />
      ) : error || !open ? (
        <EmptyState size="sm">No escalations to show right now.</EmptyState>
      ) : requests.length === 0 ? (
        <p className="flex flex-1 items-center justify-center gap-2 py-6 text-sm text-app-text-muted">
          <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-app-success-solid" />
          Inbox clear — nothing escalated.
        </p>
      ) : (
        <ul className="space-y-0.5">
          {visible.map((request) => {
            const stale = hasWaitedADay(request.createdAt);

            return (
              <li key={request.id}>
                <Link to="/insights/knowledge-requests" className={rowClassName}>
                  <span className="flex items-start gap-2.5">
                    <UserAvatar
                      profileIcon={request.hire?.profileIcon ?? undefined}
                      fallbackName={request.hire?.displayName ?? "?"}
                      seed={request.hire?.userId ?? request.hireId}
                      size={24}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-sm leading-snug text-app-text">
                        {request.question}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-xs text-app-text-muted">
                        <span className="truncate">
                          {request.hire?.displayName ?? "Former member"}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={`inline-flex shrink-0 items-center gap-1 ${
                            stale ? "font-medium text-app-warning-text" : ""
                          }`}
                        >
                          <Clock aria-hidden="true" className="h-3 w-3" />
                          waiting {formatWaiting(request.createdAt)}
                        </span>
                      </span>
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
          {requests.length > visible.length && (
            <li className="px-2 pt-1 text-xs text-app-text-subtle">
              +{requests.length - visible.length} more in the inbox
            </li>
          )}
        </ul>
      )}
    </PmCard>
  );
}
