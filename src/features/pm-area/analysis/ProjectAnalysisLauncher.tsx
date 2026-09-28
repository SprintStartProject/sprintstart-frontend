import { motion, useReducedMotion } from "framer-motion";
import { History, ScanSearch, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../../components/ui/Button";
import { formatRelativeDate } from "../../knowledge-gaps/format";
import { useProjectContext } from "../../projects/useProjectContext";
import { RingGauge } from "../components/charts/RingGauge";
import { scoreVerdict } from "./findings";
import { PointsBreakdown } from "./PointsBreakdown";
import { ProjectAnalysisDialog } from "./ProjectAnalysisDialog";
import {
  DEFAULT_ANALYSIS_OPTIONS,
  useProjectAnalysis,
  type AnalysisOptions,
} from "./useProjectAnalysis";

type ProjectAnalysisLauncherProps = {
  /**
   * Told after every finished run, so cards outside the shared query cache (the industry card)
   * read their data again. The rest of the overview already updates through the cache.
   */
  onRefreshed?: (revision: number) => void;
};

/**
 * The overview's way into the project analysis: one strip at the top with the last run, where its
 * points went ({@link PointsBreakdown}), and the button that starts a new one in
 * {@link ProjectAnalysisDialog}.
 *
 * It owns the analysis (see {@link useProjectAnalysis}) rather than the dialog, so a run keeps
 * going with the dialog closed and the strip can say so. The last run's results stay a click away
 * ("Open last results") — also after a reload, since they are kept in browser storage.
 */
export function ProjectAnalysisLauncher({ onRefreshed }: ProjectAnalysisLauncherProps) {
  const analysis = useProjectAnalysis();
  const { selectedProject } = useProjectContext();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
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
      <section
        aria-label="Project analysis"
        className="relative flex flex-wrap items-center gap-x-4 gap-y-3 overflow-hidden rounded-2xl border border-app-brand-border bg-gradient-to-r from-app-brand-soft via-app-surface to-app-surface px-4 py-3"
      >
        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center">
          {!reduceMotion && (
            <motion.span
              aria-hidden="true"
              className="absolute inset-0 rounded-xl"
              style={{
                background:
                  "conic-gradient(from 0deg, transparent 0deg, color-mix(in oklab, var(--brand) 45%, transparent) 90deg, transparent 180deg)",
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: running ? 1.4 : 6, repeat: Infinity, ease: "linear" }}
            />
          )}
          <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-app-progress-fill to-app-progress-fill-end text-white shadow-sm">
            <ScanSearch aria-hidden="true" className="h-4.5 w-4.5" />
          </span>
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-app-text">Project analysis</p>
          <p className="truncate text-xs text-app-text-muted">
            {running
              ? "Refreshing everything and looking for what needs you…"
              : lastRun
                ? `Last run ${formatRelativeDate(lastRun.at)} · health ${lastRun.score}/100, ${scoreVerdict(lastRun.score).toLowerCase()}`
                : "Refresh everything at once and see what needs you."}
          </p>
        </div>

        {lastRun && !running && (
          <div className="flex items-center gap-2">
            <RingGauge
              value={lastRun.score}
              size={36}
              thickness={4}
              ariaLabel={`Last health score ${lastRun.score} of 100`}
            >
              <span className="text-[11px] font-bold text-app-text tabular-nums">
                {lastRun.score}
              </span>
            </RingGauge>
            {analysis.canOpenLast && (
              <Button
                variant="ghost"
                size="sm"
                onClick={openLast}
                icon={<History className="h-4 w-4" />}
              >
                Open last results
              </Button>
            )}
          </div>
        )}

        <Button
          variant="primary"
          size="sm"
          icon={<Sparkles className="h-4 w-4" />}
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

        {/* The last run's score, explained area by area, right on the overview. */}
        {lastRun && analysis.lastFindings && !running && (
          <PointsBreakdown
            findings={analysis.lastFindings}
            onOpen={analysis.canOpenLast ? openLast : undefined}
          />
        )}
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
