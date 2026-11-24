import { Layers, Shuffle, TrendingUp } from "lucide-react";

import type { FileMovement, SnapshotComparison } from "../../../services/offboardingTypes";
import { PmStat } from "../../pm-area";
import { percent } from "../format";

function rankLabel(rank: number | null): string {
  return rank === null ? "not listed" : `#${rank}`;
}

function MovementRow({ movement }: { movement: FileMovement }) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-app-border px-4 py-2 text-sm first:border-t-0">
      <span className="min-w-0 font-mono break-all text-app-text">{movement.path}</span>
      <span className="shrink-0 text-app-text-muted">
        {rankLabel(movement.leftRank)} → {rankLabel(movement.rightRank)}
      </span>
    </li>
  );
}

/** How two stored rankings agree and which files changed their place most. */
export function ComparisonView({ comparison }: { comparison: SnapshotComparison }) {
  const correlation =
    comparison.rankCorrelation === null ? "n/a" : comparison.rankCorrelation.toFixed(2);
  return (
    <div className="space-y-3" aria-label="Comparison of two risk maps" role="group">
      <div className="grid gap-3 sm:grid-cols-3">
        <PmStat
          icon={Layers}
          label="Top-list overlap"
          value={percent(comparison.topOverlap)}
          hint="of the files in either top list are in both"
          tone="neutral"
        />
        <PmStat
          icon={TrendingUp}
          label="Rank correlation"
          value={correlation}
          hint="Spearman, over the files both list"
          tone="neutral"
        />
        <PmStat
          icon={Shuffle}
          label="Only in one"
          value={`${comparison.onlyLeft} / ${comparison.onlyRight}`}
          hint={`${comparison.both} files are in both`}
          tone="neutral"
        />
      </div>
      {comparison.movements.length > 0 && (
        <ul className="rounded-xl border border-app-border bg-app-surface">
          {comparison.movements.map((movement) => (
            <MovementRow key={`${movement.repository}:${movement.path}`} movement={movement} />
          ))}
        </ul>
      )}
    </div>
  );
}
