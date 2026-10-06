import { useMemo, useState, type ReactNode } from "react";
import { Check, ChevronDown, ExternalLink, LayoutList, Search, UserCheck } from "lucide-react";
import { Badge } from "../../../components/ui/Badge";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Input } from "../../../components/ui/Input";
import { AskTheBuddy } from "../../buddy/components/AskTheBuddy";
import { GrabTaskButton } from "../../task-pool/components/GrabTaskButton";
import type { TaskType } from "../../starter-work/types";
import { BoardCardFrame } from "./BoardCardFrame";
import type { BoardCard, BoardPoolTask, TaskPoolContent } from "../types";

type TaskPoolCardProps = {
  content: TaskPoolContent;
  card: Pick<BoardCard, "id" | "owner" | "placedAt">;
  onDismiss?: (cardId: string) => void;
  dismissing?: boolean;
};

const TYPE_LABELS: Record<TaskType, string> = {
  BUG: "Bug",
  FEATURE: "Feature",
  DOCS: "Docs",
  TEST: "Tests",
  CHORE: "Chore",
  OTHER: "Other",
};

/**
 * The whole starter-work pool, to browse and grab from by hand.
 *
 * **Browsing is the hire's, help choosing is the buddy's.** "Good next tasks" shows three and the
 * buddy can reason about fit in conversation — but a task you can only reach by asking somebody is
 * a task you cannot simply look for. This card is the direct way in: every live task, in the same
 * fit order the buddy reads, with the same reasons, searchable, filterable, and grabbable here.
 *
 * The buddy stays one press away rather than being the only door: "Help me choose" sits above the
 * list for the hire who does not know where to start, and "Is this a good fit?" sits on every task
 * for the hire who found a candidate and wants a second opinion.
 *
 * The order is the backend's and is never re-sorted here. Filtering hides; it does not re-rank.
 */
export function TaskPoolCard({ content, card, onDismiss, dismissing }: TaskPoolCardProps) {
  const { tasks, currentTaskId } = content;
  // Handed to every grab button, so "Swap … for this?" names the same task the pool marks — even
  // when the current-task card is not on the board to read it from. A current task that is no
  // longer in the live pool leaves it to the button to read the card instead.
  const currentTitle =
    currentTaskId === null ? null : tasks.find((task) => task.taskId === currentTaskId)?.title;
  const [query, setQuery] = useState("");
  const [type, setType] = useState<TaskType | "ALL">("ALL");
  const [hideTaken, setHideTaken] = useState(false);

  const presentTypes = useMemo(
    () =>
      (Object.keys(TYPE_LABELS) as TaskType[]).filter((t) => tasks.some((x) => x.taskType === t)),
    [tasks],
  );
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return tasks.filter((task) => {
      if (type !== "ALL" && task.taskType !== type) return false;
      if (hideTaken && task.sourceHasAssignee === true) return false;
      if (!needle) return true;
      return `${task.title} ${task.summary ?? ""}`.toLowerCase().includes(needle);
    });
  }, [tasks, query, type, hideTaken]);

  return (
    <BoardCardFrame
      icon={LayoutList}
      title="Task pool"
      card={card}
      subtitle={
        tasks.length > 0
          ? `${tasks.length} open ${tasks.length === 1 ? "task" : "tasks"}, best fit first`
          : undefined
      }
      onDismiss={onDismiss}
      dismissing={dismissing}
    >
      {tasks.length === 0 ? (
        <EmptyState size="sm">
          Your PM hasn&apos;t put any starter tasks up for this project yet. Your buddy can still
          suggest something to get going with.
        </EmptyState>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-app-text-muted">
            Pick one yourself — or, if you&apos;re not sure what fits, let your buddy help.
          </p>
          <Input
            size="sm"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tasks"
            aria-label="Search tasks"
            icon={<Search className="h-4 w-4" aria-hidden="true" />}
          />
          <div className="flex flex-wrap items-center gap-1.5">
            <FilterChip active={type === "ALL"} onClick={() => setType("ALL")}>
              All
            </FilterChip>
            {presentTypes.map((t) => (
              <FilterChip key={t} active={type === t} onClick={() => setType(t)}>
                {TYPE_LABELS[t]}
              </FilterChip>
            ))}
            <FilterChip active={hideTaken} onClick={() => setHideTaken((v) => !v)}>
              Hide taken
            </FilterChip>
          </div>

          {visible.length === 0 ? (
            <EmptyState size="sm">No task matches these filters.</EmptyState>
          ) : (
            <ol className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
              {visible.map((task) => (
                <PoolTaskRow
                  key={task.taskId}
                  task={task}
                  isCurrent={task.taskId === currentTaskId}
                  currentTitle={currentTitle}
                />
              ))}
            </ol>
          )}
        </div>
      )}

      <AskTheBuddy
        question="I'm looking through the task pool and I'm not sure which one fits me. Can you help me pick one?"
        label="Not sure? Help me choose"
      />
    </BoardCardFrame>
  );
}

type PoolTaskRowProps = {
  task: BoardPoolTask;
  isCurrent: boolean;
  /** See `GrabTaskButton.currentTitle` — undefined means "not known here". */
  currentTitle: string | null | undefined;
};

function PoolTaskRow({ task, isCurrent, currentTitle }: PoolTaskRowProps) {
  const [expanded, setExpanded] = useState(false);
  const hasMore = Boolean(task.summary || task.rationale) || task.reasons.length > 1;

  return (
    <li
      className={`rounded-xl border p-3 ${
        isCurrent ? "border-app-brand-border bg-app-brand-soft/40" : "border-app-border"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-sm font-medium text-app-text">{task.title}</p>
        {task.url && (
          <a
            href={task.url}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 text-app-text-muted transition hover:text-app-text"
            aria-label={`Open "${task.title}" where it lives`}
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
        )}
      </div>

      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {task.bestFit && (
          <Badge variant="success" size="sm">
            Best fit
          </Badge>
        )}
        {task.taskType !== "OTHER" && (
          <Badge variant="neutral" size="sm">
            {TYPE_LABELS[task.taskType]}
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

      {task.reasons.length > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {(expanded ? task.reasons : task.reasons.slice(0, 1)).map((reason, index) => (
            // By position, not by text: the backend does not promise two reasons never read alike.
            <li key={`${task.taskId}-${index}`} className="text-xs text-app-text-muted">
              · {reason}
            </li>
          ))}
        </ul>
      )}

      {expanded && (task.summary || task.rationale) && (
        <div className="mt-2 space-y-1.5 border-t border-app-border pt-2 text-xs text-app-text-muted">
          {task.summary && <p>{task.summary}</p>}
          {task.rationale && (
            <p>
              <span className="font-medium text-app-text">Why it&apos;s a good first task: </span>
              {task.rationale}
            </p>
          )}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <GrabTaskButton
          taskId={task.taskId}
          title={task.title}
          isCurrent={isCurrent}
          currentTitle={currentTitle}
        />
        <AskTheBuddy
          question={`Is "${task.title}" a good fit for me? What would I need to know before I start?`}
          label="Is this a good fit?"
          className=""
        />
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
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition ${
        active
          ? "border-app-brand-border bg-app-brand-soft text-app-brand-text"
          : "border-app-border text-app-text-muted hover:text-app-text"
      }`}
    >
      {active ? <Check className="h-3 w-3" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
