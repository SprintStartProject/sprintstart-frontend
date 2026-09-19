import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { SidePanel } from "../../../components/ui/SidePanel";
import { PanelPresence } from "../../../components/ui/PanelPresence";
import { useAuth } from "../../../context/useAuth";
import { useToast } from "../../../context/useToast";
import { queryKeys } from "../../../services/queryKeys";
import { starterWorkService } from "../../../services/starterWorkService";
import { PermissionGroup } from "../../../services/types";
import { StarterWorkAddMenu } from "./StarterWorkAddMenu";
import { StarterWorkTaskDetails } from "./StarterWorkTaskDetails";
import { StarterWorkTriage } from "./StarterWorkTriage";
import { NewStarterTaskModal } from "./NewStarterTaskModal";
import { CorpusIssueBrowser } from "./CorpusIssueBrowser";
import { StarterWorkPoolCloud } from "./StarterWorkPoolCloud";
import { PoolTaskFlight } from "./PoolTaskFlight";
import type { PoolFlightItem, PoolFlightRect } from "./poolFlight";
import { useProjectContext } from "../../projects/useProjectContext";
import { useStarterWorkReview } from "../hooks/useStarterWorkReview";
import { useStarterWorkPool } from "../hooks/useStarterWorkPool";
import type { CreateStarterWorkTaskInput, StarterWorkTask } from "../types";

/**
 * A one-shot instruction for what to do right after landing on this tab, set by the Overview
 * tab's readiness checks. Consumed once — see `onFocusHandled`.
 */
export type StarterWorkFocus = "triage" | "task0" | "closed" | "sync";

type StarterWorkSectionProps = {
  focus?: StarterWorkFocus | null;
  /**
   * Called once `focus` has been acted on (or found to have nothing to act on), so the caller can
   * clear it. Without this, navigating away and back to the Starter work tab — or the section
   * simply re-rendering — would replay the same jump every time.
   */
  onFocusHandled?: () => void;
  /**
   * DOM node to portal "Find with AI" and "Add tasks" into — the First Week page's shared header,
   * top right, instead of this section's own body. Falls back to rendering them inline (used
   * directly in tests, without that header) when omitted or not yet mounted.
   */
  actionsPortalTarget?: HTMLElement | null;
};

function compactToastDetail(value: string, maxLength: number): string {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length <= maxLength ? compact : compact.slice(0, maxLength - 1).trimEnd() + "…";
}

/**
 * Where a PM looks over the starter tasks the corpus produced.
 *
 * A mined task is live and claimable the moment it lands; this lists the ones nobody has vouched
 * for yet. Vouching lifts the demotion fit-ranking applies — it does not admit anything, and
 * nothing here holds a task back from a hire.
 *
 * Removal is the one irreversible action, and it is sticky: mining never brings back a task
 * somebody took out, or they would take it out again after every crawl.
 *
 * HR reads, `ADMIN`/`PM` act, matching the backend's role split.
 */
