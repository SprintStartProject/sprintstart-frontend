import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { formatRelativeDate } from "../../knowledge-gaps/format";
import { AnalysisMap, type MapSelection } from "./AnalysisMap";
import { AnalysisOrbit } from "./AnalysisOrbit";
import { scoreGlow } from "./analysisMeta";
import { scoreVerdict, type Finding } from "./findings";
import { HealthPanel } from "./HealthPanel";
import { ScanPanel } from "./ScanPanel";
import type {
  AnalysisComparison,
  AnalysisLogEntry,
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
  /** `null` while nothing is finished, and for a finished run in which a check could not run. */
  score: number | null;
  /** When the results on screen were produced. */
  resultsAt: string | null;
  /** The results on screen could not be stored on the backend. */
  resultsUnsaved?: boolean;
  previousRun: AnalysisComparison | null;
  lastRun: AnalysisRunSummary | null;
  projectName?: string;
  onStart: () => void;
  /** "Run again" on the results: starts a new run straight away — there is nothing to choose. */
  onRunAgain: () => void;
  /** Opens where a finding can be acted on; the dialog closes first. */
  onOpenFinding: (to: string) => void;
};

/** The frosted panel the reference sets its readouts on. */
const glassClassName =
  "rounded-2xl border border-app-border-muted bg-app-surface/60 p-5 backdrop-blur-xl";

function Results({
  findings,
  score,
  tasks,
  resultsAt,
  resultsUnsaved,
  previousRun,
  projectName,
  onOpenFinding,
  onRunAgain,
}: Pick<
  ProjectAnalysisDialogProps,
  | "findings"
  | "score"
  | "tasks"
  | "resultsAt"
  | "resultsUnsaved"
  | "previousRun"
  | "projectName"
  | "onOpenFinding"
  | "onRunAgain"
>) {
  // Nothing chosen shows everything at once; an area narrows it.
  const [selected, setSelected] = useState<MapSelection>(null);
  const failed = tasks.filter((task) => task.status === "failed");

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 xl:py-4">
        <AnalysisMap
          findings={findings}
          selected={selected}
          onSelect={setSelected}
          onOpenFinding={onOpenFinding}
          score={score}
          failedAreas={failed.map((task) => task.id)}
          scoreAccent={score === null ? "var(--warning-text)" : scoreGlow(score)}
          caption={
            <>
              {projectName && (
                <span className="text-sm font-semibold text-app-text">{projectName}</span>
              )}
              <span className="text-xs text-app-text-muted">
                {score === null
                  ? `Incomplete · ${failed.length} ${failed.length === 1 ? "check" : "checks"} could not run`
                  : `Health · ${scoreVerdict(score).toLowerCase()}`}
              </span>
            </>
          }
        />
      </div>
      <HealthPanel
        score={score}
        failedTasks={failed}
        findings={findings}
        analysedAt={resultsAt}
        unsaved={resultsUnsaved}
        previous={previousRun}
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
  resultsUnsaved,
  previousRun,
  lastRun,
  projectName,
  onStart,
  onRunAgain,
  onOpenFinding,
}: ProjectAnalysisDialogProps) {
  const running = phase === "running";
  // Finished, with or without a score: an incomplete run still has results to show.
  const done = phase === "done";
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
          ? score === null
            ? "Some checks could not run, so there is no score this time. Pick an area to see what the others found."
            : "Everything read again, most pressing first. Pick an area to narrow it, and open any card to act on it."
          : running
            ? "Reading every part of the project at once…"
            : "Read everything the dashboard shows in one go, then see what needs you."
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
              tasks={tasks}
              resultsAt={resultsAt}
              resultsUnsaved={resultsUnsaved}
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
                  read again. Nothing is recomputed by the AI — the gaps and the industry already
                  update on their own after every import.
                </p>
                {lastRun && (
                  <p className="text-xs text-app-text-subtle">
                    Last run {formatRelativeDate(lastRun.at)} ·{" "}
                    {lastRun.score === null ? "incomplete, no score" : `${lastRun.score}/100`}
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
