import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  CheckCircle2,
  ChevronRight,
  Cloud,
  List as ListIcon,
  PackageOpen,
  RefreshCw,
  UserRound,
} from "lucide-react";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";
import { InfoHint } from "../../../components/ui/InfoHint";
import { Pagination } from "../../../components/ui/Pagination";
import { SkeletonGroup, SkeletonLine } from "../../../components/ui/Skeleton";
import { SpotlightCard } from "../../../components/ui/SpotlightCard";
import { useToast } from "../../../context/useToast";
import { useDelayedFlag } from "../../../hooks/useDelayedFlag";
import { useIsSmUp } from "../../../hooks/useIsSmUp";
import { queryKeys } from "../../../services/queryKeys";
import { starterWorkService } from "../../../services/starterWorkService";
import { centralSpringToken } from "../../../styles/tokens";
import { useProjectContext } from "../../projects/useProjectContext";
import { formatRelativeDate } from "../format";
import { parseCandidateSource, trackerLabel } from "../sourceId";
import type { StarterWorkTask } from "../types";

export type PoolStatusFilter = "all" | "unseen" | "seen" | "taskZero";

const STATUS_FILTER_OPTIONS: { value: PoolStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unseen", label: "Not looked at" },
  { value: "seen", label: "Looked at" },
  { value: "taskZero", label: "Task 0" },
];

/** Cloud cards need more breathing room than the compact issue-style list rows. */
const CLOUD_PAGE_SIZE = 5;
const LIST_PAGE_SIZE = 3;
/** Full width, the list lays its rows out two-up, so one page holds a 2×3 grid instead of three. */
const LIST_PAGE_SIZE_WIDE = 6;

type PoolView = "cloud" | "list";

type CloudSlot = {
  left: string;
  top: string;
  width: string;
  height: string;
};

/**
 * Five collision-free compositions for one five-card cloud page.
 *
 * A page change picks a different composition at random. The positions themselves stay fixed while
 * that page is visible, so normal renders never make cards jump. Below `xl` the custom properties
 * are ignored and the same cards fall back to a regular responsive grid.
 */
const CLOUD_LAYOUTS: CloudSlot[][] = [
  [
    { left: "0%", top: "0%", width: "29%", height: "8.5rem" },
    { left: "35%", top: "5%", width: "29%", height: "8.5rem" },
    { left: "70%", top: "2%", width: "30%", height: "8.5rem" },
    { left: "7%", top: "57%", width: "32%", height: "8.5rem" },
    { left: "51%", top: "54%", width: "33%", height: "8.5rem" },
  ],
  [
    { left: "2%", top: "7%", width: "30%", height: "8.5rem" },
    { left: "36%", top: "0%", width: "30%", height: "8.5rem" },
    { left: "70%", top: "8%", width: "30%", height: "8.5rem" },
    { left: "15%", top: "54%", width: "31%", height: "8.5rem" },
    { left: "55%", top: "57%", width: "32%", height: "8.5rem" },
  ],
  [
    { left: "0%", top: "0%", width: "30%", height: "8.5rem" },
    { left: "34%", top: "9%", width: "30%", height: "8.5rem" },
    { left: "69%", top: "3%", width: "31%", height: "8.5rem" },
    { left: "5%", top: "57%", width: "33%", height: "8.5rem" },
    { left: "48%", top: "54%", width: "33%", height: "8.5rem" },
  ],
  [
    { left: "4%", top: "5%", width: "30%", height: "8.5rem" },
    { left: "38%", top: "0%", width: "30%", height: "8.5rem" },
    { left: "72%", top: "8%", width: "28%", height: "8.5rem" },
    { left: "0%", top: "55%", width: "32%", height: "8.5rem" },
    { left: "42%", top: "57%", width: "34%", height: "8.5rem" },
  ],
  [
    { left: "0%", top: "8%", width: "29%", height: "8.5rem" },
    { left: "35%", top: "0%", width: "31%", height: "8.5rem" },
    { left: "71%", top: "4%", width: "29%", height: "8.5rem" },
    { left: "12%", top: "54%", width: "33%", height: "8.5rem" },
    { left: "56%", top: "57%", width: "32%", height: "8.5rem" },
  ],
];

