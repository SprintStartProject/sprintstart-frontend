import type { LucideIcon } from "lucide-react";
import { AlertTriangle, ArrowRight, CheckCircle2, Eye, PlaneLanding, Target } from "lucide-react";
import { Badge, type BadgeVariant } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Spinner } from "../../../components/ui/Spinner";
import { useArrivalAuthoring } from "../../arrival/hooks/useArrivalAuthoring";
import { mergedStepCount } from "../../arrival/mergedSteps";
import { useProjectContext } from "../../projects/useProjectContext";
import { useStarterWorkPool } from "../../starter-work/hooks/useStarterWorkPool";
import { useStarterWorkReview } from "../../starter-work/hooks/useStarterWorkReview";
import type { StarterWorkFocus } from "../../starter-work/components/StarterWorkSection";

type OverviewTarget = "arrival" | "starter";

type OverviewSectionProps = {
  /** Switches the First Week tab, optionally telling the Starter work tab what to do once there. */
  onNavigate: (tab: OverviewTarget, focus?: StarterWorkFocus) => void;
};

/**
 * The default First Week tab: where a new hire stands across the three stages in order — arrival
 * steps, their first task, and the wider starter-work pool — plus up to three things worth a PM's
 * attention right now.
 *
 * Reads the same data the Arrival and Starter work tabs own (`useArrivalAuthoring`,
 * `useStarterWorkPool`, `useStarterWorkReview`) rather than a summary endpoint of its own — there
 * is no aggregate to keep in sync, and every figure here is something either tab can already show.
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

  const companySteps = company ?? [];
  const projectSteps = project ?? [];
  const stepCount = mergedStepCount(company, project);
  const autoCheckedCount = companySteps.filter((step) => step.settledBy === "OBSERVED").length;

  const taskZeroCount = pool.filter((task) => task.taskZeroEligible).length;
  const unseenCount = unseenTasks.length;
  const missingDerivable = derivable.find((candidate) => !candidate.added) ?? null;

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
        <div className="grid gap-4 sm:grid-cols-3">
          <StageCard
            testId="overview-stage-arrival"
            icon={PlaneLanding}
            step={1}
            label="Arrive"
            figure={stepCount}
            figureSuffix={
              projectName ? `steps for someone on ${projectName}` : "steps for every new hire"
            }
            chips={[
              { variant: "neutral", label: `${autoCheckedCount} checked automatically` },
              ...(projectName
                ? [
                    {
                      variant: "brand" as const,
                      label: `${projectSteps.length} added by ${projectName}`,
                    },
                  ]
                : []),
            ]}
            actionLabel="Edit arrival"
            onClick={() => onNavigate("arrival")}
          />
          <StageCard
            testId="overview-stage-task0"
            icon={Target}
            step={2}
            label="First task"
            figure={taskZeroCount}
            figureSuffix="tasks marked as Task 0"
            chips={[
              taskZeroCount > 0
                ? { variant: "success", label: "Hires get one automatically", icon: CheckCircle2 }
                : { variant: "warning", label: "No Task 0 yet", icon: AlertTriangle },
            ]}
            actionLabel="Choose Task 0"
            onClick={() => onNavigate("starter", "task0")}
          />
          <StageCard
            testId="overview-stage-starter"
            icon={Eye}
            step={3}
            label="Starter work"
            figure={pool.length}
            figureSuffix="tasks hires can pick"
            chips={[
              unseenCount > 0
                ? { variant: "brand", label: `${unseenCount} not looked at yet` }
                : { variant: "success", label: "All looked at", icon: CheckCircle2 },
              ...(staleTasks.length > 0
                ? [
                    {
                      variant: "neutral" as const,
                      label: `${staleTasks.length} closed in their tracker`,
                    },
                  ]
                : []),
            ]}
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

type StageChip = { variant: BadgeVariant; label: string; icon?: LucideIcon };

function StageCard({
  testId,
  icon: Icon,
  step,
  label,
  figure,
  figureSuffix,
  chips,
  actionLabel,
  onClick,
}: {
  testId: string;
  icon: LucideIcon;
  step: number;
  label: string;
  figure: number;
  figureSuffix: string;
  chips: StageChip[];
  actionLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className="flex flex-col gap-3 rounded-2xl border border-app-border bg-app-surface p-5 text-left transition-colors hover:border-app-border-strong"
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-app-brand-border bg-app-brand-soft text-xs font-bold text-app-brand-text">
          {step}
        </span>
        <span className="text-sm font-medium text-app-text-muted">{label}</span>
        <Icon className="ml-auto h-5 w-5 text-app-brand-text" aria-hidden="true" />
      </div>

      <p className="text-3xl font-bold tracking-tight text-app-text">
        {figure}
        <span className="ml-1.5 text-sm font-medium text-app-text-muted">{figureSuffix}</span>
      </p>

      <div className="flex flex-wrap gap-1.5">
        {chips.map((chip) => (
          <Badge key={chip.label} variant={chip.variant} size="md" className="gap-1">
            {chip.icon && <chip.icon className="h-3 w-3" aria-hidden="true" />}
            {chip.label}
          </Badge>
        ))}
      </div>

      <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-app-brand-text">
        {actionLabel}
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    </button>
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
