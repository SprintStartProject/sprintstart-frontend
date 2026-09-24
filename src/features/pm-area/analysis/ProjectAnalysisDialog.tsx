import { AnimatePresence, motion } from "framer-motion";
import { CircleDashed, Loader2, Sparkles } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Checkbox } from "../../../components/ui/Checkbox";
import { Modal } from "../../../components/ui/Modal";
import { formatRelativeDate } from "../../knowledge-gaps/format";
import { AnalysisConstellation } from "./AnalysisConstellation";
import { AnalysisMap } from "./AnalysisMap";
import { AREA_META, AREA_ORDER, SEVERITY_RANK, type FindingFilter } from "./analysisMeta";
import { scoreVerdict, type Finding, type FindingArea } from "./findings";
import { HealthPanel } from "./HealthPanel";
import type {
  AnalysisOptions,
  AnalysisPhase,
  AnalysisRunSummary,
  AnalysisTask,
} from "./useProjectAnalysis";

type ProjectAnalysisDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  phase: AnalysisPhase;
  tasks: readonly AnalysisTask[];
  findings: readonly Finding[];
  score: number | null;
  /** When the results on screen were produced. */
  resultsAt: string | null;
  previousRun: AnalysisRunSummary | null;
  lastRun: AnalysisRunSummary | null;
  projectName?: string;
  canEvaluateIndustry: boolean;
  options: AnalysisOptions;
  onOptionsChange: (options: AnalysisOptions) => void;
  onStart: () => void;
  /** Opens where a finding can be acted on; the dialog closes first. */
  onOpenFinding: (to: string) => void;
  keptAsChecklist: boolean;
  onKeepChecklist: () => void;
};

const TASK_STATUS_LABEL: Record<AnalysisTask["status"], string> = {
  pending: "Waiting",
  running: "Checking…",
  done: "Done",
  failed: "Failed",
  skipped: "Skipped",
};

/** The frosted panel the reference sets its readouts on. */
const glassClassName =
  "rounded-2xl border border-app-border-muted bg-app-surface/60 p-5 backdrop-blur-xl";

function OptionRow({
  checked,
  disabled = false,
  onChange,
  title,
  description,
  tone = "default",
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  description: string;
  tone?: "default" | "warning";
}) {
  const id = useId();

  return (
    <label
      htmlFor={id}
      className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
        checked && tone === "warning"
          ? "border-app-warning-border bg-app-warning-bg"
          : "border-app-border-muted bg-app-surface/50 hover:bg-app-surface/80"
      } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
    >
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-app-text">{title}</span>
        <span className="block text-xs text-app-text-muted">{description}</span>
      </span>
    </label>
  );
}