/** Full width shows the small five-card composition twice, so a page holds ten. */
const CLOUD_PAGE_SIZE_WIDE = 10;

/**
 * The full-width cloud is the small composition shown twice, side by side. Each slot's horizontal
 * position and width are scaled into one half and the same set is offset into the other; the
 * vertical placement is untouched, so it reads as two of the same cloud rather than a new shape.
 *
 * The scale is a touch under half (and the right half starts a touch past centre) so the two clouds
 * leave a small gutter down the middle instead of meeting edge to edge.
 */
const CLOUD_HALF_SCALE = 0.48;
const CLOUD_RIGHT_OFFSET = "52%";

function widenCloudLayout(layout: CloudSlot[]): CloudSlot[] {
  const left = layout.map((slot) => ({
    ...slot,
    left: `calc(${slot.left} * ${CLOUD_HALF_SCALE})`,
    width: `calc(${slot.width} * ${CLOUD_HALF_SCALE})`,
  }));
  const right = layout.map((slot) => ({
    ...slot,
    left: `calc(${CLOUD_RIGHT_OFFSET} + ${slot.left} * ${CLOUD_HALF_SCALE})`,
    width: `calc(${slot.width} * ${CLOUD_HALF_SCALE})`,
  }));
  return [...left, ...right];
}

const CLOUD_LAYOUTS_WIDE: CloudSlot[][] = CLOUD_LAYOUTS.map(widenCloudLayout);

type CloudSlotStyle = CSSProperties & {
  "--cloud-left": string;
  "--cloud-top": string;
  "--cloud-width": string;
  "--cloud-height": string;
};

type StarterWorkPoolCloudProps = {
  /** The whole live pool — reviewed and not. */
  tasks: StarterWorkTask[];
  isLoading: boolean;
  error: string | null;
  /** HR reads the pool; only PM/ADMIN can act from the task's detail drawer. */
  canAct: boolean;
  /**
   * Whether the pool spans the full content width (its own tab, or the overview with no open
   * reviews). When it does, the list view lays its rows out in a two-column grid rather than a
   * single stacked column, and pages six at a time to fill a 2×3 grid.
   */
  fullWidth?: boolean;
  /** Reconciles the pool against its trackers now. Omitted hides the sync control entirely. */
  onSync?: () => void;
  isSyncing?: boolean;
  /** Opens the task's detail drawer. Every task opens it, HR included — the drawer itself is read-only for them. */
  onOpenTask: (task: StarterWorkTask) => void;
  /**
   * Starts the filter chips on something other than "All" — the Overview tab's "Choose Task 0"
   * card lands here with `"taskZero"` already applied, rather than a PM having to click it again.
   * Only consulted for the initial `useState`; changing it after mount does nothing, matching how
   * every other filter here behaves.
   */
  initialStatusFilter?: PoolStatusFilter;
};

type PoolTaskProps = {
  task: StarterWorkTask;
  onOpen: (task: StarterWorkTask) => void;
};

/** Placeholder for one pool row, matching `PoolListRow`'s title/description/meta shape. */
function PoolRowSkeleton() {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-app-border bg-app-surface p-4">
      <div className="min-w-0 flex-1">
        <SkeletonLine className="w-2/3" />
        <SkeletonLine className="mt-1.5 w-1/2" />
        <SkeletonLine className="mt-2 h-5 w-20" />
      </div>
    </div>
  );
}

/** Pick any of the other four layouts, so every page change is visibly different. */
function nextCloudLayout(current: number): number {
  const offset = 1 + Math.floor(Math.random() * (CLOUD_LAYOUTS.length - 1));
  return (current + offset) % CLOUD_LAYOUTS.length;
}

