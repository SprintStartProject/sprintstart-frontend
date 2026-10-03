import { CircleAlert, ScanSearch } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../../components/ui/Button";
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
  /**
   * Bumped from outside to open the analysis with a fresh run — the overview's "+N more". A run
   * already going is shown instead of started again.
   */
  runRequest?: number;
};

/**
 * The PM area's way into the project analysis: the last run's score as a small ring (pressing it
 * opens those results again) and the button that starts a new one in {@link ProjectAnalysisDialog}.
 * Sits beside the workspace's section tabs.
 *
 * It owns the analysis (see {@link useProjectAnalysis}) rather than the dialog, so a run keeps
 * going with the dialog closed and the button can say so. The last run's results stay a click away
 * (the ring) — also after a reload and on another device, since they are kept on the backend.
 */
export function ProjectAnalysisLauncher({
  onRefreshed,
  runRequest = 0,
}: ProjectAnalysisLauncherProps) {
  const analysis = useProjectAnalysis();
  const { selectedProject } = useProjectContext();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  const { refreshRevision } = analysis;
  useEffect(() => {
    if (refreshRevision > 0) onRefreshed?.(refreshRevision);
  }, [refreshRevision, onRefreshed]);

  const running = analysis.phase === "running";

  // Only a change of the request starts a run, not the value it mounts with.
  const handledRequest = useRef(runRequest);
  const { run } = analysis;
  useEffect(() => {
    if (runRequest === handledRequest.current) return;
    handledRequest.current = runRequest;
    setIsOpen(true);
    if (!running) void run();
  }, [runRequest, running, run]);
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
      {/* Beside the section tabs, on the overview: the last score and the way to a new run, in
          one small group. It used to be a full-width strip at the top of the overview. */}
      <section aria-label="Project analysis" className="flex shrink-0 items-center gap-2">
        {lastRun && !running && (
          <button
            type="button"
            onClick={analysis.canOpenLast ? openLast : undefined}
            disabled={!analysis.canOpenLast}
            aria-label={`${analysis.canOpenLast ? "Open last results: " : ""}${lastRunSummary}`}
            title={`${lastRunSummary}${analysis.canOpenLast ? " — open the results" : ""}`}
            className="rounded-full transition-transform focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none enabled:hover:scale-105"
          >
            {lastRun.score === null ? (
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
        )}

        <Button
          variant="primary"
          size="sm"
          icon={<ScanSearch aria-hidden="true" className="h-4 w-4" />}
          loading={running}
          onClick={() => {
            if (running) {
              setIsOpen(true);
              return;
            }
            // The button always starts a new run; the last results have their own way back (the ring).
            start();
          }}
          data-testid="project-analysis-open"
        >
          {running ? "Analysing…" : "Analyse project"}
        </Button>
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
        previousRun={analysis.previousRun}
        lastRun={lastRun}
        projectName={selectedProject?.name}
        onStart={start}
        // Back to the options, as the strip's own button does -- the dialog stays open.
        onRunAgain={start}
        onOpenFinding={(to) => {
          setIsOpen(false);
          void navigate(to);
        }}
      />
    </>
  );
}
