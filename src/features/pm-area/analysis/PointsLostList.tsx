import { AREA_META, AREA_ORDER, SEVERITY_META, SEVERITY_RANK } from "./analysisMeta";
import { pointsLostByArea, type Finding } from "./findings";

type PointsLostListProps = {
  findings: readonly Finding[];
  /** Makes each area a button, e.g. to open the results it came from. */
  onOpenArea?: () => void;
  /** The list's layout, in place of the default single column — e.g. columns where there is room. */
  className?: string;
};

/**
 * "Where the points went": each area that cost the health score points, most first, with a bar
 * measured against the costliest and coloured by its worst open finding.
 *
 * One component for the analysis's health panel and the overview, so both show the same numbers
 * the same way.
 */
export function PointsLostList({ findings, onOpenArea, className = "" }: PointsLostListProps) {
  const lost = pointsLostByArea(findings);
  const highest = Math.max(1, ...lost.values());

  const areas = AREA_ORDER.filter((area) => lost.has(area))
    .map((area) => {
      const worst = findings
        .filter((finding) => finding.area === area && finding.severity !== "good")
        .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])[0];
      return { area, points: lost.get(area) ?? 0, worst: worst.severity };
    })
    .sort((a, b) => b.points - a.points);

  if (areas.length === 0) {
    return <p className="text-sm text-app-text-muted">Nothing cost a point.</p>;
  }

  return (
    <ul className={className || "space-y-2"}>
      {areas.map(({ area, points, worst }) => {
        const Icon = AREA_META[area].icon;
        const color = SEVERITY_META[worst].glow;
        const row = (
          <>
            <span className="flex min-w-0 items-center gap-1.5 text-xs text-app-text-muted">
              <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{AREA_META[area].label}</span>
            </span>
            <span
              aria-hidden="true"
              className="block h-1.5 overflow-hidden rounded-full bg-app-progress-track"
            >
              <span
                className="block h-full rounded-full"
                style={{
                  width: `${(points / highest) * 100}%`,
                  background: color,
                  boxShadow: `0 0 10px ${color}`,
                }}
              />
            </span>
            <span className="text-xs font-semibold text-app-text tabular-nums">−{points}</span>
          </>
        );
        const rowClassName = "grid w-full grid-cols-[7.5rem_1fr_auto] items-center gap-2.5";

        return (
          <li key={area}>
            {onOpenArea ? (
              <button
                type="button"
                onClick={onOpenArea}
                title={`See what ${AREA_META[area].label.toLowerCase()} found`}
                className={`${rowClassName} -mx-1.5 rounded-lg px-1.5 py-0.5 text-left transition-colors hover:bg-app-surface-hover focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none`}
              >
                {row}
              </button>
            ) : (
              <div className={rowClassName}>{row}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
