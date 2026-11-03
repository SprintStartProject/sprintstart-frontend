import { Search } from "lucide-react";
import { Input } from "../../../components/ui/Input";
import { SaveButton } from "../../../components/ui/SaveButton";
import { PmFilterChip } from "../pmKit";
import type { MemberFilter } from "../roleRules";
import type { TeamOverviewUser } from "../types";
import { MemberRow } from "./MemberRow";

type MemberAssignmentListProps = {
  roleName: string;
  /** Everyone in the project, after the search and the filter. */
  visibleMembers: TeamOverviewUser[];
  totalMembers: number;
  selectedUserIds: string[];
  originalUserIds: string[];
  /** Members who hold no role at all, for the filter's count. */
  withoutRoleCount: number;
  query: string;
  filter: MemberFilter | null;
  saving: boolean;
  changeCount: number;
  onQueryChange: (query: string) => void;
  onFilterChange: (filter: MemberFilter | null) => void;
  onToggle: (userId: string) => void;
  onReset: () => void;
  onSave: () => void;
};

type MemberSearchProps = Pick<
  MemberAssignmentListProps,
  "query" | "filter" | "originalUserIds" | "withoutRoleCount" | "onQueryChange" | "onFilterChange"
>;

/**
 * Search and narrow the people, for a team too large to scan. Search sits on a line of its own,
 * the filters under it: side by side they were squeezed into the members column.
 */
function MemberSearch({
  query,
  filter,
  originalUserIds,
  withoutRoleCount,
  onQueryChange,
  onFilterChange,
}: MemberSearchProps) {
  return (
    <div className="mt-4 space-y-2">
      <div className="min-w-0">
        <Input
          size="sm"
          icon={<Search className="h-4 w-4" />}
          aria-label="Search members"
          placeholder="Search members…"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </div>
      <div role="group" aria-label="Show members" className="flex flex-wrap gap-2">
        {/* Pressing the chosen one again lets go of it, back to everyone. */}
        <PmFilterChip
          active={filter === "holds"}
          onClick={() => onFilterChange(filter === "holds" ? null : "holds")}
          label="Has this role"
          count={originalUserIds.length}
        />
        <PmFilterChip
          active={filter === "without"}
          onClick={() => onFilterChange(filter === "without" ? null : "without")}
          label="Without a role"
          count={withoutRoleCount}
          flagged
        />
      </div>
    </div>
  );
}

type MemberPickListProps = Pick<
  MemberAssignmentListProps,
  "visibleMembers" | "totalMembers" | "selectedUserIds" | "originalUserIds" | "saving" | "onToggle"
>;

/** A list like every other in the area, one row per person. */
function MemberPickList({
  visibleMembers,
  totalMembers,
  selectedUserIds,
  originalUserIds,
  saving,
  onToggle,
}: MemberPickListProps) {
  return (
    <ul className="mt-3 divide-y divide-app-border-muted overflow-hidden rounded-xl border border-app-border bg-app-surface">
      {visibleMembers.map((user) => (
        <MemberRow
          key={user.userId}
          user={user}
          checked={selectedUserIds.includes(user.userId)}
          heldBefore={originalUserIds.includes(user.userId)}
          disabled={saving}
          onToggle={onToggle}
        />
      ))}

      {totalMembers === 0 ? (
        <li className="px-3 py-3 text-xs text-app-text-muted">No members in this project yet.</li>
      ) : (
        visibleMembers.length === 0 && (
          <li className="px-3 py-3 text-xs text-app-text-muted">Nobody matches.</li>
        )
      )}
    </ul>
  );
}

type AssignmentActionsProps = Pick<
  MemberAssignmentListProps,
  "saving" | "changeCount" | "onReset" | "onSave"
>;

/**
 * Below the list, not above it: the buttons act on choices made in the list, so they should be
 * where the eye ends up rather than where it started.
 */
function AssignmentActions({ saving, changeCount, onReset, onSave }: AssignmentActionsProps) {
  return (
    <div className="mt-4 flex items-center justify-end gap-2">
      <button
        type="button"
        onClick={onReset}
        disabled={changeCount === 0 || saving}
        className="rounded-xl border border-app-border bg-app-bg px-3 py-2 text-sm text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text disabled:cursor-not-allowed disabled:opacity-50"
      >
        Reset
      </button>

      <SaveButton
        dirty={changeCount > 0}
        saving={saving}
        onClick={onSave}
        label={`Save ${changeCount} ${changeCount === 1 ? "change" : "changes"}`}
      />
    </div>
  );
}

/**
 * The members of the open role: a search and two filters over a list of ticks, and the buttons
 * that send the difference. Selection is diff-based, so confirming sends only what changed.
 */
export function MemberAssignmentList(props: MemberAssignmentListProps) {
  return (
    <div className="min-w-0">
      <h4 className="text-sm font-semibold text-app-text">Members</h4>
      <p className="mt-1 text-xs leading-relaxed text-app-text-muted">
        Ticked members hold {props.roleName}. Untick to take it away —{" "}
        {props.selectedUserIds.length} selected.
      </p>
      <MemberSearch {...props} />
      <MemberPickList {...props} />
      <AssignmentActions {...props} />
    </div>
  );
}
