import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Sparkles, Target } from "lucide-react";
import { PageHeader } from "../../../components/layout/PageHeader";
import { Badge } from "../../../components/ui/Badge";
import { SegmentedTabs, type SegmentedTabOption } from "../../../components/ui/SegmentedTabs";
import { InfoHint } from "../../../components/ui/InfoHint";
import { SlidingTabPanel } from "../../../components/ui/SlidingTabPanel";
import { PanelPresence } from "../../../components/ui/PanelPresence";
import { useAuth } from "../../../context/useAuth";
import { useToast } from "../../../context/useToast";
import { queryKeys } from "../../../services/queryKeys";
import { starterWorkService } from "../../../services/starterWorkService";
import { PermissionGroup } from "../../../services/types";
import { StarterWorkTaskCard } from "./StarterWorkTaskCard";
import { StarterWorkTaskDetails } from "./StarterWorkTaskDetails";
import { NewStarterTaskModal } from "./NewStarterTaskModal";
import { CorpusIssueBrowser } from "./CorpusIssueBrowser";
import { StarterWorkPoolCloud } from "./StarterWorkPoolCloud";
import { PoolTaskFlight } from "./PoolTaskFlight";
import type { PoolFlightItem, PoolFlightRect } from "./poolFlight";
import { useProjectContext } from "../../projects/useProjectContext";
import { useStarterWorkReview } from "../hooks/useStarterWorkReview";
import { useStarterWorkPool } from "../hooks/useStarterWorkPool";
import { useSwipeableTabs } from "../../../hooks/useHorizontalWheelNavigation";
import { useDelayedFlag } from "../../../hooks/useDelayedFlag";
import { SkeletonGroup, SkeletonLine } from "../../../components/ui/Skeleton";
import type { CreateStarterWorkTaskInput, StarterWorkTask } from "../types";

/**
 * The sections this page holds, and the order they sit in the section filter.
 *
 * `overview` is the dashboard: it shows every section at once. The others narrow to one of the
 * sections the overview stacks up, mirroring the Data Ingestion page. There is no orientation
 * section any more: a task's orientation is authored inline from its pool card.
 */
type StarterWorkSection = "overview" | "review" | "pool" | "browse";

const SECTION_LABELS: Record<StarterWorkSection, string> = {
  overview: "Overview",
  review: "Review",
  pool: "Pool",
  browse: "Issues",
};

