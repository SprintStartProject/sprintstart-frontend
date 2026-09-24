import { animate, AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  CircleDashed,
  Loader2,
  RotateCcw,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Checkbox } from "../../../components/ui/Checkbox";
import { Collapsible } from "../../../components/ui/Collapsible";
import { Modal } from "../../../components/ui/Modal";
import { SegmentedTabs } from "../../../components/ui/SegmentedTabs";
import { formatRelativeDate } from "../../knowledge-gaps/format";
import { RingGauge } from "../components/charts/RingGauge";
import { AREA_META, SEVERITY_META } from "./analysisMeta";
import { AnalysisOrb } from "./AnalysisOrb";
import { countBySeverity, scoreVerdict, type Finding, type FindingSeverity } from "./findings";
import type {
  AnalysisOptions,
  AnalysisPhase,
  AnalysisRunSummary,
  AnalysisTask,
} from "./useProjectAnalysis";

type Filter = "all" | "act" | "good";

type ProjectAnalysisDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  phase: AnalysisPhase;
  tasks: readonly AnalysisTask[];
  findings: readonly Finding[];
  score: number | null;
  previousRun: AnalysisRunSummary | null;
  lastRun: AnalysisRunSummary | null;
  canEvaluateIndustry: boolean;
  options: AnalysisOptions;
  onOptionsChange: (options: AnalysisOptions) => void;
  onStart: () => void;
  /** Opens where a finding can be acted on; the dialog closes first. */
  onOpenFinding: (to: string) => void;
};

const TASK_STATUS_LABEL: Record<AnalysisTask["status"], string> = {
  pending: "Waiting",
  running: "Checking…",
  done: "Done",
  failed: "Failed",
  skipped: "Skipped",
};

function scoreColor(score: number): string {
  if (score >= 85) return "text-app-success-solid";
  if (score >= 65) return "text-app-brand";
  if (score >= 40) return "text-app-warning-solid";
  return "text-app-danger-solid";
}

