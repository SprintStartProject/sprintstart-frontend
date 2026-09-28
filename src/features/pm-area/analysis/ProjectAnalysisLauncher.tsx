import { ScanSearch } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../../components/ui/Button";
import { formatRelativeDate } from "../../knowledge-gaps/format";
import { useProjectContext } from "../../projects/useProjectContext";
import { RingGauge } from "../components/charts/RingGauge";
import { scoreVerdict } from "./findings";
import { ProjectAnalysisDialog } from "./ProjectAnalysisDialog";
import {
  DEFAULT_ANALYSIS_OPTIONS,
  useProjectAnalysis,
  type AnalysisOptions,
} from "./useProjectAnalysis";

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
 * The PM area's way into the project analysis: the last run's score as a small ring (pressing it
 * opens those results again) and the button that starts a new one in {@link ProjectAnalysisDialog}.
 * Sits beside the workspace's section tabs.
 *
 * It owns the analysis (see {@link useProjectAnalysis}) rather than the dialog, so a run keeps
 * going with the dialog closed and the button can say so. The last run's results stay a click away
 * (the ring) — also after a reload, since they are kept in browser storage.
 */
export function ProjectAnalysisLauncher({ onRefreshed }: ProjectAnalysisLauncherProps) {
  const analysis = useProjectAnalysis();
  const { selectedProject } = useProjectContext();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<AnalysisOptions>(DEFAULT_ANALYSIS_OPTIONS);

  const { refreshRevision } = analysis;
  useEffect(() => {
    if (refreshRevision > 0) onRefreshed?.(refreshRevision);
  }, [refreshRevision, onRefreshed]);

  const running = analysis.phase === "running";
  const lastRun = analysis.lastRun;

  const start = () => {
    setIsOpen(true);
    void analysis.run(options);
  };

  const openLast = () => {
    if (analysis.phase !== "done") analysis.openLast();
    setIsOpen(true);
  };

  return (
    <>
      {/* Beside the section tabs, on every PM section: the last score and the way to a new run,
          in one small group. It used to be a full-width strip at the top of the overview only. */}
      <section aria-label="Project analysis" className="flex shrink-0 items-center gap-2">
        {lastRun && !running && (
          <button
            type="button"
            onClick={analysis.canOpenLast ? openLast : undefined}
            disabled={!analysis.canOpenLast}
            aria-label={`${analysis.canOpenLast ? "Open last results: " : ""}health ${lastRun.score} of 100, ${scoreVerdict(lastRun.score).toLowerCase()}, last run ${formatRelativeDate(lastRun.at)}`}
            title={`Last run ${formatRelativeDate(lastRun.at)} · health ${lastRun.score}/100, ${scoreVerdict(lastRun.score).toLowerCase()}${analysis.canOpenLast ? " — open the results" : ""}`}
            className="rounded-full transition-transform focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none enabled:hover:scale-105"
          >
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
            // The button always leads to a new run; the last results have their own way back.
            analysis.reset();
            setIsOpen(true);
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
        canEvaluateIndustry={analysis.canEvaluateIndustry}
        options={options}
        onOptionsChange={setOptions}
        onStart={start}
        // Back to the options, as the strip's own button does -- the dialog stays open.
        onRunAgain={analysis.reset}
        onOpenFinding={(to) => {
          setIsOpen(false);
          void navigate(to);
        }}
      />
    </>
  );
}
