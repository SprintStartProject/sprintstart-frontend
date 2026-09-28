import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Checkbox } from "../../../components/ui/Checkbox";
import { Modal } from "../../../components/ui/Modal";
import { formatRelativeDate } from "../../knowledge-gaps/format";
import { AnalysisMap, type MapSelection } from "./AnalysisMap";
import { AnalysisOrbit } from "./AnalysisOrbit";
import { scoreGlow } from "./analysisMeta";
import { scoreVerdict, type Finding } from "./findings";
import { HealthPanel } from "./HealthPanel";
import { ScanPanel } from "./ScanPanel";
import type {
  AnalysisLogEntry,
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
  /** The live log of the running analysis. */
  log: readonly AnalysisLogEntry[];
  runStartedAt: number | null;
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
  /**
   * "Run again" on the results: back to the choice of what to refresh, the same step a first run
   * starts on — not straight into a run with whatever was ticked last time.
   */
  onRunAgain: () => void;
  /** Opens where a finding can be acted on; the dialog closes first. */
  onOpenFinding: (to: string) => void;
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

function Results({
  findings,
  score,
  resultsAt,
  previousRun,
  projectName,
  onOpenFinding,
  onRunAgain,
}: Pick<
  ProjectAnalysisDialogProps,
  "findings" | "resultsAt" | "previousRun" | "projectName" | "onOpenFinding" | "onRunAgain"
> & { score: number }) {
  // Nothing chosen shows everything at once; an area narrows it.
  const [selected, setSelected] = useState<MapSelection>(null);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 xl:py-4">
        <AnalysisMap
          findings={findings}
          selected={selected}
          onSelect={setSelected}
          onOpenFinding={onOpenFinding}
          score={score}
          scoreAccent={scoreGlow(score)}
          caption={
            <>
              {projectName && (
                <span className="text-sm font-semibold text-app-text">{projectName}</span>
              )}
              <span className="text-xs text-app-text-muted">
                Health · {scoreVerdict(score).toLowerCase()}
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
        onRunAgain={onRunAgain}
      />
    </div>
  );
}

/**
 * The project analysis: choose what to refresh, watch it run, read what it found.
 *
 * Modelled on a node-graph reference where the project is a glowing core in a small universe and
 * everything connects to it by luminous lines — but in the app's own theme and its blue-to-indigo
 * brand gradient, so it reads as part of the dashboard rather than a different product. One dialog through all three stages, so the time between pressing the
 * button and reading the result is spent watching the checks come in rather than on a spinner.
 * Closing it while it runs does not stop the run — the launcher keeps the state.
 */
export function ProjectAnalysisDialog({
  isOpen,
  onClose,
  phase,
  tasks,
  log,
  runStartedAt,
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
  onRunAgain,
  onOpenFinding,
}: ProjectAnalysisDialogProps) {
  const running = phase === "running";
  const done = phase === "done" && score !== null;
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
      // A planet rising along the bottom edge, like the reference: its body a faint wash, its
      // rim lit in the app's blue-to-indigo — and a soft nebula in the top corners. All in the
      // app's own tokens, so it follows the theme instead of forcing a dark ground.
      panelClassName="bg-[radial-gradient(ellipse_70%_42%_at_50%_122%,color-mix(in_oklab,var(--brand)_9%,transparent)_58%,color-mix(in_oklab,var(--progress-fill)_40%,transparent)_65%,color-mix(in_oklab,var(--progress-fill-end)_22%,transparent)_71%,transparent_80%),radial-gradient(ellipse_at_12%_0%,color-mix(in_oklab,var(--brand)_10%,transparent),transparent_55%),radial-gradient(ellipse_at_92%_6%,color-mix(in_oklab,var(--progress-fill-end)_8%,transparent),transparent_50%)]"
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
              onRunAgain={onRunAgain}
            />
          </motion.div>
        ) : (
          <motion.div
            key="scan"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.02, filter: "blur(4px)" }}
            transition={{ duration: 0.35 }}
            className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_26rem]"
          >
            {/* Stays in view beside a tall panel, rather than being centred against it. */}
            <div className="flex min-w-0 justify-center lg:sticky lg:top-0">
              <AnalysisOrbit tasks={tasks} active={running} projectName={projectName} />
            </div>

            {running ? (
              <ScanPanel tasks={tasks} log={log} startedAt={runStartedAt} />
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