/** Counts up to the score once, the way the ring fills. */
function CountUp({ value }: { value: number }) {
  const reduceMotion = useReducedMotion();
  const [shown, setShown] = useState(reduceMotion ? value : 0);

  useEffect(() => {
    if (reduceMotion) return;
    const controls = animate(0, value, {
      duration: 1,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => setShown(Math.round(latest)),
    });
    return () => controls.stop();
  }, [reduceMotion, value]);

  return <>{reduceMotion ? value : shown}</>;
}

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
          : "border-app-border bg-app-surface hover:bg-app-surface-hover"
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
    <ol className="space-y-1.5">
      {tasks.map((task) => {
        const Icon = AREA_META[task.id].icon;
        return (
          <li
            key={task.id}
            className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-sm transition-colors"
          >
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

function FindingCard({
  finding,
  index,
  onOpen,
}: {
  finding: Finding;
  index: number;
  onOpen: (to: string) => void;
}) {
  const reduceMotion = useReducedMotion();
  const area = AREA_META[finding.area];
  const severity = SEVERITY_META[finding.severity];
  const AreaIcon = area.icon;
  const SeverityIcon = severity.icon;

  return (
    <motion.li
      layout={!reduceMotion}
      initial={reduceMotion ? false : { opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduceMotion ? undefined : { opacity: 0, scale: 0.97 }}
      transition={{ delay: reduceMotion ? 0 : Math.min(index, 10) * 0.06, duration: 0.35 }}
      className="relative flex gap-3 overflow-hidden rounded-2xl border border-app-border bg-app-surface py-3.5 pr-3.5 pl-5 shadow-sm"
    >
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${severity.bar}`} />
      <span
        aria-hidden="true"
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${area.chip}`}
      >
        <AreaIcon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${severity.badge}`}
          >
            <SeverityIcon aria-hidden="true" className="h-3 w-3" />
            {severity.label}
          </span>
          <span className="text-[11px] text-app-text-subtle">{area.label}</span>
        </div>
        <p className="mt-1 text-sm font-semibold text-app-text">{finding.title}</p>
        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-app-text-muted">
          {finding.detail}
        </p>
      </div>
      {finding.to && (
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          onClick={() => onOpen(finding.to ?? "")}
          aria-label={`Open: ${finding.title}`}
          title="Open"
          className="shrink-0 self-center"
        >
          <ArrowUpRight className="h-4 w-4" />
        </Button>
      )}
    </motion.li>
  );
}

function Results({
  tasks,
  findings,
  score,
  previousRun,
  onOpenFinding,
}: Pick<ProjectAnalysisDialogProps, "tasks" | "findings" | "previousRun" | "onOpenFinding"> & {
  score: number;
}) {
  const [filter, setFilter] = useState<Filter>("act");
  const [showRefreshed, setShowRefreshed] = useState(false);
  const counts = countBySeverity(findings);
  const toAct = counts.critical + counts.warning + counts.info;
  const delta = previousRun ? score - previousRun.score : null;
  const failed = tasks.filter((task) => task.status === "failed").length;

  const visible = findings.filter((finding) =>
    filter === "all"
      ? true
      : filter === "good"
        ? finding.severity === "good"
        : finding.severity !== "good",
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside aria-label="Summary" className="space-y-4">
        <div className="flex flex-col items-center rounded-2xl border border-app-border bg-app-surface p-5 text-center">
          <RingGauge
            value={score}
            size={148}
            thickness={12}
            colorClassName={scoreColor(score)}
            ariaLabel={`Project health ${score} of 100`}
          >
            <span className="text-4xl leading-none font-bold text-app-text">
              <CountUp value={score} />
            </span>
            <span className="mt-1 text-[11px] text-app-text-muted">of 100</span>
          </RingGauge>
          <p className="mt-3 text-base font-semibold text-app-text">{scoreVerdict(score)}</p>
          {delta !== null && previousRun && (
            <p
              className={`mt-1 inline-flex items-center gap-1 text-xs ${
                delta > 0
                  ? "text-app-success-text"
                  : delta < 0
                    ? "text-app-danger-text"
                    : "text-app-text-muted"
              }`}
            >
              {delta > 0 ? (
                <TrendingUp aria-hidden="true" className="h-3.5 w-3.5" />
              ) : delta < 0 ? (
                <TrendingDown aria-hidden="true" className="h-3.5 w-3.5" />
              ) : null}
              {delta === 0 ? "Same as" : `${delta > 0 ? "+" : ""}${delta} since`} the run{" "}
              {formatRelativeDate(previousRun.at)}
            </p>
          )}
        </div>

        <ul className="space-y-1.5">
          {(["critical", "warning", "info", "good"] as FindingSeverity[]).map((severity) => {
            const meta = SEVERITY_META[severity];
            const Icon = meta.icon;
            return (
              <li
                key={severity}
                className="flex items-center gap-2.5 rounded-xl bg-app-surface-muted px-3 py-2 text-sm"
              >
                <Icon aria-hidden="true" className={`h-4 w-4 ${meta.text}`} />
                <span className="flex-1 text-app-text-muted">{meta.label}</span>
                <span className="font-semibold text-app-text tabular-nums">{counts[severity]}</span>
              </li>
            );
          })}
        </ul>

        <div>
          <button
            type="button"
            onClick={() => setShowRefreshed((open) => !open)}
            aria-expanded={showRefreshed}
            className="flex w-full items-center justify-between rounded-lg px-1 py-1 text-xs font-medium text-app-text-muted hover:text-app-text focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
          >
            What was refreshed{failed > 0 ? ` · ${failed} failed` : ""}
            <ArrowRight
              aria-hidden="true"
              className={`h-3.5 w-3.5 transition-transform ${showRefreshed ? "rotate-90" : ""}`}
            />
          </button>
          <Collapsible open={showRefreshed}>
            <div className="pt-2">
              <TaskList tasks={tasks} />
            </div>
          </Collapsible>
        </div>
      </aside>

      <section aria-label="Findings" className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-app-text">
            {toAct === 0
              ? "Nothing needs you right now"
              : `${toAct} ${toAct === 1 ? "thing" : "things"} worth your attention`}
          </h3>
          <SegmentedTabs
            value={filter}
            onChange={setFilter}
            layoutId="project-analysis-filter"
            ariaLabel="Show findings"
            size="sm"
            options={[
              { value: "act", label: "To look at", count: toAct },
              { value: "good", label: "Going well", count: counts.good },
              { value: "all", label: "All", count: findings.length },
            ]}
          />
        </div>

        {visible.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-app-border px-4 py-10 text-center text-sm text-app-text-muted">
            {filter === "good"
              ? "No good news to report this time."
              : "Nothing to look at — all clear."}
          </p>
        ) : (
          <ul className="grid gap-3 xl:grid-cols-2">
            <AnimatePresence mode="popLayout">
              {visible.map((finding, index) => (
                <FindingCard
                  key={finding.id}
                  finding={finding}
                  index={index}
                  onOpen={onOpenFinding}
                />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </section>
    </div>
  );
}

/**
 * The project analysis: choose what to refresh, watch it run, read what it found.
 *
 * One dialog through all three, so the moment between pressing the button and reading the result
 * is spent watching the checks come in rather than on a spinner. Closing it while it runs does not
 * stop the run — the launcher on the overview keeps the state, and reopening shows where it got to.
 */
export function ProjectAnalysisDialog({
  isOpen,
  onClose,
  phase,
  tasks,
  findings,
  score,
  previousRun,
  lastRun,
  canEvaluateIndustry,
  options,
  onOptionsChange,
  onStart,
  onOpenFinding,
}: ProjectAnalysisDialogProps) {
  const running = phase === "running";
  const done = phase === "done" && score !== null;
  const finished = tasks.filter(
    (task) => task.status !== "pending" && task.status !== "running",
  ).length;

  const footer = done ? (
    <>
      <Button variant="secondary" onClick={onStart} icon={<RotateCcw className="h-4 w-4" />}>
        Run again
      </Button>
      <Button variant="primary" onClick={onClose}>
        Done
      </Button>
    </>
  ) : running ? (
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
      size="2xl"
      title="Project analysis"
      description={
        done
          ? "Everything refreshed at once — here is what it says."
          : running
            ? "Refreshing every part of the project at once…"
            : "Refresh everything the dashboard shows in one go, then get one list of what needs you."
      }
      footer={footer}
      testId="project-analysis-dialog"
    >
      <AnimatePresence mode="wait" initial={false}>
        {done ? (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <Results
              tasks={tasks}
              findings={findings}
              score={score}
              previousRun={previousRun}
              onOpenFinding={onOpenFinding}
            />
          </motion.div>
        ) : (
          <motion.div
            key="scan"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]"
          >
            {/* Drawn at one size and scaled down on a phone, where the dialog is narrower than
                the orb; the box shrinks with it so no empty band is left underneath. */}
            <div className="flex h-[288px] min-w-0 justify-center sm:h-[360px]">
              {/* A transform does not change the space an element takes, so the box is given the
                  scaled width itself — otherwise the full-size orb widens the dialog on a phone. */}
              <div className="w-[288px] sm:w-[360px]">
                <div className="origin-top-left scale-[0.8] sm:scale-100">
                  <AnalysisOrb tasks={tasks} active={running} />
                </div>
              </div>
            </div>

            {running ? (
              <div role="status" aria-live="polite">
                <div className="mb-3 flex items-baseline justify-between text-xs text-app-text-muted">
                  <span className="font-semibold tracking-wider text-app-brand-text uppercase">
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
                    animate={{ width: `${(finished / tasks.length) * 100}%` }}
                    transition={{ duration: 0.4 }}
                  />
                </span>
                <TaskList tasks={tasks} />
              </div>
            ) : (
              <div className="space-y-4">
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
                    Last run {formatRelativeDate(lastRun.at)} · scored {lastRun.score} of 100
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
