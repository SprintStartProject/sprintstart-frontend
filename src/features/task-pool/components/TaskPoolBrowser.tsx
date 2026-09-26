import { useMemo, useState, type ReactNode } from "react";
import {
  ChevronDown,
  ExternalLink,
  Inbox,
  MessageCircle,
  Search,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { Modal } from "../../../components/ui/Modal";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Input } from "../../../components/ui/Input";
import { SkeletonCard, SkeletonGroup, SkeletonLine } from "../../../components/ui/Skeleton";
import { openAiBuddy } from "../../buddy/aiBuddyBus";
import { useProjectContext } from "../../projects/useProjectContext";
import type { RankedStarterWorkTask, TaskType } from "../../starter-work/types";
import { useCurrentTask, useTaskPoolMatches } from "../hooks/useTaskPool";
import { GrabTaskButton } from "./GrabTaskButton";

type TaskPoolBrowserProps = {
  isOpen: boolean;
  onClose: () => void;
};

const TYPE_LABELS: Record<TaskType, string> = {
  BUG: "Bug",
  FEATURE: "Feature",
  DOCS: "Docs",
  TEST: "Tests",
  CHORE: "Chore",
  OTHER: "Other",
};

/** How many of the top-ranked tasks earn the "best fit" marker. Mirrors the board's three. */
const BEST_FIT_COUNT = 3;

const HELP_ME_CHOOSE =
  "I'm looking through the task pool and I'm not sure which one fits me. Can you help me pick one?";

/**
 * The whole starter-work pool, for a hire picking their own task.
 *
 * **Browsing is the hire's, choosing help is the buddy's.** The board's "Good next tasks" card
 * shows the top three and the buddy can reason about fit in conversation — but a task you can only
 * reach by asking somebody is a task you cannot simply look for. This is the direct way in: every
 * live task, in the same fit order the buddy reads, with the same reasons, searchable and
 * filterable, and grabbable right here.
 *
 * The buddy stays one press away instead of being the only door. "Help me choose" sits at the top,
 * above the list, because the hire who needs it is the one who has not scrolled yet; "Is this a good
 * fit?" sits on every task, for the hire who has found a candidate and wants a second opinion.
 * Both close the dialog first — the buddy opens beside the board, and a question about a task
 * reads better with the board behind it than with a dialog on top.
 *
 * The order is the backend's and is never re-sorted here. Filtering hides; it does not re-rank.
 */
export function TaskPoolBrowser({ isOpen, onClose }: TaskPoolBrowserProps) {
  const { selectedProjectId } = useProjectContext();
  const { data, isLoading, isError, refetch } = useTaskPoolMatches(selectedProjectId, isOpen);
  const current = useCurrentTask(selectedProjectId);

  const [query, setQuery] = useState("");
  const [type, setType] = useState<TaskType | "ALL">("ALL");
  const [hideTaken, setHideTaken] = useState(false);

  const tasks = useMemo(() => data ?? [], [data]);
  const presentTypes = useMemo(
    () =>
      (Object.keys(TYPE_LABELS) as TaskType[]).filter((t) => tasks.some((m) => m.taskType === t)),
    [tasks],
  );
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return tasks.filter((match) => {
      if (type !== "ALL" && match.taskType !== type) return false;
      if (hideTaken && match.task.sourceHasAssignee === true) return false;
      if (!needle) return true;
      return [match.task.title, match.task.summary ?? "", ...match.task.competencyKeys]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [tasks, query, type, hideTaken]);

  const askBuddy = (draft: string) => {
    onClose();
    openAiBuddy({ draft });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title="Browse tasks"
      description="Every open task in your project's pool, best fit for you first. Grab one yourself — or let your buddy help you choose."
      testId="task-pool-browser"
    >
      <div className="space-y-4">
        {/* The buddy's way in, first. Somebody unsure is the person least likely to scroll. */}
        <div className="flex flex-col gap-3 rounded-2xl border border-app-brand-border bg-app-brand-soft p-4 sm:flex-row sm:items-center">
          <Sparkles className="h-5 w-5 shrink-0 text-app-brand-text" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-app-text">Not sure which one fits?</p>
            <p className="text-xs text-app-text-muted">
              Your buddy knows what you&apos;ve shown so far and can pick one with you.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            icon={<MessageCircle className="h-4 w-4" aria-hidden="true" />}
            onClick={() => askBuddy(HELP_ME_CHOOSE)}
          >
            Help me choose
          </Button>
        </div>

        {tasks.length > 0 && (
          <div className="space-y-3">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by title, summary or skill"
              aria-label="Search tasks"
              icon={<Search className="h-4 w-4" aria-hidden="true" />}
            />
            <div className="flex flex-wrap items-center gap-2">
              <FilterChip active={type === "ALL"} onClick={() => setType("ALL")}>
                All
              </FilterChip>
              {presentTypes.map((t) => (
                <FilterChip key={t} active={type === t} onClick={() => setType(t)}>
                  {TYPE_LABELS[t]}
                </FilterChip>
              ))}
              <span className="mx-1 h-4 w-px bg-app-border" aria-hidden="true" />
              <FilterChip active={hideTaken} onClick={() => setHideTaken((v) => !v)}>
                Hide taken
              </FilterChip>
              <span className="ml-auto text-xs text-app-text-muted">
                {visible.length === tasks.length
                  ? `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`
                  : `${visible.length} of ${tasks.length}`}
              </span>
            </div>
          </div>
        )}

        {isLoading ? (
          <SkeletonGroup label="Loading tasks" className="space-y-3">
            {[0, 1, 2].map((i) => (
              <SkeletonCard key={i}>
                <SkeletonLine className="w-2/3" />
                <SkeletonLine className="mt-3 w-1/3" />
              </SkeletonCard>
            ))}
          </SkeletonGroup>
        ) : isError ? (
          <EmptyState
            size="sm"
            action={
              <Button variant="secondary" size="sm" onClick={() => void refetch()}>
                Try again
              </Button>
            }
          >
            The task pool couldn&apos;t be loaded.
          </EmptyState>
        ) : tasks.length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-8 w-8 text-app-text-disabled" aria-hidden="true" />}
            title="The pool is empty right now"
          >
            Your PM hasn&apos;t put any starter tasks up for this project yet. Your buddy can still
            suggest something to get going with.
          </EmptyState>
        ) : visible.length === 0 ? (
          <EmptyState size="sm">No task matches these filters.</EmptyState>
        ) : (
          <ol className="space-y-3">
            {visible.map((match) => (
              <TaskRow
                key={match.task.id}
                match={match}
                bestFit={tasks.indexOf(match) < BEST_FIT_COUNT && match.score > 0}
                isCurrent={current?.taskId === match.task.id}
                onGrabbed={onClose}
                onAsk={() =>
                  askBuddy(
                    `Is "${match.task.title}" a good fit for me? What would I need to know before I start?`,
                  )
                }
              />
            ))}
          </ol>
        )}
      </div>
    </Modal>
  );
}

