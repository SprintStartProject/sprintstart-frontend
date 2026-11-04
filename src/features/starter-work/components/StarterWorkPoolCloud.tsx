import { useEffect, useState } from "react";
import { useToast } from "../../../context/useToast";
import { useDelayedFlag } from "../../../hooks/useDelayedFlag";
import { useIsSmUp } from "../../../hooks/useIsSmUp";
import { useProjectContext } from "../../projects";
import type { StarterWorkTask } from "../types";
import { CLOUD_LAYOUTS, CLOUD_PAGE_SIZE, LIST_PAGE_SIZE } from "./pool/cloudLayout";
import { PoolBody } from "./pool/PoolBody";
import { PoolFilterBar } from "./pool/PoolFilterBar";
import { PoolHeader } from "./pool/PoolHeader";
import { usePoolControls } from "./pool/usePoolControls";
import { useProjectGroupKeys, usePoolTasks } from "./pool/usePoolTasks";

type StarterWorkPoolCloudProps = {
  /** The whole live pool — reviewed and not. */
  tasks: StarterWorkTask[];
  isLoading: boolean;
  error: string | null;
  /** HR reads the pool; only PM/ADMIN can act from the task's detail drawer. */
  canAct: boolean;
  /** Reconciles the pool against its trackers now. Omitted hides the sync control entirely. */
  onSync?: () => void;
  isSyncing?: boolean;
  /** Opens the task's detail drawer. Every task opens it, HR included — the drawer itself is read-only for them. */
  onOpenTask: (task: StarterWorkTask) => void;
  /**
   * Tasks reconciliation found closed at their source — shown under the "Closed" filter tab
   * instead of a separate box under the pool. Not sticky: a task leaves this list on its own once
   * its source issue reopens. Defaults to empty, which simply keeps the tab hidden.
   */
  closedTasks?: StarterWorkTask[];
  isClosedLoading?: boolean;
};

/**
 * The reviewed starter-work pool with interchangeable cloud and list views.
 *
 * The cloud lays its cards out as a real CSS grid (see `PoolCloudGrid`); list rows share the same
 * content structure in the issue browser's row language. Both representations make the whole task
 * surface the drawer trigger — HR opens the same read-only drawer, matching the backend's
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
  closedTasks = [],
  isClosedLoading = false,
}: StarterWorkPoolCloudProps) {
  const { selectedProjectId, selectedProject } = useProjectContext();
  const { error: showErrorToast } = useToast();
  const showLoadingSkeleton = useDelayedFlag(isLoading);
  const showClosedLoadingSkeleton = useDelayedFlag(isClosedLoading);
  const controls = usePoolControls();
  const projectGroupKeys = useProjectGroupKeys(selectedProjectId);
  const { lastCheckedAt, statusCounts, filteredTasks } = usePoolTasks({
    tasks,
    closedTasks,
    onlyProject: controls.onlyProject,
    statusFilter: controls.statusFilter,
    projectGroupKeys,
  });

  // The cloud only reads as a cloud once there is room to scatter its cards. Below `sm` there is
  // not, so the pool falls back to the list regardless of the picked view, and the view toggle is
  // hidden. `view` still holds the desktop choice, so widening the window restores the cloud.
  const isSmUp = useIsSmUp();
  const effectiveView = isSmUp ? controls.view : "list";

  // Which of the five scattered arrangements is showing: a fresh pick each time the pool mounts,
  // then cycling to the next one as the reader pages, so paging through never repeats a shape.
  const [cloudLayoutSeed] = useState(() => Math.floor(Math.random() * CLOUD_LAYOUTS.length));

  const isViewingClosed = controls.statusFilter === "closed";
  const pageSize = effectiveView === "cloud" ? CLOUD_PAGE_SIZE : LIST_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / pageSize));
  const safePage = Math.min(controls.page, totalPages);
  const pageItems = filteredTasks.slice((safePage - 1) * pageSize, safePage * pageSize);
  const cloudLayout = CLOUD_LAYOUTS[(cloudLayoutSeed + (safePage - 1)) % CLOUD_LAYOUTS.length];

  useEffect(() => {
    if (!error) return;
    showErrorToast("Pool unavailable", { description: error });
  }, [error, showErrorToast]);

  const changePage = (nextPage: number) => {
    if (nextPage === safePage) return;
    controls.setPage(nextPage);
  };

  return (
    <section className="@container" data-testid="starter-work-pool" aria-label="Tasks in the pool">
      <PoolHeader
        taskCount={tasks.length}
        lastCheckedAt={lastCheckedAt}
        canSync={canAct}
        isSyncing={isSyncing}
        onSync={onSync}
        view={controls.view}
        onChangeView={controls.changeView}
      />

      <p className="mb-4 text-sm text-app-text-subtle">
        Visible to every new hire on this project, claimable the moment it lands here.
      </p>

      <PoolFilterBar
        statusFilter={controls.statusFilter}
        counts={statusCounts}
        onChangeStatusFilter={controls.changeStatusFilter}
        scopeProjectName={
          selectedProject && projectGroupKeys.size > 0 ? selectedProject.name : undefined
        }
        onlyProject={controls.onlyProject}
        onToggleOnlyProject={controls.toggleOnlyProject}
      />

      {isViewingClosed && (
        <p className="mb-4 text-sm text-app-text-subtle">
          These came back closed from their tracker. They return to the pool on their own if the
          issue reopens.
        </p>
      )}

      <PoolBody
        showSkeleton={isViewingClosed ? showClosedLoadingSkeleton : showLoadingSkeleton}
        isLoading={isViewingClosed ? isClosedLoading : isLoading}
        isViewingClosed={isViewingClosed}
        poolSize={tasks.length}
        filteredCount={filteredTasks.length}
        pageItems={pageItems}
        view={effectiveView}
        cloudLayout={cloudLayout}
        page={safePage}
        totalPages={totalPages}
        onPageChange={changePage}
        onOpenTask={onOpenTask}
      />
    </section>
  );
}
