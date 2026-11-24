import { Plus, X } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { PmFilterChip, PmListToolbar } from "../pmKit";
import { ROLE_SORT_OPTIONS, type RoleGapFilter, type RoleSort } from "../roleRules";

type RoleListToolbarProps = {
  query: string;
  gap: RoleGapFilter | null;
  sort: RoleSort;
  shown: number;
  total: number;
  rolesWithoutMembers: number;
  rolesWithoutSkills: number;
  narrowed: boolean;
  creating: boolean;
  onQueryChange: (query: string) => void;
  onGapChange: (gap: RoleGapFilter | null) => void;
  onSortChange: (sort: RoleSort) => void;
  onReset: () => void;
  onToggleCreate: () => void;
};

type GapFiltersProps = Pick<
  RoleListToolbarProps,
  "gap" | "rolesWithoutMembers" | "rolesWithoutSkills" | "onGapChange"
>;

/** Pressing the chosen gap again lets go of it, back to every role. */
function GapFilters({
  gap,
  rolesWithoutMembers,
  rolesWithoutSkills,
  onGapChange,
}: GapFiltersProps) {
  return (
    <>
      <PmFilterChip
        active={gap === "no-members"}
        onClick={() => onGapChange(gap === "no-members" ? null : "no-members")}
        label="No members"
        count={rolesWithoutMembers}
        flagged
      />
      <PmFilterChip
        active={gap === "no-skills"}
        onClick={() => onGapChange(gap === "no-skills" ? null : "no-skills")}
        label="No skills"
        count={rolesWithoutSkills}
        flagged
      />
    </>
  );
}

/**
 * The roles list's toolbar, the same one the team, the questions and the gaps have. Creating is a
 * button in it that opens the form at the top of the list, rather than a column of its own beside
 * it: the list gets the full width, like every other list here.
 */
export function RoleListToolbar({
  query,
  gap,
  sort,
  shown,
  total,
  rolesWithoutMembers,
  rolesWithoutSkills,
  narrowed,
  creating,
  onQueryChange,
  onGapChange,
  onSortChange,
  onReset,
  onToggleCreate,
}: RoleListToolbarProps) {
  return (
    <PmListToolbar<RoleSort>
      search={{
        label: "Search roles",
        placeholder: "Search by role, skill or member…",
        value: query,
        onChange: onQueryChange,
      }}
      filtersLabel="Filter roles"
      filters={
        <GapFilters
          gap={gap}
          rolesWithoutMembers={rolesWithoutMembers}
          rolesWithoutSkills={rolesWithoutSkills}
          onGapChange={onGapChange}
        />
      }
      shown={shown}
      total={total}
      onReset={narrowed ? onReset : undefined}
      extra={
        <Button
          variant="primary"
          size="sm"
          icon={creating ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          onClick={onToggleCreate}
          aria-expanded={creating}
        >
          {creating ? "Cancel" : "New role"}
        </Button>
      }
      sort={{
        label: "Sort roles",
        value: sort,
        options: ROLE_SORT_OPTIONS,
        onChange: onSortChange,
      }}
    />
  );
}
