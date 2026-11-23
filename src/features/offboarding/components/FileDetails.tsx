import { Badge } from "../../../components/ui/Badge";
import type { FileRisk } from "../../../services/offboardingTypes";
import { describeBreakdown, formatDay, percent } from "../format";
import { LEVELS } from "../levels";
import { SourceLinkButtons } from "./SourceLinks";

/** The concrete file that was selected: where it is, how it was left and what the evidence says. */
export function FileDetails({ file }: { file: FileRisk }) {
  const level = LEVELS[file.level];
  const stays = file.remainingKnowers.join(", ");
  return (
    <div
      role="status"
      aria-label="Selected file"
      className="rounded-xl border border-app-border bg-app-surface px-4 py-3"
    >
      <p className="font-mono text-sm break-all text-app-text">{file.path}</p>
      <p className="mt-0.5 text-xs text-app-text-muted">{file.repository}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <Badge variant={level.variant} size="sm">
          {level.label}
        </Badge>
        <span className="text-app-text">Risk {percent(file.score)}</span>
        {stays && <span className="text-app-text-muted">Stays: {stays}</span>}
        <span className="text-app-text-muted">{describeBreakdown(file.sourceBreakdown)}</span>
        <span className="text-app-text-muted">Last changed {formatDay(file.lastChangedAt)}</span>
      </div>
      <div className="mt-2 -ml-1.5">
        <SourceLinkButtons file={file} />
      </div>
    </div>
  );
}
