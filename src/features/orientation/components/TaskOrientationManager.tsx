import { useEffect, useMemo, useState } from "react";
import { BookOpen, ChevronRight, Loader2, PencilLine } from "lucide-react";
import { Badge } from "../../../components/ui/Badge";
import { Pagination } from "../../../components/ui/Pagination";
import { useProjectContext } from "../../projects/useProjectContext";
import { OrientationEditor } from "./OrientationEditor";
import { parseCandidateSource, trackerLabel } from "../../starter-work/sourceId";
import { orientationService } from "../../../services/orientationService";
import { starterWorkService } from "../../../services/starterWorkService";
import type { StarterWorkTask } from "../../starter-work/types";
import type { MyOrientation } from "../types";

/** How many task rows sit on one page before the list paginates — matches the issue browser. */
const PAGE_SIZE = 8;
/** Competency keys shown inline on a row before the rest collapse into a "+N" badge. */
const ROW_LABEL_CAP = 3;

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

  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(tasks.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(
    () => tasks.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [tasks, safePage],
  );

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
        <>
          <ul className="space-y-2.5" data-testid="approved-task-list">
            {pageItems.map((task) => {
              const parsed = parseCandidateSource(task.sourceId);
              const trackerCode = task.sourceId.split(":")[0] ?? "";
              const hasKnownTracker =
                trackerCode.toUpperCase() === "GITHUB" || trackerCode.toUpperCase() === "JIRA";
              const showMeta = Boolean(hasKnownTracker || parsed.numberLabel || parsed.repoLabel);
              const shownKeys = task.competencyKeys.slice(0, ROW_LABEL_CAP);
              const extraKeys = task.competencyKeys.length - shownKeys.length;

              return (
                <li key={task.id} className="group relative">
                  {/* A stretched button behind the content, so a click anywhere on the row opens the
                      editor — the same pattern as the issue browser rows. */}
                  <button
                    type="button"
                    data-testid={`edit-orientation-${task.id}`}
                    disabled={!selectedProjectId || openingId !== null}
                    onClick={() => void openEditor(task)}
                    aria-label={`Edit orientation for ${task.title}`}
                    className="absolute inset-0 z-0 rounded-2xl focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none disabled:cursor-not-allowed"
                  />
                  <div
                    className={`pointer-events-none relative z-10 flex items-start gap-3 rounded-2xl border border-app-border bg-app-surface p-4 transition-colors group-hover:border-app-border-strong ${
                      selectedProjectId ? "" : "opacity-60"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-semibold text-app-text">{task.title}</h3>

                      {showMeta && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {hasKnownTracker && (
                            <Badge variant="brand" size="md">
                              {trackerLabel(trackerCode)}
                            </Badge>
                          )}
                          {parsed.numberLabel && (
                            <Badge variant="neutral" size="md">
                              {parsed.numberLabel}
                            </Badge>
                          )}
                          {parsed.repoLabel && (
                            <span className="truncate text-xs text-app-text-subtle">
                              {parsed.repoLabel}
                            </span>
                          )}
                        </div>
                      )}

                      {shownKeys.length > 0 && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {shownKeys.map((key) => (
                            <Badge key={key} variant="neutral" size="md">
                              {key}
                            </Badge>
                          ))}
                          {extraKeys > 0 && (
                            <span className="text-xs text-app-text-subtle">+{extraKeys}</span>
                          )}
                        </div>
                      )}
                    </div>

                    <span className="flex shrink-0 items-center gap-2 self-center text-xs font-medium text-app-text-muted">
                      {openingId === task.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <PencilLine className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      Edit orientation
                      <ChevronRight className="h-4 w-4 text-app-text-disabled" aria-hidden="true" />
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
          <Pagination
            currentPage={safePage}
            totalPages={totalPages}
            onPageChange={setPage}
            className="mt-5"
          />
        </>
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