type TaskRowProps = {
  match: RankedStarterWorkTask;
  bestFit: boolean;
  isCurrent: boolean;
  onGrabbed: () => void;
  onAsk: () => void;
};

function TaskRow({ match, bestFit, isCurrent, onGrabbed, onAsk }: TaskRowProps) {
  const { task, reasons, taskType } = match;
  const [expanded, setExpanded] = useState(false);
  const hasMore = Boolean(task.summary || task.rationale) || reasons.length > 2;

  return (
    <li
      className={`rounded-2xl border p-4 ${
        isCurrent
          ? "border-app-brand-border bg-app-brand-soft/40"
          : "border-app-border bg-app-surface"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-sm font-medium text-app-text">{task.title}</p>
        {task.sourceUrl && (
          <a
            href={task.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 text-app-text-muted transition hover:text-app-text"
            aria-label={`Open "${task.title}" where it lives`}
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {isCurrent && (
          <Badge variant="brand" size="sm">
            Your current task
          </Badge>
        )}
        {bestFit && (
          <Badge variant="success" size="sm">
            Best fit
          </Badge>
        )}
        {taskType !== "OTHER" && (
          <Badge variant="neutral" size="sm">
            {TYPE_LABELS[taskType]}
          </Badge>
        )}
        {task.sourceHasAssignee === true && (
          <Badge
            variant="warning"
            size="sm"
            title="The tracker shows somebody assigned. You can still grab it — check with them first."
          >
            <UserCheck className="mr-1 inline h-3 w-3" aria-hidden="true" />
            Someone may be on this
          </Badge>
        )}
      </div>

      {reasons.length > 0 ? (
        <ul className="mt-2 space-y-0.5">
          {(expanded ? reasons : reasons.slice(0, 2)).map((reason) => (
            <li key={reason} className="text-xs text-app-text-muted">
              · {reason}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-app-text-muted">
          · Nothing you&apos;ve shown so far points at this one — which doesn&apos;t rule it out.
        </p>
      )}

      {expanded && (
        <div className="mt-3 space-y-2 border-t border-app-border pt-3 text-sm text-app-text-muted">
          {task.summary && <p>{task.summary}</p>}
          {task.rationale && (
            <p className="text-xs">
              <span className="font-medium text-app-text">Why it&apos;s a good first task: </span>
              {task.rationale}
            </p>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <GrabTaskButton taskId={task.id} title={task.title} onGrabbed={onGrabbed} />
        <button
          type="button"
          onClick={onAsk}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-app-brand-text transition hover:underline"
        >
          <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
          Is this a good fit?
        </button>
        {hasMore && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-app-text-muted transition hover:text-app-text"
          >
            {expanded ? "Less" : "More"}
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>
        )}
      </div>
    </li>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
        active
          ? "border-app-brand-border bg-app-brand-soft text-app-brand-text"
          : "border-app-border text-app-text-muted hover:text-app-text"
      }`}
    >
      {children}
    </button>
  );
}
