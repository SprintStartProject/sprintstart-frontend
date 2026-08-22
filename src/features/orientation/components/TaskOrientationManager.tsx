import { useEffect, useState } from "react";
import { BookOpen, Loader2, PencilLine } from "lucide-react";
import { Badge } from "../../../components/ui/Badge";
import { useProjectContext } from "../../projects/useProjectContext";
import { OrientationEditor } from "./OrientationEditor";
import { orientationService } from "../../../services/orientationService";
import { starterWorkService } from "../../../services/starterWorkService";
import type { StarterWorkTask } from "../../starter-work/types";
import type { MyOrientation } from "../types";

/**
 * PM/ADMIN surface for authoring a task's orientation by hand.
 *
 * The counterpart to the hire fixing their own task in place: here a PM writes orientation for any
 * approved task, ahead of a hire ever claiming it. Orientation is per-`(task, project)` because the
 * corpus it grounds in is per-project, so a project must be chosen before editing — the approved pool
 * itself is global. A human packet is served as-is and never AI-regenerated.
 */
export function TaskOrientationManager() {
  const { selectedProjectId } = useProjectContext();

  const [tasks, setTasks] = useState<StarterWorkTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{
    task: StarterWorkTask;
    orientation: MyOrientation;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Deferred so the first setState isn't synchronous in the effect body (React 19 lint).
    void (async () => {
      try {
        const approved = await starterWorkService.fetchPool();
        if (!cancelled) setTasks(approved);
      } catch (err) {
        if (!cancelled) {
          setTasksError(err instanceof Error ? err.message : "Could not load approved tasks.");
        }
      } finally {
        if (!cancelled) setTasksLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openEditor = async (task: StarterWorkTask) => {
    if (!selectedProjectId) return;
    setOpeningId(task.id);
    setTasksError(null);
    try {
      const orientation = await orientationService.fetchTaskOrientation(task.id, selectedProjectId);
      setEditing({ task, orientation });
    } catch (err) {
      setTasksError(err instanceof Error ? err.message : "Could not open this orientation.");
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <section data-testid="task-orientation-manager" aria-label="Task orientation">
      <div className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold tracking-tight text-app-text">Task orientation</h2>
          {tasks.length > 0 && (
            <Badge variant="neutral" size="sm" className="tabular-nums">
              {tasks.length}
            </Badge>
          )}
        </div>
        <p className="mt-1 text-sm text-app-text-muted">
          Write the guide for an approved task yourself, or hand it back to the AI. Orientation is
          per project, so pick one first. What you write is served to hires exactly as-is.
        </p>
      </div>

      {tasksError && (
        <p className="mb-3 rounded-xl border border-app-danger-border bg-app-danger-bg p-3 text-xs font-medium text-app-danger-text">
          {tasksError}
        </p>
      )}

      {tasksLoading ? (
        <div className="flex items-center justify-center py-16 text-app-text-muted">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-app-border p-10 text-center">
          <BookOpen className="mx-auto mb-3 h-8 w-8 text-app-text-disabled" aria-hidden="true" />
          <p className="mx-auto max-w-md text-sm text-app-text-muted">
            No approved tasks yet. Approve a starter task above to author its orientation.
          </p>
        </div>
      ) : (
        <ul className="space-y-3" data-testid="approved-task-list">
          {tasks.map((task) => (
            <li
              key={task.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-app-border bg-app-surface px-4 py-3 transition-colors hover:border-app-border-strong"
            >
              <span className="min-w-0 truncate text-sm font-semibold text-app-text">
                {task.title}
              </span>
              <button
                type="button"
                data-testid={`edit-orientation-${task.id}`}
                disabled={!selectedProjectId || openingId !== null}
                onClick={() => void openEditor(task)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-app-border px-3 py-1.5 text-xs font-medium text-app-text transition-colors hover:bg-app-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {openingId === task.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <PencilLine className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                Edit orientation
              </button>
            </li>
          ))}
        </ul>
      )}

      {editing && selectedProjectId && (
        <OrientationEditor
          taskTitle={editing.task.title}
          taskUrl={editing.task.sourceUrl}
          initial={editing.orientation.packet}
          onSave={async (input) => {
            await orientationService.authorTaskOrientation(
              editing.task.id,
              selectedProjectId,
              input,
            );
            return true;
          }}
          onRevert={
            editing.orientation.packet
              ? async () => {
                  await orientationService.revertTaskOrientation(
                    editing.task.id,
                    selectedProjectId,
                  );
                  return true;
                }
              : undefined
          }
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}
