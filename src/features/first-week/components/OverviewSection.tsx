import type { LucideIcon } from "lucide-react";
import { Eye, PlaneLanding, Target } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Spinner } from "../../../components/ui/Spinner";
import { useArrivalAuthoring } from "../../arrival/hooks/useArrivalAuthoring";
import { mergedStepCount } from "../../arrival/mergedSteps";
import { useProjectContext } from "../../projects/useProjectContext";
import { useStarterWorkPool } from "../../starter-work/hooks/useStarterWorkPool";
import { useStarterWorkReview } from "../../starter-work/hooks/useStarterWorkReview";
import type { StarterWorkFocus } from "../../starter-work/components/StarterWorkSection";
import { buildReadiness } from "../readiness";
import { StageCard } from "./StageCard";

type OverviewTarget = "arrival" | "starter";

type OverviewSectionProps = {
  /** Switches the First Week tab, optionally telling the Starter work tab what to do once there. */
  onNavigate: (tab: OverviewTarget, focus?: StarterWorkFocus) => void;
};

/**
 * The default First Week tab: whether the three preparation stages — arrival steps, their first
 * task, and the wider starter-work pool — are actually ready for the next hire, plus up to three
 * things worth a PM's attention right now.
 *
 * Reads the same data the Arrival and Starter work tabs own (`useArrivalAuthoring`,
 * `useStarterWorkPool`, `useStarterWorkReview`) rather than a summary endpoint of its own — there
 * is no aggregate to keep in sync, and every readiness check here is something either tab can
 * already show. `buildReadiness` (see `../readiness`) turns that raw data into a status per stage.
 */
export function OverviewSection({ onNavigate }: OverviewSectionProps) {
  const { selectedProjectId, selectedProject } = useProjectContext();
  const projectId = selectedProjectId || null;
  const projectName = selectedProject?.name ?? null;

  const { company, project, derivable, loading: isArrivalLoading } = useArrivalAuthoring(projectId);
  const { pool, isLoading: isPoolLoading } = useStarterWorkPool();
  const { pool: staleTasks, isLoading: isStaleLoading } = useStarterWorkPool("STALE");
  const { tasks: unseenTasks, isLoading: isReviewLoading } = useStarterWorkReview();

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
  const missingDerivable = derivable.find((candidate) => !candidate.added) ?? null;

  const readiness = buildReadiness({
    company,
    project,
    derivable,
    pool,
    stale: staleTasks,
    unseenCount,
    projectName,
    now: new Date(),
  });

  const upNext: UpNextItem[] = [
    unseenCount > 0
      ? {
          key: "unseen",
          icon: Eye,
          tone: "brand",
          title: `${unseenCount} ${unseenCount === 1 ? "task" : "tasks"} nobody has looked at yet`,
          description:
            "Hires can already pick them. A quick look moves the good ones up their list.",
          actionLabel: "Go through them",
          onAction: () => onNavigate("starter", "triage"),
        }
      : null,
    taskZeroCount === 0
      ? {
          key: "no-task-zero",
          icon: Target,
          tone: "warning",
          title: "No Task 0 yet",
          description:
            "New hires get no automatic first task until one pool task is marked Task 0.",
          actionLabel: "Choose Task 0",
          onAction: () => onNavigate("starter", "task0"),
        }
      : null,
    missingDerivable
      ? {
          key: "derivable",
          icon: Eye,
          tone: "neutral",
          title: `“${missingDerivable.suggestedTitle}” isn't on the arrival list`,
          description: "We can check this one ourselves, so hires don't have to tick it.",
          actionLabel: "Add it",
          onAction: () => onNavigate("arrival"),
        }
      : null,
  ]
    .filter((item): item is UpNextItem => item !== null)
    .slice(0, 3);

  return (
    <div className="space-y-8">
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
            onClick={() => onNavigate("arrival")}
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
            onClick={() => onNavigate("starter", "task0")}
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
            onClick={() => onNavigate("starter")}
          />
        </div>
      </section>

      {upNext.length > 0 && (
        <section aria-label="Up next">
          <h2 className="mb-3 text-lg font-semibold tracking-tight text-app-text">Up next</h2>
          <div className="space-y-2">
            {upNext.map(({ key, ...item }) => (
              <UpNextRow key={key} testId={`overview-upnext-${key}`} {...item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

type UpNextItem = {
  key: string;
  icon: LucideIcon;
  tone: "brand" | "warning" | "neutral";
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
};

const UP_NEXT_TONE_CLASSES: Record<UpNextItem["tone"], string> = {
  brand: "bg-app-brand-soft text-app-brand-text",
  warning: "bg-app-warning-bg text-app-warning-text",
  neutral: "bg-app-neutral-bg text-app-neutral-text",
};

function UpNextRow({
  testId,
  icon: Icon,
  tone,
  title,
  description,
  actionLabel,
  onAction,
}: Omit<UpNextItem, "key"> & { testId: string }) {
  return (
    <div
      data-testid={testId}
      className="flex flex-wrap items-center gap-3 rounded-2xl border border-app-border bg-app-surface p-4"
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${UP_NEXT_TONE_CLASSES[tone]}`}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-app-text">{title}</p>
        <p className="text-xs text-app-text-subtle">{description}</p>
      </div>
      <Button variant="secondary" size="sm" className="shrink-0" onClick={onAction}>
        {actionLabel}
      </Button>
    </div>
  );
}
