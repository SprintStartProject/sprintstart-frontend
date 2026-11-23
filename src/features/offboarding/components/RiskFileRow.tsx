import { Badge } from "../../../components/ui/Badge";
import type { FileRisk } from "../../../services/offboardingTypes";
import { describeBreakdown, percent } from "../format";
import { LEVELS } from "../levels";
import { SourceLinkIcon } from "./SourceLinks";

function ScoreBar({ score }: { score: number }) {
  return (
    <div
      role="meter"
      aria-label="Risk score"
      aria-valuemin={0}
      aria-valuemax={1}
      aria-valuenow={score}
      aria-valuetext={percent(score)}
      className="h-1.5 w-24 overflow-hidden rounded-full bg-app-border"
    >
      <div className="h-full rounded-full bg-app-danger-solid" style={{ width: percent(score) }} />
    </div>
  );
}

/** One file at risk: where it is, how it was left, how much it matters and who still knows it. */
export function RiskFileRow({ file }: { file: FileRisk }) {
  const level = LEVELS[file.level];
  const stays = file.remainingKnowers.join(", ");
  return (
    <li className="flex flex-col gap-2 border-b border-app-border px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-sm text-app-text" title={file.path}>
          {file.path}
        </p>
        <p className="truncate text-xs text-app-text-muted">
          {file.repository}
          {stays ? ` · stays: ${stays}` : ""}
        </p>
      </div>
      <p className="text-xs text-app-text-muted sm:w-52">
        {describeBreakdown(file.sourceBreakdown)}
      </p>
      <div className="flex items-center gap-3 sm:w-72 sm:justify-end">
        <Badge variant={level.variant} size="sm" className="whitespace-nowrap">
          {level.label}
        </Badge>
        <ScoreBar score={file.score} />
        <span className="w-10 text-right text-sm font-medium text-app-text">
          {percent(file.score)}
        </span>
        <SourceLinkIcon file={file} />
      </div>
    </li>
  );
}