export function StarterWorkSection({
  focus = null,
  onFocusHandled,
  actionsPortalTarget = null,
}: StarterWorkSectionProps = {}) {
  const { profile } = useAuth();
  const toast = useToast();
  const canAct = profile?.permissionGroup !== PermissionGroup.HR;
  // Loaded here rather than inside the modal so opening the form never waits on a fetch. An
  // empty list degrades to "Any role" only, which is a usable form rather than a broken one.
  const { selectedProjectId } = useProjectContext();
  const {
    tasks,
    isLoading: isReviewLoading,
    isGenerating,
    error,
    generateResult,
    createdTask,
    createdVia,

    generate,
    create,
    notePromoted,
    approve,
    reject,
  } = useStarterWorkReview();

  // The whole pool, shown as-is: every LIVE task is claimable the moment it lands, so there is
  // nothing here to hold back. Reloaded after every decision so it stays in step with the queue.
  const {
    pool,
    isLoading: isPoolLoading,
    error: poolError,
    reload: reloadPool,
  } = useStarterWorkPool();

  // The pool's own "Closed" filter tab, not a separate box under it — reconciliation found these
  // tasks' source issues closed. Fetched unconditionally rather than only while that tab is open,
  // so the tab's count is there to show (or to stay hidden by) as soon as the pool itself has one.
  const { pool: closedPool, isLoading: isClosedPoolLoading } = useStarterWorkPool("STALE");

  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);

  // Brings the pool back in line with its trackers right now, rather than waiting for the next
  // scheduled or event-driven pass. Every affected surface reads from the same three query keys,
  // so invalidating them is what makes the pool, the review queue and the corpus browser agree
  // with what the sync just found -- no separate reload calls to keep in sync with this one.
  //
  // Declared up here, ahead of the other handlers below, so the Overview tab's `"sync"` focus
  // effect can call it without a "used before its declaration" error.
  const handleSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      const outcome = await starterWorkService.reconcile();
      const changes = [
        outcome.markedStale > 0 ? `${outcome.markedStale} closed` : null,
        outcome.revived > 0 ? `${outcome.revived} reopened` : null,
        outcome.assigneeChanged > 0 ? `${outcome.assigneeChanged} reassigned` : null,
      ].filter((part): part is string => part !== null);
      toast.success("Pool synced", {
        description: changes.length > 0 ? changes.join(", ") : "Nothing changed.",
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.starterWork.pool() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.starterWork.review() }),
        // Partial match: catches the corpus query for whichever project is selected, without this
        // component needing to know its id.
        queryClient.invalidateQueries({ queryKey: ["starter-work", "corpus"] }),
      ]);
    } catch (err) {
      toast.error("Sync failed", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setIsSyncing(false);
    }
  }, [queryClient, toast]);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isTriageOpen, setIsTriageOpen] = useState(false);
  const [isIssuesSheetOpen, setIsIssuesSheetOpen] = useState(false);
  // The task whose detail drawer is open, or null. Held as the object so the
  // drawer can animate itself out after the task has left the queue.
  const [selectedTask, setSelectedTask] = useState<StarterWorkTask | null>(null);
  const flightSequence = useRef(0);
  const [poolFlight, setPoolFlight] = useState<PoolFlightItem | null>(null);
  const showErrorToast = toast.error;
  const showInfoToast = toast.info;
  const showSuccessToast = toast.success;
  const showWarningToast = toast.warning;

  useEffect(() => {
    if (!error) return;
    showErrorToast("Action failed", { description: error });
  }, [error, showErrorToast]);

  // Consumes the Overview tab's one-shot jump exactly once, so revisiting this tab later never
  // replays it. `"task0"` and `"closed"` are already acted on above, in the pool's
  // `initialStatusFilter`, so they only need clearing here. `"triage"` has to wait for the
  // unreviewed queue's own fetch first — the triage modal snapshots `tasks` the moment it mounts,
  // and opening it against an empty in-flight list would start it "All caught up". `"sync"` runs
  // the same reconciliation the pool's own "Sync" button does, once, and only for a reader who can
  // act at all — HR would just see it fail.
  const focusHandled = useRef(false);
  useEffect(() => {
    if (!focus || focusHandled.current) return;
    if (focus === "triage" && isReviewLoading) return;

    focusHandled.current = true;
    // Deferred to a microtask so the fetch-gated setState is not synchronous inside the effect
    // body, which `react-hooks/set-state-in-effect` rejects.
    void Promise.resolve().then(() => {
      if (focus === "triage" && tasks.length > 0) setIsTriageOpen(true);
      if (focus === "sync" && canAct) void handleSync();
      onFocusHandled?.();
    });
  }, [focus, isReviewLoading, tasks, canAct, handleSync, onFocusHandled]);

  useEffect(() => {
    if (!createdTask) return;
    // Both land reviewed in the same spot, but "you wrote it" and "you picked it out of the corpus"
    // are different things to have just done, so the confirmation names the one that happened.
    const title = createdVia === "picked" ? "Added to pool" : "Task created";
    showSuccessToast(title, { description: compactToastDetail(createdTask.title, 80) });
  }, [createdTask, createdVia, showSuccessToast]);

  useEffect(() => {
    if (!generateResult) return;
    const count = generateResult.tasksProposed;
    const notes = generateResult.notes.join(" ");
    const description = notes ? compactToastDetail(notes, 160) : undefined;

    if (count === 0) {
      if (description) {
        showWarningToast("No tasks added", { description });
      } else {
        showInfoToast("No tasks found");
      }
      return;
    }

    const message = count === 1 ? "1 task added" : count + " tasks added";
    if (description) showWarningToast(message, { description });
    else showSuccessToast(message);
  }, [generateResult, showInfoToast, showSuccessToast, showWarningToast]);

  const launchPoolFlight = useCallback(
    (task: { title: string; summary?: string | null }, origin?: PoolFlightRect) => {
      if (!origin) return;
      flightSequence.current += 1;
      setPoolFlight({
        id: flightSequence.current,
        title: task.title,
        summary: task.summary,
        origin,
      });
    },
    [],
  );
  const clearPoolFlight = useCallback(() => setPoolFlight(null), []);

  // Clicking a task toggles its drawer: the open one closes, any other opens.
  const toggleSelectedTask = useCallback(
    (task: StarterWorkTask) =>
      setSelectedTask((current) => (current?.id === task.id ? null : task)),
    [],
  );

  // Every decision reports its outcome as a toast, and re-throws on failure so the
  // card or drawer that triggered it can settle back (and the drawer stays open).
  const handleApprove = useCallback(
    async (id: string, origin?: PoolFlightRect) => {
      const approvedTask = tasks.find((task) => task.id === id);
      try {
        await approve(id);
        if (approvedTask) launchPoolFlight(approvedTask, origin);
        void reloadPool();
        toast.success("Review saved");
      } catch (err) {
        toast.error("Review failed", {
          description: err instanceof Error ? err.message : "Please try again.",
        });
        throw err;
      }
    },
    [approve, launchPoolFlight, reloadPool, tasks, toast],
  );

  const handleReject = useCallback(
    async (id: string, reason?: string) => {
      try {
        await reject(id, reason);
        // Preserve content on reload so the pool holds its cards instead of flashing to a spinner,
        // matching approve — both are single decisions that should not blank the whole column.
        void reloadPool();
        toast.success("Removed from pool");
      } catch (err) {
        toast.error("Remove failed", {
          description: err instanceof Error ? err.message : "Please try again.",
        });
        throw err;
      }
    },
    [reject, reloadPool, toast],
  );

  // The triage modal makes its own decisions rapidly, one card at a time — a toast per card would
  // just stack up, so these skip it (the raw hook actions, not `handleApprove`/`handleReject`) and
  // instead reload the pool once the modal closes, via its own `onClose`.
  const handleTriageApprove = useCallback((id: string) => approve(id), [approve]);
  const handleTriageReject = useCallback((id: string) => reject(id), [reject]);
  const closeTriage = useCallback(() => {
    setIsTriageOpen(false);
    void reloadPool();
  }, [reloadPool]);

  // Task 0 is flagged from the drawer, on any pool task; the drawer keeps showing the task it has,
  // so it is updated in place with what the service actually saved rather than an optimistic guess.
  const handleToggleTaskZero = useCallback(
    async (task: StarterWorkTask, eligible: boolean) => {
      try {
        const updated = await starterWorkService.setTaskZero(task.id, eligible);
        setSelectedTask((current) => (current?.id === updated.id ? updated : current));
        void reloadPool();
      } catch (err) {
        toast.error("Could not update Task 0", {
          description: err instanceof Error ? err.message : "Please try again.",
        });
        throw err;
      }
    },
    [reloadPool, toast],
  );

  // Mining needs a selected project; disabled (with a hint) without one.
  const hasProjectForAi = Boolean(selectedProjectId);
  const findWithAiHintId = useId();

  const handleCreate = async (
    input: CreateStarterWorkTaskInput,
    origin?: PoolFlightRect,
  ): Promise<boolean> => {
    setIsCreating(true);
    const ok = await create(input);
    setIsCreating(false);
    if (ok) {
      await reloadPool();
      launchPoolFlight(input, origin);
    }
    return ok;
  };

  const handlePromoted = useCallback(
    async (task: StarterWorkTask, origin?: PoolFlightRect) => {
      notePromoted(task);
      await reloadPool();
      launchPoolFlight(task, origin);
    },
    [launchPoolFlight, notePromoted, reloadPool],
  );

  const actionButtons = (
    <>
      {canAct && (
        <>
          <Button
            variant="secondary"
            data-testid="generate-starter-work"
            icon={<Sparkles className="h-4 w-4" aria-hidden="true" />}
            loading={isGenerating}
            disabled={!hasProjectForAi}
            title={hasProjectForAi ? undefined : "Pick a project first"}
            aria-describedby={hasProjectForAi ? undefined : findWithAiHintId}
            onClick={() => void generate(selectedProjectId)}
          >
            {isGenerating ? "Finding tasks…" : "Find with AI"}
          </Button>
          {!hasProjectForAi && (
            <span id={findWithAiHintId} className="sr-only">
              Pick a project first
            </span>
          )}
        </>
      )}
      <StarterWorkAddMenu
        canAct={canAct}
        onPickFromIssues={() => setIsIssuesSheetOpen(true)}
        onWriteOne={() => setIsCreateOpen(true)}
      />
    </>
  );

  return (
    <div className="space-y-5">
      {actionsPortalTarget ? (
        createPortal(actionButtons, actionsPortalTarget)
      ) : (
        <div className="flex justify-end gap-2">{actionButtons}</div>
      )}

      {tasks.length > 0 && (
        <div
          data-testid="unreviewed-hint"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-app-brand-border bg-app-brand-soft px-5 py-4 text-sm text-app-text"
        >
          <span>
            {tasks.length} {tasks.length === 1 ? "task" : "tasks"} nobody has looked at yet
          </span>
          <Button
            variant="primary"
            size="sm"
            data-testid="open-triage"
            onClick={() => setIsTriageOpen(true)}
          >
            Go through them
          </Button>
        </div>
      )}

      <StarterWorkPoolCloud
        tasks={pool}
        isLoading={isPoolLoading}
        error={poolError}
        canAct={canAct}
        fullWidth
        onSync={() => void handleSync()}
        isSyncing={isSyncing}
        onOpenTask={toggleSelectedTask}
        initialStatusFilter={
          focus === "task0" ? "taskZero" : focus === "closed" ? "closed" : undefined
        }
        closedTasks={closedPool}
        isClosedLoading={isClosedPoolLoading}
      />

      <PanelPresence value={selectedTask}>
        {(task) => (
          <StarterWorkTaskDetails
            task={task}
            projectId={selectedProjectId}
            canAct={canAct}
            onApprove={handleApprove}
            onReject={handleReject}
            onToggleTaskZero={handleToggleTaskZero}
            onClose={() => setSelectedTask(null)}
          />
        )}
      </PanelPresence>

      {isCreateOpen && (
        <NewStarterTaskModal
          isSaving={isCreating}
          onCreate={handleCreate}
          onClose={() => setIsCreateOpen(false)}
        />
      )}

      {isTriageOpen && (
        <StarterWorkTriage
          tasks={tasks}
          onApprove={handleTriageApprove}
          onReject={handleTriageReject}
          onClose={closeTriage}
        />
      )}

      {/* Mounted only while open (and while its slide-out plays), so the corpus is never fetched
          before a PM actually opens the sheet. Page-level, like the task drawer above. */}
      <PanelPresence value={isIssuesSheetOpen ? true : null}>
        {() => (
          <SidePanel
            isOpen={isIssuesSheetOpen}
            onClose={() => setIsIssuesSheetOpen(false)}
            title="Pick from issues"
            showOverlay
            widthClassName="w-full sm:w-[36rem] lg:w-[42rem]"
          >
            <CorpusIssueBrowser
              projectId={selectedProjectId}
              canAct={canAct}
              onPromoted={handlePromoted}
            />
          </SidePanel>
        )}
      </PanelPresence>

      {poolFlight && (
        <PoolTaskFlight key={poolFlight.id} flight={poolFlight} onComplete={clearPoolFlight} />
      )}
    </div>
  );
}
