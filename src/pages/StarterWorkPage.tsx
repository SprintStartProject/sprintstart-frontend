import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ListChecks,
  Loader2,
  PackageOpen,
  Plus,
  Sparkles,
  Target,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { Badge } from "../components/ui/Badge";
import { SegmentedTabs, type SegmentedTabOption } from "../components/ui/SegmentedTabs";
import { InfoHint } from "../components/ui/InfoHint";
import { SlidingTabPanel } from "../components/ui/SlidingTabPanel";
import { PanelPresence } from "../components/ui/PanelPresence";
import { useAuth } from "../context/useAuth";
import { useToast } from "../context/useToast";
import { PermissionGroup } from "../services/types";
import { StarterWorkTaskCard } from "../features/starter-work/components/StarterWorkTaskCard";
import { StarterWorkTaskDetails } from "../features/starter-work/components/StarterWorkTaskDetails";
import { NewStarterTaskModal } from "../features/starter-work/components/NewStarterTaskModal";
import { CorpusIssueBrowser } from "../features/starter-work/components/CorpusIssueBrowser";
import { StarterWorkPoolCloud } from "../features/starter-work/components/StarterWorkPoolCloud";
import { PoolTaskFlight } from "../features/starter-work/components/PoolTaskFlight";
import type {
  PoolFlightItem,
  PoolFlightRect,
} from "../features/starter-work/components/poolFlight";
import { useProjectContext } from "../features/projects/useProjectContext";
import { useStarterWorkReview } from "../features/starter-work/hooks/useStarterWorkReview";
import { useStarterWorkPool } from "../features/starter-work/hooks/useStarterWorkPool";
import { useSwipeableTabs } from "../hooks/useHorizontalWheelNavigation";
import type { CreateStarterWorkTaskInput, StarterWorkTask } from "../features/starter-work/types";

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
export function StarterWorkPage() {
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

  // The pool shown on the right of the overview. Reloaded after every decision so it stays in step
  // with the queue on the left.
  const {
    pool,
    isLoading: isPoolLoading,
    error: poolError,
    reload: reloadPool,
  } = useStarterWorkPool();
  // The right column is the pool minus whatever is still awaiting review on the left. The backend
  // pool response carries no per-task "reviewed" flag, so the split is computed by id against the
  // unreviewed queue rather than read off the task — and reviewing one drops it from the queue,
  // which is exactly what moves it across to the right.
  const queueIds = useMemo(() => new Set(tasks.map((task) => task.id)), [tasks]);
  const pooledTasks = useMemo(
    () => pool.filter((task) => !queueIds.has(task.id)),
    [pool, queueIds],
  );

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
        void reloadPool({ preserveContent: true });
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
    count: key === "review" ? tasks.length : key === "pool" ? pooledTasks.length : undefined,
  }));

  const showOverview = activeSection === "overview";
  const hasOpenReviews = tasks.length > 0;
  const poolUsesFullWidth = !hasOpenReviews;
  // A short queue beside a taller pool leaves a gap under the review column. It is filled with empty
  // dashed card slots that read as "room for more" rather than dead space, topping the column up to
  // three slots: two placeholders under a single review, one under two. Three or more reviews fill
  // the column on their own, so no placeholder shows.
  const reviewFillerCount = hasOpenReviews && tasks.length <= 2 ? 3 - tasks.length : 0;
  const showReviewTab = activeSection === "review";
  const showPoolTab = activeSection === "pool";
  const showBrowse = activeSection === "overview" || activeSection === "browse";

  // At-a-glance workflow snapshot: how much work is live, and how much of it has
  // already been vouched for. Both values come from the same pool rendered below.
  const overview = useMemo(
    () => ({
      awaiting: tasks.length,
      total: pool.length,
      reviewed: pooledTasks.length,
    }),
    [pool.length, pooledTasks.length, tasks.length],
  );

  const handleCreate = async (
    input: CreateStarterWorkTaskInput,
    origin?: PoolFlightRect,
  ): Promise<boolean> => {
    setIsCreating(true);
    const ok = await create(input);
    setIsCreating(false);
    if (ok) {
      await reloadPool({ preserveContent: true });
      launchPoolFlight(input, origin);
    }
    return ok;
  };

  const handlePromoted = useCallback(
    async (task: StarterWorkTask, origin?: PoolFlightRect) => {
      notePromoted(task);
      await reloadPool({ preserveContent: true });
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
            subtitle="Well-scoped first tasks mined from the ingested corpus. Approving one turns it into a goal a hire can work toward — their path becomes the route to shipping it."
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
                  onClick={() => void generate()}
                  disabled={isGenerating}
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
              <section aria-label="Overview" className="grid gap-3.5 sm:grid-cols-3">
                <Kpi
                  label="Awaiting review"
                  value={overview.awaiting}
                  foot={overview.awaiting > 0 ? "Vouch or remove each one" : "All caught up"}
                  icon={ListChecks}
                />
                <Kpi
                  label="In the pool"
                  value={overview.total}
                  foot="Available to new hires"
                  icon={PackageOpen}
                />
                <Kpi
                  label="Reviewed"
                  value={overview.reviewed}
                  foot="Vouched for by your team"
                  icon={CheckCircle2}
                />
              </section>

              <div className="grid gap-5 xl:grid-cols-2 xl:items-start">
                {hasOpenReviews && (
                  <div data-testid="overview-review-column">
                    <ReviewQueue
                      tasks={tasks}
                      isLoading={isLoading}
                      canAct={canAct}
                      selectedTaskId={selectedTask?.id ?? null}
                      onToggle={toggleSelectedTask}
                      onApprove={handleApprove}
                      onReject={handleReject}
                    />
                    {reviewFillerCount > 0 && (
                      // Empty card-shaped slots that fill the gap left by a short queue, xl only,
                      // where the side-by-side split creates it. Decorative, so hidden from a11y.
                      <div
                        aria-hidden="true"
                        data-testid="overview-review-filler"
                        className="mt-3 hidden space-y-3 xl:block"
                      >
                        {Array.from({ length: reviewFillerCount }).map((_, index) => (
                          <div
                            key={index}
                            className="flex min-h-28 items-center justify-center rounded-2xl border border-dashed border-app-border px-6 text-center"
                          >
                            {/* The line sits in the topmost slot only, so it stays right under the
                                queue with one review and reads as the last row with two. */}
                            {index === 0 && (
                              <p className="text-xs text-app-text-subtle">
                                New tasks land here for review.
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div
                  data-testid="overview-pool-column"
                  className={poolUsesFullWidth ? "xl:col-span-2" : undefined}
                >
                  <StarterWorkPoolCloud
                    tasks={pooledTasks}
                    isLoading={isPoolLoading}
                    error={poolError}
                    canAct={canAct}
                    fullWidth={poolUsesFullWidth}
                  />
                </div>
              </div>
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

          {/* The pool on its own, the same surface the overview shows on the right. PM/ADMIN edit a
              task's orientation inline from its card here; HR reads it. */}
          {showPoolTab && (
            <StarterWorkPoolCloud
              tasks={pooledTasks}
              isLoading={isPoolLoading}
              error={poolError}
              canAct={canAct}
              fullWidth
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
  return (
    <section aria-label="Awaiting your review">
      <SectionHeading
        title="Awaiting your review"
        description="Mined tasks nobody has vouched for yet. Vouching lifts their rank; removal is permanent."
        count={tasks.length}
      />
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-app-text-muted">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-app-border p-10 text-center">
          <Target className="mx-auto mb-3 h-8 w-8 text-app-text-disabled" aria-hidden="true" />
          <p className="mx-auto max-w-md text-sm text-app-text-muted">
            Nothing here needs a look. Tasks are mined from the corpus whenever a crawl finishes —
            this is where the ones nobody has vouched for yet show up, not a queue blocking anybody.
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

/** One at-a-glance overview tile, matching the Data Ingestion overview band. */
function Kpi({
  label,
  value,
  foot,
  icon: Icon,
}: {
  label: string;
  value: number;
  foot: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-2xl border border-app-border bg-app-surface p-4 sm:p-[18px]">
      <div className="flex items-center justify-between">
        <span className="text-[12.5px] text-app-text-muted">{label}</span>
        <Icon size={20} className="shrink-0 text-app-brand-text" aria-hidden="true" />
      </div>
      <p className="mt-2.5 text-3xl font-bold tracking-tight text-app-text tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-app-text-subtle">{foot}</p>
    </div>
  );
}
