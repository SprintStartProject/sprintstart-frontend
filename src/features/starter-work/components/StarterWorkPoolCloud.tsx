import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  Archive,
  CheckCircle2,
  ChevronRight,
  Cloud,
  GitBranch,
  List as ListIcon,
  PackageOpen,
  PenLine,
  RefreshCw,
  Ticket,
  UserRound,
} from "lucide-react";
import { Badge, type BadgeVariant } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";
import { InfoHint } from "../../../components/ui/InfoHint";
import { Pagination } from "../../../components/ui/Pagination";
import { SegmentedTabs, type SegmentedTabOption } from "../../../components/ui/SegmentedTabs";
import { SkeletonBlock, SkeletonGroup, SkeletonLine } from "../../../components/ui/Skeleton";
import { SpotlightCard } from "../../../components/ui/SpotlightCard";
import { useToast } from "../../../context/useToast";
import { useDelayedFlag } from "../../../hooks/useDelayedFlag";
import { useIsSmUp } from "../../../hooks/useIsSmUp";
import { queryKeys } from "../../../services/queryKeys";
import { starterWorkService } from "../../../services/starterWorkService";
import { centralSpringToken } from "../../../styles/tokens";
import { useProjectContext } from "../../projects/useProjectContext";
import { formatRelativeDate } from "../format";
import { parseCandidateSource, stripRedundantIssuePrefix, trackerLabel } from "../sourceId";
import type { StarterWorkTask } from "../types";

export type PoolStatusFilter = "all" | "unseen" | "seen" | "taskZero" | "closed";

const STATUS_FILTER_ORDER: PoolStatusFilter[] = ["all", "unseen", "seen", "taskZero", "closed"];

const STATUS_FILTER_LABELS: Record<PoolStatusFilter, string> = {
  all: "All",
  unseen: "New",
  seen: "Looked at",
  taskZero: "Task 0",
  closed: "Closed",
};

/** One page fills the cloud with twelve cards, or the list's matching stack of ten — a compact row
 *  holds more than a card does. */
const CLOUD_PAGE_SIZE = 12;
const LIST_PAGE_SIZE = 10;

/** The cloud is always four columns of three — used to know which slots sit in the same column. */
const CLOUD_GRID_COLUMNS = 4;
const CLOUD_GRID_ROWS = CLOUD_PAGE_SIZE / CLOUD_GRID_COLUMNS;

/** How far a card can be pulled right from its cell's left edge, as a percent of the cell's width —
 *  its own width is 70%, so up to 30% of the cell is free to shift into. */
const CLOUD_MAX_OFFSET_PERCENT = 30;

/** The least two vertically stacked cards in the same column are ever allowed to differ by — below
 *  this, a card gets nudged aside so the column never reads as a straight stack of edges. */
const CLOUD_MIN_COLUMN_GAP_PERCENT = 10;

/** Where one card sits inside its grid cell: a left offset, never a fixed slot — always level and
 *  never nudged up or down, so every card stays upright and every row reads as a straight line. */
type CloudSlotStyle = { offsetPercent: number };

