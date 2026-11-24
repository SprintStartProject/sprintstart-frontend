import { PackageOpen } from "lucide-react";
import { EmptyState } from "../../../../components/ui/EmptyState";
import { Pagination } from "../../../../components/ui/Pagination";
import { SkeletonGroup } from "../../../../components/ui/Skeleton";
import type { StarterWorkTask } from "../../../../services/starterWorkTypes";
import type { CloudSlotStyle } from "./cloudLayout";
import { PoolCloudGrid } from "./PoolCloudGrid";
import { PoolListRow } from "./PoolListRow";
import { PoolRowSkeleton } from "./PoolTaskParts";
import type { PoolView } from "./poolTypes";

type PoolBodyProps = {
  /** True once the loading skeleton should show (after its short delay). */
  showSkeleton: boolean;
  isLoading: boolean;
  isViewingClosed: boolean;
  /** Tasks in the whole live pool, before any filter. */
  poolSize: number;
  filteredCount: number;
  pageItems: StarterWorkTask[];
  view: PoolView;
  cloudLayout: CloudSlotStyle[];
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onOpenTask: (task: StarterWorkTask) => void;
};

function EmptyPool({ children }: { children: string }) {
  return (
    <EmptyState icon={<PackageOpen className="h-8 w-8" aria-hidden="true" />}>
      {children}
    </EmptyState>
  );
}

function PoolList({
  items,
  closed,
  onOpen,
}: {
  items: StarterWorkTask[];
  closed: boolean;
  onOpen: (task: StarterWorkTask) => void;
}) {
  return (
    <ul
      className="divide-y divide-app-border overflow-hidden rounded-2xl border border-app-border bg-app-surface"
      data-testid="pool-task-list"
      data-pool-flight-target
    >
      {items.map((task) => (
        <PoolListRow key={task.id} task={task} onOpen={onOpen} closed={closed} />
      ))}
    </ul>
  );
}

/** What sits under the filters: skeleton, one of two empty states, or a page of cloud/list plus pagination. */
export function PoolBody(props: PoolBodyProps) {
  if (props.showSkeleton) {
    return (
      <SkeletonGroup
        label="Loading the pool"
        className="divide-y divide-app-border overflow-hidden rounded-2xl border border-app-border bg-app-surface"
      >
        {Array.from({ length: 6 }).map((_, index) => (
          <PoolRowSkeleton key={index} />
        ))}
      </SkeletonGroup>
    );
  }
  if (props.isLoading) return null;
  if (!props.isViewingClosed && props.poolSize === 0) {
    return (
      <EmptyPool>
        Nothing here yet. Mine or add a task and it lands here, claimable right away.
      </EmptyPool>
    );
  }
  if (props.filteredCount === 0) return <EmptyPool>No tasks match this filter.</EmptyPool>;

  return (
    <>
      {props.view === "cloud" ? (
        <PoolCloudGrid
          items={props.pageItems}
          layout={props.cloudLayout}
          closed={props.isViewingClosed}
          onOpen={props.onOpenTask}
        />
      ) : (
        <PoolList
          items={props.pageItems}
          closed={props.isViewingClosed}
          onOpen={props.onOpenTask}
        />
      )}
      <Pagination
        currentPage={props.page}
        totalPages={props.totalPages}
        onPageChange={props.onPageChange}
        className="mt-5"
      />
    </>
  );
}
