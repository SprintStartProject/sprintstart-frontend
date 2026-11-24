import { ChevronRight } from "lucide-react";
import { parseCandidateSource, stripRedundantIssuePrefix } from "../../sourceId";
import { closedLineFor } from "./poolRules";
import { PoolLeadingMarker, PoolTaskBadges, PoolTaskSourceBadge } from "./PoolTaskParts";
import type { PoolTaskProps } from "./poolTypes";

/**
 * Pool task row: a single grouped list stacks these with `divide-y`, so each row only has to lay
 * out its own content — marker, title/summary, then the trailing badges and a chevron. Below `sm`
 * the trailing group wraps under the title instead of staying pinned to the row's right edge.
 */
export function PoolListRow({ task, onOpen, closed = false }: PoolTaskProps) {
  const unseen = !closed && !task.reviewed;
  const description = task.summary?.trim();
  const closedLine = closed ? closedLineFor(task) : null;
  const displayTitle = stripRedundantIssuePrefix(
    task.title,
    parseCandidateSource(task.sourceId).numberLabel,
  );

  return (
    <li
      className={`group relative ${closed ? "opacity-70" : ""}`}
      data-testid={`pool-list-task-${task.id}`}
    >
      <button
        type="button"
        onClick={() => onOpen(task)}
        aria-label={`Open details for ${task.title}`}
        className="absolute inset-0 z-0 focus-ring-inset"
      />

      <div className="pointer-events-none relative z-10 flex flex-col gap-2 p-4 transition-colors group-hover:bg-app-surface-hover sm:flex-row sm:items-center sm:gap-3">
        <div className="flex w-5 shrink-0 items-center justify-center">
          <PoolLeadingMarker closed={closed} unseen={unseen} />
        </div>

        <div className="min-w-0 flex-1">
          <h3
            className={`truncate text-sm text-app-text ${unseen ? "font-semibold" : "font-medium"}`}
            title={task.title}
          >
            {displayTitle}
          </h3>
          {closedLine ? (
            <p className="truncate text-xs text-app-text-subtle">{closedLine}</p>
          ) : (
            description && (
              <p className="truncate text-xs text-app-text-muted" title={description}>
                {description}
              </p>
            )
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 pl-8 sm:flex-nowrap sm:pl-0">
          <PoolTaskBadges task={task} />
          <PoolTaskSourceBadge task={task} />
          <ChevronRight
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-app-text-subtle transition-transform group-hover:translate-x-0.5"
          />
        </div>
      </div>
    </li>
  );
}
