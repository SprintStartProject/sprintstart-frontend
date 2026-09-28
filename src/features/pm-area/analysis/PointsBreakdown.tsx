import { Info } from "lucide-react";
import { AREA_PENALTY, EXTRA_PENALTY, pointsLostByArea, type Finding } from "./findings";
import { PointsLostList } from "./PointsLostList";

/** The scoring rule in one sentence, for the breakdown's tooltip. */
const RULE = `Starts at 100. Each area loses points for its most serious open finding (critical ${AREA_PENALTY.critical}, needs a look ${AREA_PENALTY.warning}, good to know ${AREA_PENALTY.info}) and ${EXTRA_PENALTY} more for each further open one. Good news costs nothing.`;

type PointsBreakdownProps = {
  findings: readonly Finding[];
  /** Opens the full results, where each area's findings can be read and acted on. */
  onOpen?: () => void;
};

/**
 * "Where the points went" from the last analysis, on the overview — drawn as the analysis's own
 * health panel draws it ({@link PointsLostList}), in columns since the strip is wide. Pressing an
 * area opens those results.
 */
export function PointsBreakdown({ findings, onOpen }: PointsBreakdownProps) {
  const totalLost = [...pointsLostByArea(findings).values()].reduce((sum, n) => sum + n, 0);

  return (
    <div className="basis-full border-t border-app-brand-border/60 pt-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold tracking-widest text-app-text-muted uppercase">
          Where the points went
          <span title={RULE} className="text-app-text-subtle normal-case">
            <Info aria-hidden="true" className="h-3 w-3" />
            <span className="sr-only">{RULE}</span>
          </span>
        </p>
        {totalLost > 0 && (
          <span className="text-xs text-app-text-muted tabular-nums">
            {totalLost} points off 100
          </span>
        )}
      </div>
      <PointsLostList
        findings={findings}
        onOpenArea={onOpen}
        className="grid space-y-0 gap-x-8 gap-y-2 sm:grid-cols-2 xl:grid-cols-3"
      />
    </div>
  );
}
