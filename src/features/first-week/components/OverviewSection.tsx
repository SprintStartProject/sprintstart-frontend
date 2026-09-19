import { Eye, PlaneLanding, Target } from "lucide-react";
import { Spinner } from "../../../components/ui/Spinner";
import { useQueryFetch } from "../../../hooks/useQueryFetch";
import { onboardingMetricsService } from "../../../services/onboardingMetricsService";
import { queryKeys } from "../../../services/queryKeys";
import { useArrivalAuthoring } from "../../arrival/hooks/useArrivalAuthoring";
import { mergedStepCount } from "../../arrival/mergedSteps";
import { useProjectContext } from "../../projects/useProjectContext";
import { useStarterWorkPool } from "../../starter-work/hooks/useStarterWorkPool";
import { useStarterWorkReview } from "../../starter-work/hooks/useStarterWorkReview";
import { buildReadiness, type OverviewTarget } from "../readiness";
import { FirstWeekHires } from "./FirstWeekHires";
import { NeedsYouList } from "./NeedsYouList";
import { StageCard } from "./StageCard";

type OverviewSectionProps = {
  /** Switches the First Week tab, optionally telling the target tab what to do once there. */
  onNavigate: (target: OverviewTarget) => void;
};

/**
 * The default First Week tab: whether the three preparation stages — arrival steps, their first
 * task, and the wider starter-work pool — are actually ready for the next hire, plus every open
 * readiness check worth a PM's attention right now.
 *
 * Reads the same data the Arrival and Starter work tabs own (`useArrivalAuthoring`,
 * `useStarterWorkPool`, `useStarterWorkReview`) rather than a summary endpoint of its own — there
 * is no aggregate to keep in sync, and every readiness check here is something either tab can
 * already show. `buildReadiness` (see `../readiness`) turns that raw data into a status per stage
 * plus the prioritised list `NeedsYouList` renders.
 */
export function OverviewSection({ onNavigate }: OverviewSectionProps) {
  const { selectedProjectId, selectedProject } = useProjectContext();
  const projectId = selectedProjectId || null;
  const projectName = selectedProject?.name ?? null;

  const { company, project, derivable, loading: isArrivalLoading } = useArrivalAuthoring(projectId);
  const { pool, isLoading: isPoolLoading } = useStarterWorkPool();
  const { pool: staleTasks, isLoading: isStaleLoading } = useStarterWorkPool("STALE");
  const { tasks: unseenTasks, isLoading: isReviewLoading } = useStarterWorkReview();
  // Shares its cache and query key with `FirstWeekHires` below (and with the standalone
  // Onboarding insights page) rather than being awaited here: a slow or failed load must not hold
  // up the readiness cards, so it is read as "no hires yet" until it resolves rather than gating
  // the spinner above.
  const { data: onboardingMetrics } = useQueryFetch(
    queryKeys.onboardingMetrics.project(projectId ?? ""),
    () =>
      projectId ? onboardingMetricsService.fetchProjectMetrics(projectId) : Promise.resolve(null),
  );

  if (isArrivalLoading || isPoolLoading || isStaleLoading || isReviewLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" label="Loading the overview" />
      </div>
    );
  }

  const stepCount = mergedStepCount(company, project);
  const taskZeroCount = pool.filter((task) => task.taskZeroEligible).length;
  const unseenCount = unseenTasks.length;

  const readiness = buildReadiness({
    company,
    project,
    derivable,
    pool,
    stale: staleTasks,
    unseenCount,
    projectName,
    hires: onboardingMetrics?.hires,
    now: new Date(),
  });

  return (
    <div className="space-y-8">
      <NeedsYouList checks={readiness.openChecks} onNavigate={onNavigate} />

      <section aria-label="The first week, in order">
        <h2 className="mb-3 text-lg font-semibold tracking-tight text-app-text">
          A new hire&apos;s first week
        </h2>
        <div className="relative grid gap-4 sm:grid-cols-3">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-[34px] hidden sm:block"
          >
            <div
              className="absolute h-px bg-app-border"
              style={{ left: "calc(33.333% - 8px)", width: "16px" }}
            />
            <div
              className="absolute h-px bg-app-border"
              style={{ left: "calc(66.666% - 8px)", width: "16px" }}
            />
          </div>
          <StageCard
            testId="overview-stage-arrival"
            icon={PlaneLanding}
            step={1}
            label="Arrive"
            status={readiness.stages.arrive.status}
            checks={readiness.stages.arrive.checks}
            figureLabel={`${stepCount} ${stepCount === 1 ? "step" : "steps"}`}
            actionLabel="Edit arrival"
            onClick={() => onNavigate({ tab: "arrival" })}
          />
          <StageCard
            testId="overview-stage-task0"
            icon={Target}
            step={2}
            label="First task"
            status={readiness.stages.task0.status}
            checks={readiness.stages.task0.checks}
            figureLabel={`${taskZeroCount} Task 0`}
            actionLabel="Choose Task 0"
            onClick={() => onNavigate({ tab: "starter", focus: "task0" })}
          />
          <StageCard
            testId="overview-stage-starter"
            icon={Eye}
            step={3}
            label="Starter work"
            status={readiness.stages.starter.status}
            checks={readiness.stages.starter.checks}
            figureLabel={`${pool.length} in the pool`}
            actionLabel="Open the pool"
            onClick={() => onNavigate({ tab: "starter" })}
          />
        </div>
      </section>

      <FirstWeekHires projectId={projectId} />
    </div>
  );
}
