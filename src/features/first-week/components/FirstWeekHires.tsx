import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  GitBranch,
  GitMerge,
  GitPullRequest,
  Hand,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "../../../components/ui/Badge";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Spinner } from "../../../components/ui/Spinner";
import { UserAvatar } from "../../../components/common/UserAvatar";
import { useQueryFetch } from "../../../hooks/useQueryFetch";
import { onboardingMetricsService } from "../../../services/onboardingMetricsService";
import { queryKeys } from "../../../services/queryKeys";
import { formatDaysAgo, hoursSince } from "../../onboarding-metrics/format";
import { isAwaitingFirstResponse } from "../../onboarding-metrics/hireStatus";
import type { HireTimeline } from "../../onboarding-metrics/types";
import { hiresInFirstWeeks } from "../readiness";

type FirstWeekHiresProps = {
  projectId: string | null;
};

type MiniMoment = { label: string; reached: boolean; icon: LucideIcon };

function miniMoments(hire: HireTimeline): MiniMoment[] {
  return [
    { label: "GitHub linked", reached: hire.githubLogin !== null, icon: GitBranch },
    { label: "First task", reached: hire.firstTaskClaimedAt !== null, icon: Hand },
    {
      label: "Work opened",
      reached: hire.firstContributionOpenedAt !== null,
      icon: GitPullRequest,
    },
    { label: "Accepted", reached: hire.firstContributionAcceptedAt !== null, icon: GitMerge },
  ];
}

function joinedLabel(joinedAt: string | null): string {
  const hours = hoursSince(joinedAt);
  return hours === null ? "join date unknown" : `joined ${formatDaysAgo(Math.floor(hours / 24))}`;
}

function HireRow({ hire }: { hire: HireTimeline }) {
  const awaitingReview = isAwaitingFirstResponse(hire);

  return (
    <li
      data-testid={`overview-hire-${hire.userId}`}
      className="flex flex-wrap items-center gap-3 rounded-2xl border border-app-border bg-app-surface p-4"
    >
      <span className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-app-surface-muted">
        <UserAvatar size={36} fallbackName={hire.displayName} seed={hire.userId} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold text-app-text">{hire.displayName}</span>
          {hire.stalled && (
            <Badge
              variant="danger"
              size="sm"
              className="gap-1"
              title={hire.stalledReason ?? undefined}
            >
              Stalled
            </Badge>
          )}
          {awaitingReview && (
            <Badge variant="orange" size="sm" className="gap-1">
              Waiting on a response
            </Badge>
          )}
        </div>
        <p className="text-xs text-app-text-subtle">{joinedLabel(hire.joinedAt)}</p>
      </div>

      <ol className="flex shrink-0 items-center gap-1.5">
        {miniMoments(hire).map((moment) => (
          <li key={moment.label} title={moment.label}>
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                moment.reached
                  ? "border-app-brand bg-app-brand text-white"
                  : "border-dashed border-app-border text-app-text-subtle"
              }`}
            >
              <moment.icon className="h-3 w-3" aria-hidden="true" />
              <span className="sr-only">
                {moment.label}: {moment.reached ? "done" : "not yet"}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </li>
  );
}

/**
 * The real hires the readiness stages above are preparing for: whoever is still within their
 * first two weeks, or has not yet had a first contribution accepted no matter how long ago they
 * joined — see `hiresInFirstWeeks` in `../readiness`.
 *
 * Reads `onboardingMetricsService.fetchProjectMetrics` through the same query key
 * (`queryKeys.onboardingMetrics.project`) as `OnboardingMetricsPage`/`OnboardingMetricsWidget`, so
 * all three share one cached request instead of racing each other for fresher data.
 *
 * Loads and fails independently of the rest of the Overview tab: a broken or slow onboarding
 * metrics endpoint shows its own inline error here, and never takes the readiness cards above it
 * down with it.
 */
export function FirstWeekHires({ projectId }: FirstWeekHiresProps) {
  const navigate = useNavigate();

  const {
    data: metrics,
    loading,
    error,
  } = useQueryFetch(queryKeys.onboardingMetrics.project(projectId ?? ""), () =>
    projectId ? onboardingMetricsService.fetchProjectMetrics(projectId) : Promise.resolve(null),
  );

  const hires = metrics ? hiresInFirstWeeks(metrics.hires, new Date()) : [];

  return (
    <section aria-label="People in their first weeks">
      <h2 className="mb-3 text-lg font-semibold tracking-tight text-app-text">
        People in their first weeks
      </h2>

      {!projectId ? (
        <EmptyState size="sm">Pick a project to see its hires.</EmptyState>
      ) : loading ? (
        <div className="flex items-center justify-center py-8">
          <Spinner label="Loading hires" />
        </div>
      ) : error || !metrics ? (
        <div className="flex items-center gap-2 rounded-2xl border border-app-border bg-app-surface-muted px-4 py-3">
          <AlertCircle className="h-4 w-4 shrink-0 text-app-text-muted" aria-hidden="true" />
          <p className="text-sm text-app-text-muted">
            Hires couldn&apos;t be loaded for this project.
          </p>
        </div>
      ) : hires.length === 0 ? (
        <EmptyState size="sm">No one in their first weeks.</EmptyState>
      ) : (
        <>
          <ul className="space-y-2">
            {hires.map((hire) => (
              <HireRow key={hire.userId} hire={hire} />
            ))}
          </ul>
          <button
            type="button"
            onClick={() => void navigate("/insights/onboarding")}
            className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-app-brand-text"
          >
            See all in Onboarding insights
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </>
      )}
    </section>
  );
}