/** Shared source metadata used by both representations of a pool task. */
function PoolTaskMeta({ task }: { task: StarterWorkTask }) {
  const parsed = parseCandidateSource(task.sourceId);
  const { trackerCode, hasKnownTracker } = parsed;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant="brand" size="sm">
        {hasKnownTracker ? trackerLabel(trackerCode) : "Custom"}
      </Badge>
      {hasKnownTracker && parsed.numberLabel && (
        <Badge variant="neutral" size="sm">
          {parsed.numberLabel}
        </Badge>
      )}
      {hasKnownTracker && parsed.repo && (
        <span className="min-w-0 truncate text-xs text-app-text-subtle" title={parsed.repo}>
          {parsed.repo}
        </span>
      )}
      {task.taskZeroEligible && (
        <Badge variant="purple" size="sm">
          Task 0
        </Badge>
      )}
      {/* Only a definite `true` means somebody has this — `null` is "we don't know", not "nobody". */}
      {task.sourceHasAssignee === true && (
        <Badge variant="neutral" size="sm">
          <UserRound className="h-3 w-3" aria-hidden="true" />
          Someone is on this
        </Badge>
      )}
    </div>
  );
}

/**
 * Whether nobody has looked at this task yet (a dot) or somebody has (a checkmark). Purely a
 * marker, driven by the task's own `reviewed` field.
 */
function PoolTaskStatusMarker({ unseen }: { unseen: boolean }) {
  if (unseen) {
    return (
      <span
        role="img"
        aria-label="Not looked at yet"
        title="Not looked at yet"
        className="h-2 w-2 shrink-0 rounded-full bg-app-brand"
      />
    );
  }

  return (
    <CheckCircle2
      role="img"
      aria-label="Looked at"
      className="h-4 w-4 shrink-0 text-app-success-text"
    />
  );
}

/** A cloud card whose stretched button makes the entire surface open the task's detail drawer. */
function PoolCloudCard({ task, onOpen }: PoolTaskProps) {
  const unseen = !task.reviewed;
  const description = task.summary?.trim();

  return (
    <SpotlightCard
      roundedClassName="rounded-2xl"
      className={`h-full focus-within:ring-2 focus-within:ring-app-focus ${unseen ? "border-dashed" : ""}`}
    >
      <button
        type="button"
        onClick={() => onOpen(task)}
        aria-label={`Open details for ${task.title}`}
        className="absolute inset-0 z-0 rounded-2xl focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
      />

      <article className="pointer-events-none relative z-10 flex h-full flex-col gap-2 p-4">
        <div className="flex items-start gap-2">
          <PoolTaskStatusMarker unseen={unseen} />
          <h3
            className="line-clamp-2 min-w-0 flex-1 text-sm leading-snug font-semibold text-app-text"
            title={task.title}
          >
            {task.title}
          </h3>
          <ChevronRight
            className="h-4 w-4 shrink-0 self-center text-app-text-disabled"
            aria-hidden="true"
          />
        </div>

        {description && (
          <p className="truncate text-xs leading-relaxed text-app-text-muted" title={description}>
            {description}
          </p>
        )}

        <div className="mt-auto pt-1">
          <PoolTaskMeta task={task} />
        </div>
      </article>
    </SpotlightCard>
  );
}

