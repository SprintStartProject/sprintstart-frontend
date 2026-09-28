import { animate, useReducedMotion } from "framer-motion";
import { RotateCcw, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { formatRelativeDate } from "../../knowledge-gaps/format";
import { SEVERITY_META, scoreGlow } from "./analysisMeta";
import { countBySeverity, scoreVerdict, type Finding, type FindingSeverity } from "./findings";
import { PointsLostList } from "./PointsLostList";

/** Counts up to the score once, the way the reference's figures roll in. */
function CountUp({ value }: { value: number }) {
  const reduceMotion = useReducedMotion();
  const [shown, setShown] = useState(reduceMotion ? value : 0);

  useEffect(() => {
    if (reduceMotion) return;
    const controls = animate(0, value, {
      duration: 1.1,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => setShown(Math.round(latest)),
    });
    return () => controls.stop();
  }, [reduceMotion, value]);

  return <>{reduceMotion ? value : shown}</>;
}

type HealthPanelProps = {
  score: number;
  findings: readonly Finding[];
  /** When the results were produced. */
  analysedAt: string | null;
  previous: { at: string; score: number } | null;
  onRunAgain: () => void;
};

/**
 * The right-hand side of the results: the health score, what it means, and where its points went.
 *
 * "55/100" alone said nothing — 55 of what? So the score comes with its reading ("Needs your
 * attention"), one line on the scale (100 is nothing open), and the areas that cost it points, each
 * with its share. Every point off traces to a finding on the map beside it.
 */
export function HealthPanel({
  score,
  findings,
  analysedAt,
  previous,
  onRunAgain,
}: HealthPanelProps) {
  const counts = countBySeverity(findings);
  const delta = previous ? score - previous.score : null;
  const glow = scoreGlow(score);

  return (
    <aside
      aria-label="Project health"
      // Its own height, and in view while the map beside it scrolls.
      className="flex flex-col gap-5 self-start rounded-2xl border border-app-border-muted bg-app-surface/60 p-5 backdrop-blur-xl xl:sticky xl:top-0"
    >
      <div>
        <p className="text-[10px] font-semibold tracking-widest text-app-text-muted uppercase">
          Project health
        </p>
        <div className="mt-2 flex items-end gap-2">
          <span
            className="text-6xl leading-none font-bold text-app-text"
            style={{ textShadow: `0 0 28px ${glow}` }}
          >
            <CountUp value={score} />
          </span>
          <span className="pb-1.5 text-lg font-semibold text-app-text-muted">/ 100</span>
          <span
            className="mb-2 ml-auto rounded-full px-2.5 py-1 text-xs font-semibold text-app-text"
            style={{
              background: `color-mix(in oklab, ${glow} 18%, transparent)`,
              boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${glow} 45%, transparent)`,
            }}
          >
            {scoreVerdict(score)}
          </span>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-app-text-muted">
          How much the project needs you right now: <strong className="text-app-text">100</strong>{" "}
          means nothing is open. Each area loses points for its most serious open finding, and one
          more for each further one.
        </p>
        {delta !== null && previous && (
          <p
            className={`mt-2 inline-flex items-center gap-1 text-xs ${
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
            {formatRelativeDate(previous.at)}
          </p>
        )}
      </div>

      <div>
        <p className="mb-2 text-[10px] font-semibold tracking-widest text-app-text-muted uppercase">
          Where the points went
        </p>
        <PointsLostList findings={findings} />
      </div>

      <ul className="grid grid-cols-2 gap-2">
        {(["critical", "warning", "info", "good"] as FindingSeverity[]).map((severity) => {
          const meta = SEVERITY_META[severity];
          const Icon = meta.icon;
          return (
            <li key={severity} className="rounded-xl bg-app-surface-muted/70 px-3 py-2.5">
              <span className="flex items-center gap-1.5 text-[11px] text-app-text-muted">
                <Icon aria-hidden="true" className={`h-3.5 w-3.5 ${meta.text}`} />
                {meta.label}
              </span>
              <span className="mt-1 block text-xl leading-none font-bold text-app-text tabular-nums">
                {counts[severity]}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto space-y-2">
        <Button
          variant="primary"
          className="w-full"
          onClick={onRunAgain}
          icon={<RotateCcw className="h-4 w-4" />}
        >
          Run again
        </Button>
        {analysedAt && (
          <p className="text-center text-[11px] text-app-text-subtle">
            Analysed {formatRelativeDate(analysedAt)}
          </p>
        )}
      </div>
    </aside>
  );
}
