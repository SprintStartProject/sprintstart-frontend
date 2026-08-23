import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ChevronRight,
  Cloud,
  List as ListIcon,
  Loader2,
  PackageOpen,
  PencilLine,
} from "lucide-react";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";
import { InfoHint } from "../../../components/ui/InfoHint";
import { Pagination } from "../../../components/ui/Pagination";
import { SpotlightCard } from "../../../components/ui/SpotlightCard";
import { useToast } from "../../../context/useToast";
import { orientationService } from "../../../services/orientationService";
import { centralSpringToken } from "../../../styles/tokens";
import { OrientationEditor } from "../../orientation/components/OrientationEditor";
import type { MyOrientation } from "../../orientation/types";
import { useProjectContext } from "../../projects/useProjectContext";
import { parseCandidateSource, trackerLabel } from "../sourceId";
import type { StarterWorkTask } from "../types";

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
  /** Reviewed tasks shown in the pool; the page removes the still-unreviewed queue first. */
  tasks: StarterWorkTask[];
  isLoading: boolean;
  error: string | null;
  /** HR reads the pool; only PM/ADMIN can open the orientation editor. */
  canAct: boolean;
  /**
   * Whether the pool spans the full content width (its own tab, or the overview with no open
   * reviews). When it does, the list view lays its rows out in a two-column grid rather than a
   * single stacked column, and pages six at a time to fill a 2×3 grid.
   */
  fullWidth?: boolean;
};

type PoolTaskProps = {
  task: StarterWorkTask;
  canOpen: boolean;
  isOpening: boolean;
  isBusy: boolean;
  onOpen: (task: StarterWorkTask) => void;
};

/** Pick any of the other four layouts, so every page change is visibly different. */
function nextCloudLayout(current: number): number {
  const offset = 1 + Math.floor(Math.random() * (CLOUD_LAYOUTS.length - 1));
  return (current + offset) % CLOUD_LAYOUTS.length;
}

/** Shared source metadata used by both representations of a pool task. */
function PoolTaskMeta({ task }: { task: StarterWorkTask }) {
  const parsed = parseCandidateSource(task.sourceId);
  const trackerCode = task.sourceId.split(":")[0] ?? "";
  const hasKnownTracker =
    trackerCode.toUpperCase() === "GITHUB" || trackerCode.toUpperCase() === "JIRA";

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
    </div>
  );
}

/** A cloud card whose stretched button makes the entire surface open the orientation drawer. */
function PoolCloudCard({ task, canOpen, isOpening, isBusy, onOpen }: PoolTaskProps) {
  const description = task.summary?.trim();

  return (
    <SpotlightCard
      roundedClassName="rounded-2xl"
      className="h-full focus-within:ring-2 focus-within:ring-app-focus"
    >
      {canOpen && (
        <button
          type="button"
          disabled={isBusy}
          onClick={() => onOpen(task)}
          aria-label={`Edit orientation for ${task.title}`}
          className="absolute inset-0 z-0 rounded-2xl focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none disabled:cursor-not-allowed"
        />
      )}

      <article className="pointer-events-none relative z-10 flex h-full flex-col gap-2 p-4">
        <div className="flex items-start gap-2">
          <h3
            className="line-clamp-2 min-w-0 flex-1 text-sm leading-snug font-semibold text-app-text"
            title={task.title}
          >
            {task.title}
          </h3>
          {canOpen && (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-app-text-muted">
              {isOpening ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <PencilLine className="h-4 w-4" aria-hidden="true" />
              )}
            </span>
          )}
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
function PoolListRow({ task, canOpen, isOpening, isBusy, onOpen }: PoolTaskProps) {
  const description = task.summary?.trim();

  return (
    <li className="group relative h-full" data-testid={`pool-list-task-${task.id}`}>
      {canOpen && (
        <button
          type="button"
          disabled={isBusy}
          onClick={() => onOpen(task)}
          aria-label={`Edit orientation for ${task.title}`}
          className="absolute inset-0 z-0 rounded-2xl focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none disabled:cursor-not-allowed"
        />
      )}

      {/* h-full so that side by side in the full-width grid, the row's two cards match the taller
          one's height; in the single stacked column it is a no-op. */}
      <div className="pointer-events-none relative z-10 flex h-full items-start gap-3 rounded-2xl border border-app-border bg-app-surface p-4 transition-colors group-hover:border-app-border-strong">
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

        {canOpen && (
          <span className="flex shrink-0 items-center gap-2 self-center text-app-text-muted">
            {isOpening ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <PencilLine className="h-4 w-4" aria-hidden="true" />
            )}
            <ChevronRight className="h-4 w-4 text-app-text-disabled" aria-hidden="true" />
          </span>
        )}
      </div>
    </li>
  );
}