const SECTION_ORDER: StarterWorkSection[] = ["overview", "review", "pool", "browse"];

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
export function StarterWorkSection() {
  const { profile } = useAuth();
  const toast = useToast();
  const canAct = profile?.permissionGroup !== PermissionGroup.HR;
  // Loaded here rather than inside the modal so opening the form never waits on a fetch. An
  // empty list degrades to "Any role" only, which is a usable form rather than a broken one.
  const { selectedProjectId } = useProjectContext();
  const {
    tasks,
    isLoading,
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
  // The backend pool response carries no per-task "reviewed" flag, so which pool tasks nobody has
  // looked at yet is read by cross-referencing the unreviewed queue's ids instead — and reviewing
  // one drops it from that queue, which is exactly what marks it seen here too.
  const unseenIds = useMemo(() => new Set(tasks.map((task) => task.id)), [tasks]);

  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [activeSection, setActiveSection] = useState<StarterWorkSection>("overview");
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
      setActiveSection("overview");
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

  // Brings the pool back in line with its trackers right now, rather than waiting for the next
  // scheduled or event-driven pass. Every affected surface reads from the same three query keys,
  // so invalidating them is what makes the pool, the review queue and the corpus browser agree
  // with what the sync just found -- no separate reload calls to keep in sync with this one.
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

  // Two-finger swipe between the sections, matching the Data Ingestion page. Every section is
  // readable by every role now, so the order is fixed rather than built from the role.
  const swipeRef = useSwipeableTabs<StarterWorkSection, HTMLElement>({
    order: SECTION_ORDER,
    value: activeSection,
    onChange: setActiveSection,
  });

  const tabOptions: SegmentedTabOption<StarterWorkSection>[] = SECTION_ORDER.map((key) => ({
    value: key,
    label: SECTION_LABELS[key],
    // The review queue and the pool each carry a page-level count; the other sections own their own
    // data, so their tabs stay countless rather than showing a wrong number.
    count: key === "review" ? tasks.length : key === "pool" ? pool.length : undefined,
  }));

  const showOverview = activeSection === "overview";
  const showReviewTab = activeSection === "review";
  const showPoolTab = activeSection === "pool";
  const showBrowse = activeSection === "overview" || activeSection === "browse";

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

  return (
    <div className="min-h-screen">
      <header className="border-b border-app-border bg-app-bg/90 backdrop-blur-xl">
        <div className="app-page-frame py-6">
          <PageHeader
            icon={Target}
            title="Starter Work"
            subtitle="First tasks mined from your corpus, ready for new hires to pick up. Reviewing one lifts it up the list."
            actions={
              <div className="flex flex-wrap items-center gap-2">
                {canAct && (
                  <button
                    type="button"
                    data-testid="add-starter-task"
                    onClick={() => setIsCreateOpen(true)}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-app-border px-5 text-sm font-medium text-app-text transition-colors hover:bg-app-surface-hover"
                  >
                    <Plus className="h-4 w-4" />
                    Add a task
                  </button>
                )}
                <button
                  type="button"
                  data-testid="generate-starter-work"
                  onClick={() => void generate(selectedProjectId)}
                  disabled={isGenerating || !selectedProjectId}
                  title={!selectedProjectId ? "Pick a project first" : undefined}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-app-brand px-5 text-sm font-medium text-white shadow-app-brand-lift transition-colors hover:bg-app-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {isGenerating ? "Mining..." : "Find starter tasks"}
                </button>
              </div>
            }
          />
        </div>
      </header>

      <main ref={swipeRef} className="app-page-frame space-y-5 py-6 lg:py-8">
        <SegmentedTabs
          value={activeSection}
          options={tabOptions}
          onChange={setActiveSection}
          layoutId="starter-work-section-pill"
          ariaLabel="Filter sections"
        />

        <SlidingTabPanel
          activeKey={activeSection}
          index={SECTION_ORDER.indexOf(activeSection)}
          className="space-y-8"
        >
          {showOverview && (
            <>
              {tasks.length > 0 && (
                <div
                  data-testid="unreviewed-hint"
                  className="rounded-2xl border border-app-border bg-app-surface px-5 py-4 text-sm text-app-text"
                >
                  {tasks.length} {tasks.length === 1 ? "task" : "tasks"} nobody has looked at yet
                </div>
              )}

              <StarterWorkPoolCloud
                tasks={pool}
                unseenIds={unseenIds}
                isLoading={isPoolLoading}
                error={poolError}
                canAct={canAct}
                fullWidth
                onSync={() => void handleSync()}
                isSyncing={isSyncing}
              />
            </>
          )}

          {showReviewTab && (
            <ReviewQueue
              tasks={tasks}
              isLoading={isLoading}
              canAct={canAct}
              selectedTaskId={selectedTask?.id ?? null}
              onToggle={toggleSelectedTask}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          )}

          {/* The picker beside the blank form: the same action with a better input than an
              empty box. HR reads it, matching the rest of the page. It is a second way to
              add work, never a filter in front of mining — the pool above stays live. */}
          {showBrowse && (
            <CorpusIssueBrowser
              projectId={selectedProjectId}
              canAct={canAct}
              onPromoted={handlePromoted}
            />
          )}

          {/* The pool on its own, the same surface the overview shows above. PM/ADMIN edit a
              task's orientation inline from its card here; HR reads it. */}
          {showPoolTab && (
            <StarterWorkPoolCloud
              tasks={pool}
              unseenIds={unseenIds}
              isLoading={isPoolLoading}
              error={poolError}
              canAct={canAct}
              fullWidth
              onSync={() => void handleSync()}
              isSyncing={isSyncing}
            />
          )}
        </SlidingTabPanel>
      </main>

      <PanelPresence value={selectedTask}>
        {(task) => (
          <StarterWorkTaskDetails
            task={task}
            canAct={canAct}
            onApprove={handleApprove}
            onReject={handleReject}
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

      {poolFlight && (
        <PoolTaskFlight key={poolFlight.id} flight={poolFlight} onComplete={clearPoolFlight} />
      )}
    </div>
  );
}

/** Placeholder for one `StarterWorkTaskCard`, matching its title, summary and meta-badge rows. */
function StarterWorkTaskCardSkeleton() {
  return (
    <div className="rounded-2xl border border-app-border bg-app-surface p-4">
      <SkeletonLine className="w-3/4" />
      <SkeletonLine className="mt-2 w-1/2" />
      <SkeletonLine className="mt-2 h-5 w-20" />
    </div>
  );
}

/** The review queue shared by the overview column and its full-width tab. */
function ReviewQueue({
  tasks,
  isLoading,
  canAct,
  selectedTaskId,
  onToggle,
  onApprove,
  onReject,
}: {
  tasks: StarterWorkTask[];
  isLoading: boolean;
  canAct: boolean;
  selectedTaskId: string | null;
  onToggle: (task: StarterWorkTask) => void;
  onApprove: (id: string, origin?: PoolFlightRect) => Promise<void>;
  onReject: (id: string, reason?: string) => Promise<void>;
}) {
  const showLoadingSkeleton = useDelayedFlag(isLoading);

  return (
    <section aria-label="Awaiting your review">
      <SectionHeading
        title="Awaiting your review"
        description="Vouch to lift a task's rank. Removal is permanent."
        count={tasks.length}
      />
      {showLoadingSkeleton ? (
        <SkeletonGroup label="Loading tasks awaiting review" className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <StarterWorkTaskCardSkeleton key={index} />
          ))}
        </SkeletonGroup>
      ) : isLoading ? null : tasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-app-border p-10 text-center">
          <Target className="mx-auto mb-3 h-8 w-8 text-app-text-disabled" aria-hidden="true" />
          <p className="mx-auto max-w-md text-sm text-app-text-muted">
            Nothing to review right now. Fresh tasks land here after each crawl.
          </p>
        </div>
      ) : (
        <div className="space-y-3" data-testid="starter-work-unreviewed">
          {tasks.map((task) => (
            <StarterWorkTaskCard
              key={task.id}
              task={task}
              canAct={canAct}
              isOpen={selectedTaskId === task.id}
              onSelect={onToggle}
              onApprove={onApprove}
              onReject={onReject}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * A flat section header — title, an optional count badge and a one-line
 * description — matching the Data Ingestion page. No card, no icon chip: the
 * content below sits straight on the page so the sections read as one surface
 * rather than a stack of boxes.
 */
function SectionHeading({
  title,
  description,
  count,
}: {
  title: string;
  description: string;
  count?: number;
}) {
  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold tracking-tight text-app-text">{title}</h2>
        {typeof count === "number" && count > 0 && (
          <Badge variant="neutral" size="sm" className="tabular-nums">
            {count}
          </Badge>
        )}
        <InfoHint text={description} label={`About ${title}`} />
      </div>
    </div>
  );
}
