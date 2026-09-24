import { motion, useReducedMotion } from "framer-motion";
import { ScanSearch, Sparkles } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../../components/ui/Button";
import { formatRelativeDate } from "../../knowledge-gaps/format";
import { RingGauge } from "../components/charts/RingGauge";
import { scoreVerdict } from "./findings";
import { ProjectAnalysisDialog } from "./ProjectAnalysisDialog";
import {
  DEFAULT_ANALYSIS_OPTIONS,
  useProjectAnalysis,
  type AnalysisOptions,
} from "./useProjectAnalysis";

/** The last score — a button back to its results while they are still in this session. */
function LastScore({ onOpen, children }: { onOpen?: () => void; children: ReactNode }) {
  const className = "flex items-center gap-2 rounded-xl px-2 py-1 text-left";

  if (!onOpen) return <div className={className}>{children}</div>;

  return (
    <button
      type="button"
      onClick={onOpen}
      title="Open the results"
      className={`${className} transition-colors hover:bg-app-surface-hover focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none`}
    >
      {children}
    </button>
  );
}

type ProjectAnalysisLauncherProps = {
  /** Told when the analysis re-evaluated the industry, so the industry card reads it again. */
  onIndustryChanged?: (revision: number) => void;
};

/**
 * The overview's way into the project analysis: one slim strip at the top with the last score,
 * and the button that opens {@link ProjectAnalysisDialog}.
 *
 * It owns the analysis (see {@link useProjectAnalysis}) rather than the dialog, so a run keeps
 * going with the dialog closed and the strip can say so.
 */
export function ProjectAnalysisLauncher({ onIndustryChanged }: ProjectAnalysisLauncherProps) {
  const analysis = useProjectAnalysis();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<AnalysisOptions>(DEFAULT_ANALYSIS_OPTIONS);

  const { industryRevision } = analysis;
  useEffect(() => {
    if (industryRevision > 0) onIndustryChanged?.(industryRevision);
  }, [industryRevision, onIndustryChanged]);

  const running = analysis.phase === "running";
  const lastRun = analysis.lastRun;

  const start = () => {
    setIsOpen(true);
    void analysis.run(options);
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
                ? `Last run ${formatRelativeDate(lastRun.at)} · ${scoreVerdict(lastRun.score).toLowerCase()}`
                : "Refresh everything at once and get one list of what needs you."}
          </p>
        </div>

        {lastRun && !running && (
          <LastScore onOpen={analysis.phase === "done" ? () => setIsOpen(true) : undefined}>
            <RingGauge
              value={lastRun.score}
              size={36}
              thickness={4}
              ariaLabel={`Last score ${lastRun.score} of 100`}
            >
              <span className="text-[11px] font-bold text-app-text tabular-nums">
                {lastRun.score}
              </span>
            </RingGauge>
            <span className="hidden text-xs text-app-text-muted sm:block">
              {lastRun.counts.critical + lastRun.counts.warning} to look at
            </span>
          </LastScore>
        )}

        <Button
          variant="primary"
          size="sm"
          icon={<Sparkles className="h-4 w-4" />}
          loading={running}
          onClick={() => {
            // A finished run's results stay reachable through the score beside this button;
            // the button itself always leads to a new run.
            if (analysis.phase === "done") analysis.reset();
            setIsOpen(true);
          }}
          data-testid="project-analysis-open"
        >
          {running ? "Analysing…" : "Analyse project"}
        </Button>
      </section>

      <ProjectAnalysisDialog
        isOpen={isOpen}
        // Closing never stops a run, and keeps a finished one's results for the score to reopen.
        onClose={() => setIsOpen(false)}
        phase={analysis.phase}
        tasks={analysis.tasks}
        findings={analysis.findings}
        score={analysis.score}
        previousRun={analysis.previousRun}
        lastRun={lastRun}
        canEvaluateIndustry={analysis.canEvaluateIndustry}
        options={options}
        onOptionsChange={setOptions}
        onStart={start}
        onOpenFinding={(to) => {
          setIsOpen(false);
          void navigate(to);
        }}
      />
    </>
  );
}