function TaskList({ tasks }: { tasks: readonly AnalysisTask[] }) {
  return (
    <ol className="space-y-1">
      {tasks.map((task) => {
        const Icon = AREA_META[task.id].icon;
        return (
          <li key={task.id} className="flex items-center gap-2.5 rounded-xl px-1.5 py-1.5 text-sm">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${AREA_META[task.id].chip}`}
            >
              <Icon aria-hidden="true" className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-app-text">{task.label}</span>
              {task.note && (
                <span
                  className={`block truncate text-xs ${task.status === "failed" ? "text-app-danger-text" : "text-app-text-muted"}`}
                  title={task.note}
                >
                  {task.note}
                </span>
              )}
            </span>
            <span
              className={`flex shrink-0 items-center gap-1 text-xs font-medium ${
                task.status === "done"
                  ? "text-app-success-text"
                  : task.status === "failed"
                    ? "text-app-danger-text"
                    : task.status === "running"
                      ? "text-app-brand-text"
                      : "text-app-text-subtle"
              }`}
            >
              {task.status === "running" ? (
                <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
              ) : task.status === "pending" ? (
                <CircleDashed aria-hidden="true" className="h-3.5 w-3.5" />
              ) : null}
              {TASK_STATUS_LABEL[task.status]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** The area the results open on: wherever the most pressing finding is. */
function firstArea(findings: readonly Finding[]): FindingArea {
  const worst = [...findings].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity],
  )[0];
  return worst?.area ?? AREA_ORDER[0];
}

function Results({
  findings,
  score,
  resultsAt,
  previousRun,
  projectName,
  onOpenFinding,
  keptAsChecklist,
  onKeepChecklist,
  onStart,
}: Pick<
  ProjectAnalysisDialogProps,
  | "findings"
  | "resultsAt"
  | "previousRun"
  | "projectName"
  | "onOpenFinding"
  | "keptAsChecklist"
  | "onKeepChecklist"
  | "onStart"
> & { score: number }) {
  const [filter, setFilter] = useState<FindingFilter>("act");
  const [area, setArea] = useState<FindingArea>(() => firstArea(findings));

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 xl:py-4">
        <AnalysisMap
          findings={findings}
          filter={filter}
          onFilterChange={setFilter}
          selectedArea={area}
          onSelectArea={setArea}
          onOpenFinding={onOpenFinding}
          core={
            <>
              {projectName && (
                <span className="text-sm font-semibold text-app-text">{projectName}</span>
              )}
              <span className="text-xs text-app-text-muted">
                {score}/100 · {scoreVerdict(score).toLowerCase()}
              </span>
            </>
          }
        />
      </div>
      <HealthPanel
        score={score}
        findings={findings}
        analysedAt={resultsAt}
        previous={previousRun ? { at: previousRun.at, score: previousRun.score } : null}
        keptAsChecklist={keptAsChecklist}
        onKeepChecklist={onKeepChecklist}
        onRunAgain={onStart}
      />
    </div>
  );
}

/**
 * The project analysis: choose what to refresh, watch it run, read what it found.
 *
 * Always dark, whatever the app's theme: modelled on a node-graph reference where the project is
 * a glowing core in a small universe and everything connects to it by luminous lines — which only
 * reads on a dark ground. One dialog through all three stages, so the time between pressing the
 * button and reading the result is spent watching the checks come in rather than on a spinner.
 * Closing it while it runs does not stop the run — the launcher keeps the state.
 */
export function ProjectAnalysisDialog({
  isOpen,
  onClose,
  phase,
  tasks,
  findings,
  score,
  resultsAt,
  previousRun,
  lastRun,
  projectName,
  canEvaluateIndustry,
  options,
  onOptionsChange,
  onStart,
  onOpenFinding,
  keptAsChecklist,
  onKeepChecklist,
}: ProjectAnalysisDialogProps) {
  const running = phase === "running";
  const done = phase === "done" && score !== null;
  const finished = tasks.filter(
    (task) => task.status !== "pending" && task.status !== "running",
  ).length;

  const footer = done ? undefined : running ? (
    <Button variant="secondary" onClick={onClose}>
      Keep running in the background
    </Button>
  ) : (
    <>
      <Button variant="secondary" onClick={onClose}>
        Cancel
      </Button>
      <Button variant="primary" onClick={onStart} icon={<Sparkles className="h-4 w-4" />}>
        Start analysis
      </Button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="full"
      // Dark regardless of the app's theme, on a ground lit from two sides like the reference.
      panelClassName="dark bg-[radial-gradient(ellipse_at_18%_40%,color-mix(in_oklab,var(--cyan-text)_12%,transparent),transparent_55%),radial-gradient(ellipse_at_85%_0%,color-mix(in_oklab,var(--purple-text)_10%,transparent),transparent_50%)]"
      title="Project analysis"
      description={
        done
          ? "Everything refreshed at once. Pick an area to see what it found, and open any card to act on it."
          : running
            ? "Refreshing every part of the project at once…"
            : "Refresh everything the dashboard shows in one go, then see what needs you."
      }
      footer={footer}
      testId="project-analysis-dialog"
    >
      <AnimatePresence mode="wait" initial={false}>
        {done ? (
          <motion.div
            key="results"
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Results
              findings={findings}
              score={score}
              resultsAt={resultsAt}
              previousRun={previousRun}
              projectName={projectName}
              onOpenFinding={onOpenFinding}
              keptAsChecklist={keptAsChecklist}
              onKeepChecklist={onKeepChecklist}
              onStart={onStart}
            />
          </motion.div>
        ) : (
          <motion.div
            key="scan"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.02, filter: "blur(4px)" }}
            transition={{ duration: 0.35 }}
            className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]"
          >
            <div className="flex min-w-0 justify-center">
              <AnalysisConstellation tasks={tasks} active={running} projectName={projectName} />
            </div>

            {running ? (
              <div role="status" aria-live="polite" className={glassClassName}>
                <div className="mb-3 flex items-baseline justify-between text-xs text-app-text-muted">
                  <span className="font-semibold tracking-widest text-app-brand-text uppercase">
                    Checking
                  </span>
                  <span className="tabular-nums">
                    {finished} of {tasks.length}
                  </span>
                </div>
                <span
                  aria-hidden="true"
                  className="mb-4 block h-1.5 overflow-hidden rounded-full bg-app-progress-track"
                >
                  <motion.span
                    className="block h-full rounded-full bg-gradient-to-r from-app-progress-fill to-app-progress-fill-end"
                    style={{ boxShadow: "0 0 12px var(--brand-text)" }}
                    animate={{ width: `${(finished / tasks.length) * 100}%` }}
                    transition={{ duration: 0.4 }}
                  />
                </span>
                <TaskList tasks={tasks} />
              </div>
            ) : (
              <div className={`${glassClassName} space-y-4`}>
                <p className="text-sm text-app-text-muted">
                  Team, onboarding, escalations, questions, gaps, data sources and industry are all
                  read again. These three ask the AI to redo work first:
                </p>
                <div className="space-y-2">
                  <OptionRow
                    checked={options.rescanGaps}
                    onChange={(checked) => onOptionsChange({ ...options, rescanGaps: checked })}
                    title="Rescan knowledge gaps"
                    description="Checks every component's documentation again."
                  />
                  <OptionRow
                    checked={options.reevaluateIndustry && canEvaluateIndustry}
                    disabled={!canEvaluateIndustry}
                    onChange={(checked) =>
                      onOptionsChange({ ...options, reevaluateIndustry: checked })
                    }
                    title="Re-evaluate the industry"
                    description={
                      canEvaluateIndustry
                        ? "Never over one you set by hand."
                        : "Only the project's manager or an admin can."
                    }
                  />
                  <OptionRow
                    checked={options.regroupQuestions}
                    tone="warning"
                    onChange={(checked) =>
                      onOptionsChange({ ...options, regroupQuestions: checked })
                    }
                    title="Regroup recurring questions"
                    description="Replaces the current entries — titles are rewritten and links to single entries stop working."
                  />
                </div>
                {lastRun && (
                  <p className="text-xs text-app-text-subtle">
                    Last run {formatRelativeDate(lastRun.at)} · {lastRun.score}/100
                  </p>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}
