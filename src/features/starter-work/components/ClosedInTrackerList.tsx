import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "../../../components/ui/Badge";
import { Spinner } from "../../../components/ui/Spinner";
import { useStarterWorkPool } from "../hooks/useStarterWorkPool";
import { formatRelativeDate } from "../format";
import { parseCandidateSource, trackerLabel } from "../sourceId";
import type { StarterWorkTask } from "../types";

type ClosedInTrackerListProps = {
  /** Opens the same detail drawer every other pool surface uses. */
  onOpenTask: (task: StarterWorkTask) => void;
};

/**
 * The `STALE` pool, tucked under the live one — reconciliation found these tasks' source issues
 * closed. Not sticky like a rejection: the task returns to the live pool on its own if the issue
 * reopens, so this is a record of what happened rather than a queue with a decision waiting in it.
 *
 * Collapsed by default and fetched only while open — nobody needs "what closed" on every visit to
 * the pool, and the list can only grow.
 */
export function ClosedInTrackerList({ onOpenTask }: ClosedInTrackerListProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { pool: staleTasks, isLoading } = useStarterWorkPool("STALE");

  if (!isLoading && staleTasks.length === 0) return null;

  return (
    <section className="mt-2 rounded-2xl border border-app-border bg-app-surface-muted/40">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        className="flex w-full items-center gap-2 p-4 text-left"
      >
        <span className="text-sm font-semibold text-app-text">Closed in the tracker</span>
        {!isLoading && (
          <Badge variant="neutral" size="sm" className="tabular-nums">
            {staleTasks.length}
          </Badge>
        )}
        <ChevronDown
          className={`ml-auto h-4 w-4 text-app-text-muted transition-transform ${isOpen ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <ul className="space-y-2 px-4 pb-4">
          {isLoading ? (
            <li className="flex items-center gap-2 text-sm text-app-text-muted">
              <Spinner size="sm" silent />
              Loading…
            </li>
          ) : (
            staleTasks.map((task) => (
              <ClosedTaskRow key={task.id} task={task} onOpen={onOpenTask} />
            ))
          )}
        </ul>
      )}
    </section>
  );
}

function ClosedTaskRow({
  task,
  onOpen,
}: {
  task: StarterWorkTask;
  onOpen: (task: StarterWorkTask) => void;
}) {
  const { trackerCode, hasKnownTracker } = parseCandidateSource(task.sourceId);

  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(task)}
        className="flex w-full items-center gap-2 rounded-xl border border-app-border bg-app-surface px-3 py-2 text-left transition-colors hover:border-app-border-strong"
      >
        <span className="min-w-0 flex-1 truncate text-sm text-app-text" title={task.title}>
          {task.title}
        </span>
        {hasKnownTracker && (
          <Badge variant="neutral" size="sm">
            {trackerLabel(trackerCode)}
          </Badge>
        )}
        {task.sourceCheckedAt && (
          <span className="shrink-0 text-xs text-app-text-subtle">
            closed {formatRelativeDate(task.sourceCheckedAt)}
          </span>
        )}
      </button>
    </li>
  );
}
