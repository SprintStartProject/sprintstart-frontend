import { Info } from "lucide-react";
import { AREA_META, AREA_ORDER, scoreGlow } from "./analysisMeta";
import { AREA_PENALTY, EXTRA_PENALTY, pointsLostByArea, type Finding } from "./findings";

/** The scoring rule in one sentence, for the breakdown's tooltip. */
const RULE = `Starts at 100. Each area loses points for its most serious open finding (critical ${AREA_PENALTY.critical}, needs a look ${AREA_PENALTY.warning}, good to know ${AREA_PENALTY.info}) and ${EXTRA_PENALTY} more for each further open one. Good news costs nothing.`;

type PointsBreakdownProps = {
  score: number;
  findings: readonly Finding[];
  /** Opens the full results, where each area's findings can be read and acted on. */
  onOpen?: () => void;
};

/**
 * "Where the points went" from the last analysis, on the overview: one bar out of 100 — the score
 * in its colour, then each area's lost points in the area's colour — and a chip per area with what
 * it cost.
 *
 * The same numbers as the results' health panel (both come from {@link pointsLostByArea}), so the
 * overview and the analysis cannot disagree. Pressing an area opens those results.
 */
export function PointsBreakdown({ score, findings, onOpen }: PointsBreakdownProps) {
  const lost = pointsLostByArea(findings);
  const areas = AREA_ORDER.filter((area) => lost.has(area))
    .map((area) => ({ area, points: lost.get(area) ?? 0 }))
    .sort((a, b) => b.points - a.points);
  const totalLost = areas.reduce((sum, { points }) => sum + points, 0);
  // The score stops at 0 while the points lost can add up past 100; the bar shares the 100 out
  // between them in proportion then.
  const scale = totalLost + score > 100 ? 100 / (totalLost + score) : 1;

  return (
    <div className="basis-full border-t border-app-brand-border/60 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold tracking-widest text-app-brand-text uppercase">
          Where the points went
          <span title={RULE} className="text-app-text-subtle normal-case">
            <Info aria-hidden="true" className="h-3 w-3" />
            <span className="sr-only">{RULE}</span>
          </span>
        </p>
        <span className="text-xs text-app-text-muted tabular-nums">
          {totalLost === 0 ? "Nothing cost a point" : `${totalLost} points off 100`}
        </span>
      </div>

      <div
        aria-hidden="true"
        className="mt-2 flex h-2 gap-px overflow-hidden rounded-full bg-app-progress-track"
      >
        <span
          className="h-full rounded-l-full"
          style={{ width: `${score * scale}%`, background: scoreGlow(score) }}
        />
        {areas.map(({ area, points }) => (
          <span
            key={area}
            className="h-full opacity-70"
            style={{ width: `${points * scale}%`, background: AREA_META[area].glow }}
          />
        ))}
      </div>

      {areas.length > 0 && (
        <ul className="mt-2.5 flex flex-wrap gap-1.5">
          {areas.map(({ area, points }) => {
            const { icon: Icon, label, chip } = AREA_META[area];
            const content = (
              <>
                <Icon aria-hidden="true" className="h-3.5 w-3.5" />
                {label}
                <span className="font-semibold tabular-nums">−{points}</span>
              </>
            );
            const className = `inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${chip}`;
            return (
              <li key={area}>
                {onOpen ? (
                  <button
                    type="button"
                    onClick={onOpen}
                    title={`See what ${label.toLowerCase()} found`}
                    className={`${className} transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none`}
                  >
                    {content}
                  </button>
                ) : (
                  <span className={className}>{content}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
