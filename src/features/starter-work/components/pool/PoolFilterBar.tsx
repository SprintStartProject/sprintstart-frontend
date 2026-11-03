import { Archive } from "lucide-react";
import { Button } from "../../../../components/ui/Button";
import { SegmentedTabs, type SegmentedTabOption } from "../../../../components/ui/SegmentedTabs";
import {
  STATUS_FILTER_LABELS,
  visibleStatusFilters,
  type PoolStatusCounts,
  type PoolStatusFilter,
} from "./poolRules";

type PoolFilterBarProps = {
  statusFilter: PoolStatusFilter;
  counts: PoolStatusCounts;
  onChangeStatusFilter: (filter: PoolStatusFilter) => void;
  /** The selected project's name; omitted (or with no corpus groups) hides the scope button. */
  scopeProjectName?: string;
  onlyProject: boolean;
  onToggleOnlyProject: () => void;
};

function tabOptions(
  statusFilter: PoolStatusFilter,
  counts: PoolStatusCounts,
): SegmentedTabOption<PoolStatusFilter>[] {
  return visibleStatusFilters(counts.closed, statusFilter).map((value) => ({
    value,
    label: STATUS_FILTER_LABELS[value],
    icon: value === "closed" ? <Archive className="h-3.5 w-3.5" aria-hidden="true" /> : undefined,
    count: counts[value],
  }));
}

/** The status tabs and, when the project has a corpus, the "Only {project}" scope button. */
export function PoolFilterBar({
  statusFilter,
  counts,
  onChangeStatusFilter,
  scopeProjectName,
  onlyProject,
  onToggleOnlyProject,
}: PoolFilterBarProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <SegmentedTabs
        value={statusFilter}
        options={tabOptions(statusFilter, counts)}
        onChange={onChangeStatusFilter}
        layoutId="starter-work-pool-status-pill"
        ariaLabel="Filter pool tasks"
      />
      {scopeProjectName !== undefined && (
        <Button
          variant={onlyProject ? "secondary" : "ghost"}
          size="sm"
          aria-pressed={onlyProject}
          onClick={onToggleOnlyProject}
        >
          Only {scopeProjectName}
        </Button>
      )}
    </div>
  );
}
