import { CircleAlert, Loader2, ScanSearch } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatRelativeDate } from "../../knowledge-gaps/format";
import { useProjectContext } from "../../projects/useProjectContext";
import { RingGauge } from "../components/charts/RingGauge";
import { scoreVerdict } from "./findings";
import { ProjectAnalysisDialog } from "./ProjectAnalysisDialog";
import { useProjectAnalysis } from "./useProjectAnalysis";

/** The ring in the colour of the score's verdict, the same steps as `scoreVerdict`. */
function scoreColor(score: number): string {
  if (score >= 85) return "text-app-success-solid";
  if (score >= 65) return "text-app-brand";
  if (score >= 40) return "text-app-warning-solid";
  return "text-app-danger-solid";
}

type ProjectAnalysisLauncherProps = {
  /**
   * Told after every finished run, so cards outside the shared query cache (the industry card)
   * read their data again. The rest of the overview already updates through the cache.
   */
  onRefreshed?: (revision: number) => void;
};

/**
 * The PM area's way into the project analysis: the project's health as a small ring. Pressing it
 * opens the last run's results in {@link ProjectAnalysisDialog}, or runs the first analysis when
 * there is none; "Run again" there starts a new one.
 * Sits beside the workspace's section tabs.
 *
 * It owns the analysis (see {@link useProjectAnalysis}) rather than the dialog, so a run keeps
 * going with the dialog closed and the ring can say so. The last run's results stay a click away
 * (the ring) — also after a reload and on another device, since they are kept on the backend.
 */
export function ProjectAnalysisLauncher({ onRefreshed }: ProjectAnalysisLauncherProps) {
  const analysis = useProjectAnalysis();
  const { selectedProject } = useProjectContext();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  const { refreshRevision } = analysis;
  useEffect(() => {
    if (refreshRevision > 0) onRefreshed?.(refreshRevision);
  }, [refreshRevision, onRefreshed]);

  const running = analysis.phase === "running";
  // Until the stored history is known, the ring cannot tell "never analysed" from "not read yet".
  const historyLoading = !running && analysis.history === "loading";
  const historyUnavailable = !running && analysis.history === "unavailable";

  const lastRun = analysis.lastRun;
  // What the ring stands for, in words: its accessible name and its tooltip.
  const lastRunSummary = !lastRun
    ? ""
    : lastRun.score === null
      ? `last run ${formatRelativeDate(lastRun.at)} incomplete, ${lastRun.failedChecks} ${
          lastRun.failedChecks === 1 ? "check" : "checks"
        } could not run, no health score`
      : `health ${lastRun.score} of 100, ${scoreVerdict(lastRun.score).toLowerCase()}, last run ${formatRelativeDate(lastRun.at)}`;

  const start = () => {
    setIsOpen(true);
    void analysis.run();
  };

  const openLast = () => {
    if (analysis.phase !== "done") analysis.openLast();
    setIsOpen(true);
  };

  return (
    <>
      {/* Beside the section tabs, on the overview: the project's health as a small ring, the one
          way into the analysis. It opens the last results; with none yet, it runs the first
          analysis. A new run is "Run again" in the results. */}
      <section aria-label="Project analysis" className="flex shrink-0 items-center">
        <button
          type="button"
          disabled={historyLoading}
          onClick={() => {
            if (running) setIsOpen(true);
            else if (analysis.canOpenLast) openLast();
            // The history could not be read: open the dialog and let its button start a run,
            // rather than storing a new one on every press of a ring that never shows them.
            else if (historyUnavailable) setIsOpen(true);
            else start();
          }}
          aria-label={
            running
              ? "Analysing the project — show the analysis"
              : historyLoading
                ? "Loading the project's health"
                : historyUnavailable
                  ? "Project health — the last results could not be loaded"
                  : lastRun && analysis.canOpenLast
                    ? `Open last results: ${lastRunSummary}`
                    : "Analyse project health"
          }
          title={
            running
              ? "Analysing…"
              : historyLoading
                ? "Loading the project's health…"
                : historyUnavailable
                  ? "The last results could not be loaded — open to run an analysis"
                  : lastRun
                    ? `${lastRunSummary} — open the results`
                    : "Project health — run the first analysis"
          }
          data-testid="project-analysis-open"
          className="rounded-full transition-transform enabled:hover:scale-105 disabled:cursor-wait"
        >
          {historyLoading || historyUnavailable ? (
            // Not known yet, or not readable: a quiet empty ring — never "no health score yet",
            // which would claim the project was never analysed.
            <RingGauge
              value={0}
              size={38}
              thickness={4}
              colorClassName="text-app-text-subtle"
              ariaLabel={historyLoading ? "Loading health score" : "Health score unavailable"}
            >
              {historyLoading ? (
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 animate-pulse rounded-full bg-app-text-subtle"
                />
              ) : (
                <CircleAlert aria-hidden="true" className="h-4 w-4 text-app-text-subtle" />
              )}
            </RingGauge>
          ) : running ? (
            <RingGauge
              value={0}
              size={38}
              thickness={4}
              colorClassName="text-app-brand"
              ariaLabel="Analysing the project"
            >
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin text-app-brand-text" />
            </RingGauge>
          ) : !lastRun ? (
            // Never analysed: an empty ring with the scan mark, inviting the first run.
            <RingGauge
              value={0}
              size={38}
              thickness={4}
              colorClassName="text-app-brand"
              ariaLabel="No health score yet"
            >
              <ScanSearch aria-hidden="true" className="h-4 w-4 text-app-brand-text" />
            </RingGauge>
          ) : lastRun.score === null ? (
            // No score to light the ring to: an empty ring with a warning mark, not a number
            // that would count the checks that could not run as clean.
            <RingGauge
              value={0}
              size={38}
              thickness={4}
              colorClassName="text-app-warning-solid"
              ariaLabel="Last run incomplete, no health score"
            >
              <CircleAlert aria-hidden="true" className="h-4 w-4 text-app-warning-text" />
            </RingGauge>
          ) : (
            <RingGauge
              value={lastRun.score}
              size={38}
              thickness={4}
              colorClassName={scoreColor(lastRun.score)}
              ariaLabel={`Last health score ${lastRun.score} of 100`}
            >
              <span className="text-[11px] font-bold text-app-text tabular-nums">
                {lastRun.score}
              </span>
            </RingGauge>
          )}
        </button>
      </section>

      <ProjectAnalysisDialog
        isOpen={isOpen}
        // Closing never stops a run, and keeps a finished one's results for "Open last results".
        onClose={() => setIsOpen(false)}
        phase={analysis.phase}
        tasks={analysis.tasks}
        log={analysis.log}
        runStartedAt={analysis.runStartedAt}
        findings={analysis.findings}
        score={analysis.score}
        resultsAt={analysis.resultsAt}
        resultsUnsaved={analysis.resultsUnsaved}
        previousRun={analysis.previousRun}
        lastRun={lastRun}
        projectName={selectedProject?.name}
        onStart={start}
        onRunAgain={start}
        onOpenFinding={(to) => {
          setIsOpen(false);
          void navigate(to);
        }}
      />
    </>
  );
}