/** Pool task in the same compact row language as the issue browser directly below it. */
function PoolListRow({ task, onOpen }: PoolTaskProps) {
  const unseen = !task.reviewed;
  const description = task.summary?.trim();

  return (
    <li className="group relative h-full" data-testid={`pool-list-task-${task.id}`}>
      <button
        type="button"
        onClick={() => onOpen(task)}
        aria-label={`Open details for ${task.title}`}
        className="absolute inset-0 z-0 rounded-2xl focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
      />

      {/* h-full so that side by side in the full-width grid, the row's two cards match the taller
          one's height; in the single stacked column it is a no-op. */}
      <div
        className={`pointer-events-none relative z-10 flex h-full items-start gap-3 rounded-2xl border bg-app-surface p-4 transition-colors group-hover:border-app-border-strong ${
          unseen ? "border-dashed border-app-border" : "border-app-border"
        }`}
      >
        <PoolTaskStatusMarker unseen={unseen} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-app-text" title={task.title}>
            {task.title}
          </h3>
          {description && (
            <p className="mt-1 truncate text-xs text-app-text-muted" title={description}>
              {description}
            </p>
          )}
          <div className="mt-1.5">
            <PoolTaskMeta task={task} />
          </div>
        </div>

        <ChevronRight
          className="h-4 w-4 shrink-0 self-center text-app-text-disabled"
          aria-hidden="true"
        />
      </div>
    </li>
  );
}

/**
 * The reviewed starter-work pool with interchangeable cloud and list views.
 *
 * Cloud cards use one of five compositions and list rows deliberately mirror the issue browser.
 * Both representations make the whole task surface the drawer trigger — HR opens the same
 * read-only drawer, matching the backend's authoring permissions on what it can actually do there.
 */