/** A small seeded PRNG (mulberry32) — deterministic, so a layout never reshuffles on re-render. */
function mulberry32(seed: number) {
  let state = seed;
  return function next() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The three offsets for one column, at least `CLOUD_MIN_COLUMN_GAP_PERCENT` apart by construction
 * rather than by retrying a random draw until it happens to clear that gap — with three rows sharing
 * a 0–30 range and a required 10-point gap, rejecting-and-redrawing can run out of attempts before it
 * finds a spot, which is exactly what let two rows in the same column land on top of each other
 * before. Instead: draw `CLOUD_GRID_ROWS` values in whatever's left over once the gaps themselves are
 * reserved, sort them, and lay them out back to back with the gaps between — which mathematically
 * cannot place any two closer than the gap — then shuffle which row gets which resulting position.
 */
function buildColumnOffsets(random: () => number): number[] {
  const slack = CLOUD_MAX_OFFSET_PERCENT - (CLOUD_GRID_ROWS - 1) * CLOUD_MIN_COLUMN_GAP_PERCENT;
  const spaced = Array.from({ length: CLOUD_GRID_ROWS }, () => random() * slack)
    .sort((a, b) => a - b)
    .map((value, rank) => value + rank * CLOUD_MIN_COLUMN_GAP_PERCENT);

  for (let index = spaced.length - 1; index > 0; index--) {
    const swapWith = Math.floor(random() * (index + 1));
    [spaced[index], spaced[swapWith]] = [spaced[swapWith], spaced[index]];
  }
  return spaced;
}

/** One set of twelve left-offsets, built column by column so every column gets its own guaranteed
 *  spread rather than being assembled from independently-drawn rows. */
function buildCandidateOffsets(random: () => number, slotCount: number): number[] {
  const offsets: number[] = new Array(slotCount);
  for (let columnIndex = 0; columnIndex < CLOUD_GRID_COLUMNS; columnIndex++) {
    buildColumnOffsets(random).forEach((offset, rowIndex) => {
      offsets[rowIndex * CLOUD_GRID_COLUMNS + columnIndex] = offset;
    });
  }
  return offsets;
}

/** How unlike two arrangements are, checked both as they are and mirrored left-right — a pair that
 *  merely looks flipped is just as much a repeat, to the eye, as an outright duplicate. */
function offsetSetDistance(a: number[], b: number[]): number {
  let direct = 0;
  let mirrored = 0;
  for (let index = 0; index < a.length; index++) {
    direct += Math.abs(a[index] - b[index]);
    mirrored += Math.abs(a[index] - (CLOUD_MAX_OFFSET_PERCENT - b[index]));
  }
  return Math.min(direct, mirrored) / a.length;
}

/**
 * Five fixed arrangements for a full page, not one regenerated at random on every render —
 * regenerating would make cards jump every time something unrelated re-renders the page. Sampling
 * five independent arrangements occasionally left two that read as the same shape, or as a mirror of
 * one another, so instead this draws a larger pool from one continuous PRNG stream and greedily
 * keeps whichever candidate is least like anything already picked, guaranteeing all five stay
 * visibly distinct from each other (and from their own left-right flip).
 */
function buildCloudLayouts(
  layoutCount: number,
  slotCount: number,
  candidatePoolSize: number,
): CloudSlotStyle[][] {
  const random = mulberry32(20240917);
  const candidates = Array.from({ length: candidatePoolSize }, () =>
    buildCandidateOffsets(random, slotCount),
  );

  const selected = [candidates[0]];
  while (selected.length < layoutCount) {
    let bestIndex = -1;
    let bestScore = -Infinity;
    candidates.forEach((candidate, index) => {
      if (selected.includes(candidate)) return;
      const score = Math.min(...selected.map((chosen) => offsetSetDistance(candidate, chosen)));
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });
    selected.push(candidates[bestIndex]);
  }

  return selected.map((offsets) =>
    offsets.map((offsetPercent) => ({ offsetPercent: Math.round(offsetPercent * 10) / 10 })),
  );
}

const CLOUD_LAYOUTS: CloudSlotStyle[][] = buildCloudLayouts(5, CLOUD_PAGE_SIZE, 40);

type PoolView = "cloud" | "list";

type StarterWorkPoolCloudProps = {
  /** The whole live pool — reviewed and not. */
  tasks: StarterWorkTask[];
  isLoading: boolean;
  error: string | null;
  /** HR reads the pool; only PM/ADMIN can act from the task's detail drawer. */
  canAct: boolean;
  /**
   * Accepted for the caller that spans the pool across the full content width. The cloud's grid and
   * the list's two-column layout are already sized for that width unconditionally, so this currently
   * has nothing left to toggle — it stays in the prop list only so that caller keeps compiling.
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
  /**
   * Tasks reconciliation found closed at their source — shown under the "Closed" filter tab
   * instead of a separate box under the pool. Not sticky: a task leaves this list on its own once
   * its source issue reopens. Defaults to empty, which simply keeps the tab hidden.
   */
  closedTasks?: StarterWorkTask[];
  isClosedLoading?: boolean;
};

type PoolTaskProps = {
  task: StarterWorkTask;
  onOpen: (task: StarterWorkTask) => void;
  /**
   * True inside the "Closed" filter: dims the row/card and swaps the unseen/seen marker and the
   * summary line for an archive icon and a "Closed …" timestamp, since neither of those mean
   * anything for a task that already left the live pool.
   */
  closed?: boolean;
};

/** Placeholder for one pool row, matching `PoolListRow`'s marker/title/description/badge shape. */
function PoolRowSkeleton() {
  return (
    <div className="flex items-center gap-3 p-4">
      <SkeletonBlock className="h-2 w-2 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1">
        <SkeletonLine className="w-2/3" />
        <SkeletonLine className="mt-1.5 w-1/2" />
      </div>
      <SkeletonBlock className="h-5 w-16 shrink-0 rounded-full" />
    </div>
  );
}

/** Icon per known tracker, matching the icons Data Ingestion uses for the same systems. */
const TRACKER_ICONS: Record<string, LucideIcon> = {
  GITHUB: GitBranch,
  JIRA: Ticket,
};

/** Badge colour per known tracker, so a scan of the pool tells GitHub and Jira apart at a glance. */
const TRACKER_BADGE_VARIANTS: Record<string, BadgeVariant> = {
  GITHUB: "brand",
  JIRA: "orange",
};

/**
 * Where a pool task came from, shared by the card, the list row, and — from here on — anything
 * else that shows a pool task. A known tracker reads as one small coloured badge (its number or
 * key, never the full path — that stays in the tooltip and the drawer, where there is room for
 * it), so every card carries at least a touch of colour instead of reading as pure grayscale.
 * A hand-authored task has no tracker to colour, so it stays a plain muted line.
 */
function PoolTaskSourceBadge({ task }: { task: StarterWorkTask }) {
  const parsed = parseCandidateSource(task.sourceId);

  if (!parsed.hasKnownTracker) {
    return (
      <span className="flex w-fit min-w-0 shrink-0 items-center gap-1.5 self-center text-xs text-app-text-subtle">
        <PenLine className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">Written by hand</span>
      </span>
    );
  }

  const Icon = TRACKER_ICONS[parsed.trackerCode.toUpperCase()];
  const variant = TRACKER_BADGE_VARIANTS[parsed.trackerCode.toUpperCase()] ?? "brand";
  const identifier = parsed.numberLabel ?? trackerLabel(parsed.trackerCode);
  const fullSource =
    [parsed.repoLabel, parsed.numberLabel].filter(Boolean).join(" ") ||
    trackerLabel(parsed.trackerCode);

  return (
    <Badge
      variant={variant}
      size="sm"
      title={fullSource}
      className="w-fit min-w-0 shrink self-center"
    >
      {Icon && <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />}
      <span className="truncate">{identifier}</span>
    </Badge>
  );
}

/**
 * At most one badge for the state that most needs flagging: Task 0 first, then an assignee the
 * tracker already reports — never both, so a card carries the source badge above and one more
 * colour at most, rather than turning into a row of pills. Renders nothing when neither applies.
 */
function PoolTaskBadges({ task }: { task: StarterWorkTask }) {
  if (task.taskZeroEligible) {
    return (
      <Badge variant="purple" size="sm" className="w-fit shrink-0 self-center">
        Task 0
      </Badge>
    );
  }

  // Only a definite `true` means somebody has this — `null` is "we don't know", not "nobody".
  if (task.sourceHasAssignee === true) {
    return (
      <Badge variant="neutral" size="sm" className="w-fit shrink-0 self-center">
        <UserRound className="h-3 w-3" aria-hidden="true" />
        Someone is on this
      </Badge>
    );
  }

  return null;
}

/**
 * Whether nobody has looked at this task yet (a pulsing dot) or somebody already has (a
 * checkmark) — the same distinction the pool has always drawn, just quieter than a full badge. The
 * pulse is a plain CSS animation, which the app's global `prefers-reduced-motion` rule already
 * collapses to a static dot.
 */
function PoolStatusMarker({ unseen }: { unseen: boolean }) {
  if (unseen) {
    return (
      <span className="relative flex h-2 w-2 shrink-0" role="img" aria-label="Not looked at yet">
        <span
          aria-hidden="true"
          className="absolute inline-flex h-full w-full animate-ping rounded-full bg-app-brand opacity-75"
        />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-app-brand" />
      </span>
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

/** "Closed 2 days ago" for a task shown under the Closed filter, or null with no timestamp to phrase one from. */
function closedLineFor(task: StarterWorkTask): string | null {
  return task.sourceCheckedAt ? `Closed ${formatRelativeDate(task.sourceCheckedAt)}` : null;
}

/** A cloud card whose stretched button makes the entire surface open the task's detail drawer. */
function PoolCloudCard({ task, onOpen, closed = false }: PoolTaskProps) {
  const unseen = !closed && !task.reviewed;
  const description = task.summary?.trim();
  const closedLine = closed ? closedLineFor(task) : null;
  const displayTitle = stripRedundantIssuePrefix(
    task.title,
    parseCandidateSource(task.sourceId).numberLabel,
  );

  return (
    <SpotlightCard
      roundedClassName="rounded-2xl"
      className={`transition-shadow focus-within:ring-2 focus-within:ring-app-focus hover:shadow-xl ${
        unseen ? "border-dashed border-app-border-muted" : ""
      } ${closed ? "opacity-70" : ""}`}
    >
      {/* A soft always-on glow, not the mouse-tracked spotlight — the cue that this one is new has
          to read before the reader's cursor ever reaches it. */}
      {unseen && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-10 -left-10 z-0 h-28 w-28 rounded-full bg-app-brand/25 blur-2xl"
        />
      )}

      <button
        type="button"
        onClick={() => onOpen(task)}
        aria-label={`Open details for ${task.title}`}
        className="absolute inset-0 z-0 rounded-2xl focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
      />

      <article className="pointer-events-none relative z-10 flex h-full flex-col gap-1 p-3">
        <div className="flex items-center justify-between gap-2">
          <PoolTaskSourceBadge task={task} />
          {closed ? (
            <Archive
              role="img"
              aria-label="Closed in the tracker"
              className="h-4 w-4 shrink-0 text-app-text-subtle"
            />
          ) : (
            <PoolStatusMarker unseen={unseen} />
          )}
        </div>

        <h3
          className="line-clamp-2 text-sm leading-snug font-semibold text-app-text"
          title={task.title}
        >
          {displayTitle}
        </h3>

        {closedLine ? (
          <p className="line-clamp-1 text-xs leading-relaxed text-app-text-subtle">{closedLine}</p>
        ) : (
          description && (
            <p
              className="line-clamp-1 text-xs leading-relaxed text-app-text-muted"
              title={description}
            >
              {description}
            </p>
          )
        )}

        <div className="mt-auto pt-0.5">
          <PoolTaskBadges task={task} />
        </div>
      </article>
    </SpotlightCard>
  );
}

/**
 * Pool task row: a single grouped list stacks these with `divide-y`, so each row only has to lay
 * out its own content — marker, title/summary, then the trailing badges and a chevron. Below `sm`
 * the trailing group wraps under the title instead of staying pinned to the row's right edge.
 */
function PoolListRow({ task, onOpen, closed = false }: PoolTaskProps) {
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
        className="absolute inset-0 z-0 focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none focus-visible:ring-inset"
      />

      <div className="pointer-events-none relative z-10 flex flex-col gap-2 p-4 transition-colors group-hover:bg-app-surface-hover sm:flex-row sm:items-center sm:gap-3">
        <div className="flex w-5 shrink-0 items-center justify-center">
          {closed ? (
            <Archive
              role="img"
              aria-label="Closed in the tracker"
              className="h-4 w-4 shrink-0 text-app-text-subtle"
            />
          ) : (
            <PoolStatusMarker unseen={unseen} />
          )}
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

/**
 * The reviewed starter-work pool with interchangeable cloud and list views.
 *
 * The cloud lays its cards out as a real CSS masonry (see the render below); list rows share the
 * same content structure in the issue browser's row language. Both representations make the whole
 * task surface the drawer trigger — HR opens the same read-only drawer, matching the backend's
 * authoring permissions on what it can actually do there.
 */
export function StarterWorkPoolCloud({
  tasks,
  isLoading,
  error,
  canAct,
  onSync,
  isSyncing = false,
  onOpenTask,
  initialStatusFilter,
  closedTasks = [],
  isClosedLoading = false,
}: StarterWorkPoolCloudProps) {
  const { selectedProjectId, selectedProject } = useProjectContext();
  const prefersReducedMotion = useReducedMotion();
  const { error: showErrorToast } = useToast();
  const showLoadingSkeleton = useDelayedFlag(isLoading);
  const showClosedLoadingSkeleton = useDelayedFlag(isClosedLoading);

  const [view, setView] = useState<PoolView>("cloud");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<PoolStatusFilter>(initialStatusFilter ?? "all");
  const [onlyProject, setOnlyProject] = useState(false);

  // The cloud only reads as a cloud once there is room to scatter its cards. Below `sm` there is
  // not, so the pool falls back to the list regardless of the picked view, and the view toggle is
  // hidden. `view` still holds the desktop choice, so widening the window restores the cloud.
  const isSmUp = useIsSmUp();
  const effectiveView: PoolView = isSmUp ? view : "list";

  // Which of the five scattered arrangements is showing: a fresh pick each time the pool mounts,
  // then cycling to the next one as the reader pages, so paging through never repeats a shape.
  const [cloudLayoutSeed] = useState(() => Math.floor(Math.random() * CLOUD_LAYOUTS.length));

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

  // Scoped by "Only {project}" alone, so the status filter's own counts (below) reflect what
  // picking each one would show without also baking in the status filter that is currently active.
  const projectScopedTasks = useMemo(() => {
    if (!onlyProject) return sortedTasks;
    return sortedTasks.filter((task) => {
      const groupKey = parseCandidateSource(task.sourceId).groupKey;
      return groupKey !== null && projectGroupKeys.has(groupKey);
    });
  }, [sortedTasks, onlyProject, projectGroupKeys]);

  // Most recently closed first — "Only {project}" scopes this the same way it scopes the live
  // pool, so the tab's own count always matches what picking it would actually show.
  const projectScopedClosedTasks = useMemo(() => {
    const mostRecentlyClosedFirst = [...closedTasks].sort((a, b) => {
      if (!a.sourceCheckedAt) return 1;
      if (!b.sourceCheckedAt) return -1;
      return b.sourceCheckedAt.localeCompare(a.sourceCheckedAt);
    });
    if (!onlyProject) return mostRecentlyClosedFirst;
    return mostRecentlyClosedFirst.filter((task) => {
      const groupKey = parseCandidateSource(task.sourceId).groupKey;
      return groupKey !== null && projectGroupKeys.has(groupKey);
    });
  }, [closedTasks, onlyProject, projectGroupKeys]);

  const statusCounts = useMemo(
    () => ({
      all: projectScopedTasks.length,
      unseen: projectScopedTasks.filter((task) => !task.reviewed).length,
      seen: projectScopedTasks.filter((task) => task.reviewed).length,
      taskZero: projectScopedTasks.filter((task) => task.taskZeroEligible).length,
      closed: projectScopedClosedTasks.length,
    }),
    [projectScopedTasks, projectScopedClosedTasks],
  );

  // Kept out of the bar entirely below its first closed task — a tab that is always empty is just
  // clutter — except while it is the active filter, so picking it and later syncing it away never
  // yanks the bar out from under the reader mid-look.
  const statusFilterOptions: SegmentedTabOption<PoolStatusFilter>[] = STATUS_FILTER_ORDER.filter(
    (value) => value !== "closed" || statusCounts.closed > 0 || statusFilter === "closed",
  ).map((value) => ({
    value,
    label: STATUS_FILTER_LABELS[value],
    icon: value === "closed" ? <Archive className="h-3.5 w-3.5" aria-hidden="true" /> : undefined,
    count: statusCounts[value],
  }));

  const isViewingClosed = statusFilter === "closed";

  const filteredTasks = useMemo(() => {
    if (isViewingClosed) return projectScopedClosedTasks;
    return projectScopedTasks.filter((task) => {
      if (statusFilter === "unseen") return !task.reviewed;
      if (statusFilter === "seen") return task.reviewed;
      if (statusFilter === "taskZero") return task.taskZeroEligible;
      return true;
    });
  }, [projectScopedTasks, projectScopedClosedTasks, isViewingClosed, statusFilter]);

  const activeIsLoading = isViewingClosed ? isClosedLoading : isLoading;
  const activeShowLoadingSkeleton = isViewingClosed
    ? showClosedLoadingSkeleton
    : showLoadingSkeleton;

  const pageSize = effectiveView === "cloud" ? CLOUD_PAGE_SIZE : LIST_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(
    () => filteredTasks.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filteredTasks, safePage, pageSize],
  );

  const cloudLayout = CLOUD_LAYOUTS[(cloudLayoutSeed + (safePage - 1)) % CLOUD_LAYOUTS.length];

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

        <div className="ml-auto flex items-center gap-2">
          {/* Nothing to say before the first sync ever runs — a pool that has never been checked
              is a normal starting state, not a problem worth a line about. */}
          {lastCheckedAt && (
            <span className="text-xs text-app-text-subtle">
              Checked {formatRelativeDate(lastCheckedAt)}
            </span>
          )}

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

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <SegmentedTabs
          value={statusFilter}
          options={statusFilterOptions}
          onChange={changeStatusFilter}
          layoutId="starter-work-pool-status-pill"
          ariaLabel="Filter pool tasks"
        />
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

      {isViewingClosed && (
        <p className="mb-4 text-sm text-app-text-subtle">
          These came back closed from their tracker. They return to the pool on their own if the
          issue reopens.
        </p>
      )}

      {activeShowLoadingSkeleton ? (
        <SkeletonGroup
          label="Loading the pool"
          className="divide-y divide-app-border overflow-hidden rounded-2xl border border-app-border bg-app-surface"
        >
          {Array.from({ length: 6 }).map((_, index) => (
            <PoolRowSkeleton key={index} />
          ))}
        </SkeletonGroup>
      ) : activeIsLoading ? null : !isViewingClosed && tasks.length === 0 ? (
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
            <div data-pool-flight-target className="relative overflow-hidden rounded-2xl">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-4 opacity-40"
                style={{
                  backgroundImage: "radial-gradient(var(--border-strong) 1px, transparent 1px)",
                  backgroundSize: "24px 24px",
                  maskImage: "linear-gradient(to bottom, black, transparent 92%)",
                }}
              />
              {/* A very soft brand shimmer behind the dot grid, centred rather than mouse-tracked
                  like a card's own spotlight — this one just says "something lives here". */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-70"
                style={{
                  backgroundImage:
                    "radial-gradient(ellipse at center, var(--brand-glow), transparent 65%)",
                }}
              />

              {/*
                A real 4-column CSS grid, not absolute-positioned percentages: `items-start` keeps
                every row on one horizontal line (each card sits flush with the top of its row and
                simply keeps its own natural height below that line), while each card is held to 70%
                of its cell's width and pulled right by a percentage from `cloudLayout` (one of five
                seeded arrangements, picked in `cloudLayoutSeed` above; see `buildCloudLayouts` for
                why no two columns ever end up stacked on the same edge). That left offset is the
                only thing that varies from card to card — every card stays level and every row stays
                in line — so the cloud reads as scattered without any card drifting or tilting out of
                place the way an absolutely-positioned or rotated card could.
              */}
              <div
                className="relative z-10 grid grid-cols-4 items-start gap-4 p-4"
                data-testid="pool-task-cloud"
              >
                <AnimatePresence initial={false} mode="popLayout">
                  {pageItems.map((task, index) => {
                    const slotStyle = cloudLayout[index] ?? cloudLayout[0];

                    return (
                      <motion.div
                        key={task.id}
                        layout={!prefersReducedMotion}
                        initial={
                          prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.96 }
                        }
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
                        transition={{ ...centralSpringToken, delay: index * 0.04 }}
                        whileHover={prefersReducedMotion ? undefined : { y: -4 }}
                        data-testid={`pool-task-${task.id}`}
                        className="w-[70%]"
                        style={{ marginLeft: `${slotStyle.offsetPercent}%` }}
                      >
                        <PoolCloudCard task={task} onOpen={onOpenTask} closed={isViewingClosed} />
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          ) : (
            <ul
              className="divide-y divide-app-border overflow-hidden rounded-2xl border border-app-border bg-app-surface"
              data-testid="pool-task-list"
              data-pool-flight-target
            >
              {pageItems.map((task) => (
                <PoolListRow
                  key={task.id}
                  task={task}
                  onOpen={onOpenTask}
                  closed={isViewingClosed}
                />
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