/**
 * The reviewed starter-work pool with interchangeable cloud and list views.
 *
 * Cloud cards use one of five compositions and list rows deliberately mirror the issue browser.
 * Both representations make the whole task surface the orientation trigger, while HR keeps a
 * non-interactive read-only view matching the backend's authoring permissions.
 */
export function StarterWorkPoolCloud({
  tasks,
  isLoading,
  error,
  canAct,
  fullWidth = false,
}: StarterWorkPoolCloudProps) {
  const { selectedProjectId } = useProjectContext();
  const prefersReducedMotion = useReducedMotion();
  const { error: showErrorToast } = useToast();

  const [view, setView] = useState<PoolView>("cloud");
  const [layoutIndex, setLayoutIndex] = useState(0);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{
    task: StarterWorkTask;
    orientation: MyOrientation;
  } | null>(null);
  const [page, setPage] = useState(1);

  const listPageSize = fullWidth ? LIST_PAGE_SIZE_WIDE : LIST_PAGE_SIZE;
  const cloudPageSize = fullWidth ? CLOUD_PAGE_SIZE_WIDE : CLOUD_PAGE_SIZE;
  const pageSize = view === "cloud" ? cloudPageSize : listPageSize;
  const totalPages = Math.max(1, Math.ceil(tasks.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(
    () => tasks.slice((safePage - 1) * pageSize, safePage * pageSize),
    [tasks, safePage, pageSize],
  );

  useEffect(() => {
    if (!error) return;
    showErrorToast("Pool unavailable", { description: error });
  }, [error, showErrorToast]);

  const openEditor = async (task: StarterWorkTask) => {
    if (!selectedProjectId) return;
    setOpeningId(task.id);
    try {
      const orientation = await orientationService.fetchTaskOrientation(task.id, selectedProjectId);
      setEditing({ task, orientation });
    } catch (err) {
      showErrorToast("Orientation unavailable", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setOpeningId(null);
    }
  };

  const changeView = (nextView: PoolView) => {
    setView(nextView);
    setPage(1);
  };

  const changePage = (nextPage: number) => {
    if (nextPage === safePage) return;
    setPage(nextPage);
    if (view === "cloud") setLayoutIndex((current) => nextCloudLayout(current));
  };

  const canOpenTask = canAct && Boolean(selectedProjectId);

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

        <div
          className="ml-auto flex items-center gap-1 rounded-xl border border-app-border bg-app-surface-muted p-1"
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

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-app-text-muted">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState icon={<PackageOpen className="h-8 w-8" aria-hidden="true" />}>
          Nothing has been vouched for yet. Review a task on the left and it lands here.
        </EmptyState>
      ) : (
        <>
          {view === "cloud" ? (
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
                        <PoolCloudCard
                          task={task}
                          canOpen={canOpenTask}
                          isOpening={openingId === task.id}
                          isBusy={openingId !== null}
                          onOpen={(selected) => void openEditor(selected)}
                        />
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
                <PoolListRow
                  key={task.id}
                  task={task}
                  canOpen={canOpenTask}
                  isOpening={openingId === task.id}
                  isBusy={openingId !== null}
                  onOpen={(selected) => void openEditor(selected)}
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