export function StarterWorkPoolCloud({
  tasks,
  isLoading,
  error,
  canAct,
  fullWidth = false,
  onSync,
  isSyncing = false,
  onOpenTask,
  initialStatusFilter,
}: StarterWorkPoolCloudProps) {
  const { selectedProjectId, selectedProject } = useProjectContext();
  const prefersReducedMotion = useReducedMotion();
  const { error: showErrorToast } = useToast();
  const showLoadingSkeleton = useDelayedFlag(isLoading);

  const [view, setView] = useState<PoolView>("cloud");
  const [layoutIndex, setLayoutIndex] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<PoolStatusFilter>(initialStatusFilter ?? "all");
  const [onlyProject, setOnlyProject] = useState(false);

  // The cloud only reads as a cloud once there is room to scatter its cards. Below `sm` there is
  // not, so the pool falls back to the list regardless of the picked view, and the view toggle is
  // hidden. `view` still holds the desktop choice, so widening the window restores the cloud.
  const isSmUp = useIsSmUp();
  const effectiveView: PoolView = isSmUp ? view : "list";

  // The same project-scoped query `CorpusIssueBrowser` fetches, read here purely to know which
  // repos/Jira projects belong to the selected project's corpus — sharing the cache key means a
  // browser already open on this project costs this chip nothing extra.
  const { data: candidates } = useQuery({
    queryKey: queryKeys.starterWork.corpusIssues(selectedProjectId),
    queryFn: () => starterWorkService.fetchCandidates(selectedProjectId),
    enabled: Boolean(selectedProjectId),
  });

  const projectGroupKeys = useMemo(() => {
    const keys = new Set<string>();
    (candidates ?? []).forEach((candidate) => {
      const groupKey = parseCandidateSource(candidate.sourceId).groupKey;
      if (groupKey) keys.add(groupKey);
    });
    return keys;
  }, [candidates]);

  // Unseen tasks sort first, within an otherwise stable order — a page change never has to explain
  // why a task moved for no reason a reader can see.
  const sortedTasks = useMemo(() => {
    const withUnseenFirst = [...tasks];
    withUnseenFirst.sort((a, b) => {
      const aUnseen = !a.reviewed;
      const bUnseen = !b.reviewed;
      return aUnseen === bUnseen ? 0 : aUnseen ? -1 : 1;
    });
    return withUnseenFirst;
  }, [tasks]);

  // The newest point at which reconciliation compared any of these tasks against its source, for
  // the "Last checked" line below — null when nothing has ever been checked, which is the normal
  // state for a pool nobody has synced yet.
  const lastCheckedAt = useMemo(
    () =>
      tasks.reduce<string | null>((latest, current) => {
        if (!current.sourceCheckedAt) return latest;
        if (!latest || current.sourceCheckedAt > latest) return current.sourceCheckedAt;
        return latest;
      }, null),
    [tasks],
  );

  const filteredTasks = useMemo(
    () =>
      sortedTasks.filter((task) => {
        if (statusFilter === "unseen" && task.reviewed) return false;
        if (statusFilter === "seen" && !task.reviewed) return false;
        if (statusFilter === "taskZero" && !task.taskZeroEligible) return false;
        if (onlyProject) {
          const groupKey = parseCandidateSource(task.sourceId).groupKey;
          if (!groupKey || !projectGroupKeys.has(groupKey)) return false;
        }
        return true;
      }),
    [sortedTasks, statusFilter, onlyProject, projectGroupKeys],
  );

  const listPageSize = fullWidth ? LIST_PAGE_SIZE_WIDE : LIST_PAGE_SIZE;
  const cloudPageSize = fullWidth ? CLOUD_PAGE_SIZE_WIDE : CLOUD_PAGE_SIZE;
  const pageSize = effectiveView === "cloud" ? cloudPageSize : listPageSize;
  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(
    () => filteredTasks.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filteredTasks, safePage, pageSize],
  );

  useEffect(() => {
    if (!error) return;
    showErrorToast("Pool unavailable", { description: error });
  }, [error, showErrorToast]);

  const changeView = (nextView: PoolView) => {
    setView(nextView);
    setPage(1);
  };

  const changeStatusFilter = (nextFilter: PoolStatusFilter) => {
    setStatusFilter(nextFilter);
    setPage(1);
  };

  const toggleOnlyProject = () => {
    setOnlyProject((current) => !current);
    setPage(1);
  };

  const changePage = (nextPage: number) => {
    if (nextPage === safePage) return;
    setPage(nextPage);
    if (effectiveView === "cloud") setLayoutIndex((current) => nextCloudLayout(current));
  };

  return (
    <section className="@container" data-testid="starter-work-pool" aria-label="Tasks in the pool">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold tracking-tight text-app-text">In the pool</h2>
        {tasks.length > 0 && (
          <Badge variant="neutral" size="sm" className="tabular-nums">
            {tasks.length}
          </Badge>
        )}
        <InfoHint
          label="About the pool"
          text="Every pooled task stays claimable. Review lifts its rank; edit orientation to write the guide."
        />

        {/* Nothing to say before the first sync ever runs — a pool that has never been checked
            is a normal starting state, not a problem worth a line about. */}
        {lastCheckedAt && (
          <span className="text-xs text-app-text-subtle">
            Last checked against trackers {formatRelativeDate(lastCheckedAt)}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {canAct && onSync && (
            <Button
              variant="ghost"
              size="sm"
              loading={isSyncing}
              onClick={onSync}
              icon={<RefreshCw className="h-4 w-4" aria-hidden="true" />}
            >
              {isSyncing ? "Syncing…" : "Sync"}
            </Button>
          )}

          <div
            className="hidden items-center gap-1 rounded-xl border border-app-border bg-app-surface-muted p-1 sm:flex"
            role="group"
            aria-label="Pool view"
          >
            <Button
              variant={view === "cloud" ? "secondary" : "ghost"}
              size="sm"
              iconOnly
              aria-label="Cloud view"
              aria-pressed={view === "cloud"}
              title="Cloud view"
              onClick={() => changeView("cloud")}
            >
              <Cloud className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              variant={view === "list" ? "secondary" : "ghost"}
              size="sm"
              iconOnly
              aria-label="List view"
              aria-pressed={view === "list"}
              title="List view"
              onClick={() => changeView("list")}
            >
              <ListIcon className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>

      <div
        className="mb-4 flex flex-wrap items-center gap-1.5"
        role="group"
        aria-label="Filter pool tasks"
      >
        {STATUS_FILTER_OPTIONS.map((option) => (
          <Button
            key={option.value}
            variant={statusFilter === option.value ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={statusFilter === option.value}
            onClick={() => changeStatusFilter(option.value)}
          >
            {option.label}
          </Button>
        ))}
        {selectedProject && projectGroupKeys.size > 0 && (
          <Button
            variant={onlyProject ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={onlyProject}
            onClick={toggleOnlyProject}
          >
            Only {selectedProject.name}
          </Button>
        )}
      </div>

      {showLoadingSkeleton ? (
        <SkeletonGroup
          label="Loading the pool"
          className={
            fullWidth ? "grid grid-cols-1 gap-2.5 @min-[38rem]:grid-cols-2" : "space-y-2.5"
          }
        >
          {Array.from({ length: fullWidth ? 6 : 3 }).map((_, index) => (
            <PoolRowSkeleton key={index} />
          ))}
        </SkeletonGroup>
      ) : isLoading ? null : tasks.length === 0 ? (
        <EmptyState icon={<PackageOpen className="h-8 w-8" aria-hidden="true" />}>
          Nothing here yet. Mine or add a task and it lands here, claimable right away.
        </EmptyState>
      ) : filteredTasks.length === 0 ? (
        <EmptyState icon={<PackageOpen className="h-8 w-8" aria-hidden="true" />}>
          No tasks match this filter.
        </EmptyState>
      ) : (
        <>
          {effectiveView === "cloud" ? (
            <div
              data-pool-flight-target
              className="relative overflow-hidden rounded-2xl @min-[38rem]:min-h-[22rem]"
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-4 hidden opacity-40 @min-[38rem]:block"
                style={{
                  backgroundImage: "radial-gradient(var(--border-strong) 1px, transparent 1px)",
                  backgroundSize: "24px 24px",
                  maskImage: "linear-gradient(to bottom, black, transparent 92%)",
                }}
              />

              <ul
                className="relative z-10 grid grid-cols-1 gap-3 sm:grid-cols-2 @min-[38rem]:m-4 @min-[38rem]:block @min-[38rem]:min-h-80"
                data-testid="pool-task-cloud"
                data-cloud-layout={layoutIndex}
              >
                <AnimatePresence initial={false} mode="popLayout">
                  {pageItems.map((task, index) => {
                    const layout = fullWidth
                      ? CLOUD_LAYOUTS_WIDE[layoutIndex]
                      : CLOUD_LAYOUTS[layoutIndex];
                    const slot = layout[index];
                    const slotStyle: CloudSlotStyle = {
                      "--cloud-left": slot.left,
                      "--cloud-top": slot.top,
                      "--cloud-width": slot.width,
                      "--cloud-height": slot.height,
                    };

                    return (
                      <motion.li
                        key={task.id}
                        layout={!prefersReducedMotion}
                        initial={
                          prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94 }
                        }
                        animate={{ opacity: 1, scale: 1 }}
                        exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
                        transition={centralSpringToken}
                        style={slotStyle}
                        data-testid={`pool-task-${task.id}`}
                        data-cloud-slot={index}
                        className={`min-h-32 @min-[38rem]:absolute @min-[38rem]:top-[var(--cloud-top)] @min-[38rem]:left-[var(--cloud-left)] @min-[38rem]:h-[var(--cloud-height)] @min-[38rem]:w-[var(--cloud-width)] ${
                          fullWidth ? "@min-[38rem]:min-w-36" : "@min-[38rem]:min-w-40"
                        }`}
                      >
                        <PoolCloudCard task={task} onOpen={onOpenTask} />
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            </div>
          ) : (
            <ul
              className={
                fullWidth ? "grid grid-cols-1 gap-2.5 @min-[38rem]:grid-cols-2" : "space-y-2.5"
              }
              data-testid="pool-task-list"
              data-pool-flight-target
            >
              {pageItems.map((task) => (
                <PoolListRow key={task.id} task={task} onOpen={onOpenTask} />
              ))}
            </ul>
          )}

          <Pagination
            currentPage={safePage}
            totalPages={totalPages}
            onPageChange={changePage}
            className="mt-5"
          />
        </>
      )}
    </section>
  );
}
