import { FilterSelect, type FilterSelectOption } from "../../../components/ui/FilterSelect";
import type { TeamOverviewFilters, ProjectRole } from "../types";

type SortOption = TeamOverviewFilters["sortBy"];

const SORT_OPTIONS: FilterSelectOption<SortOption>[] = [
  { value: "LONGEST_STEP", label: "Longest on step" },
  { value: "SHORTEST_STEP", label: "Shortest on step" },
  { value: "HIGHEST_PROGRESS", label: "Highest progress" },
  { value: "LOWEST_PROGRESS", label: "Lowest progress" },
];

type TeamMemberFiltersProps = {
  roles: ProjectRole[];
  filters: TeamOverviewFilters;
  onFiltersChange: (filters: TeamOverviewFilters) => void;
};

export function TeamMemberFilters({ roles, filters, onFiltersChange }: TeamMemberFiltersProps) {
  const roleOptions: FilterSelectOption<string>[] = [
    { value: "all", label: "All roles" },
    ...(roles || []).map((role) => ({ value: role.id, label: role.name })),
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <FilterSelect
        label="Filter team members by role"
        value={filters.roleId}
        options={roleOptions}
        onChange={(roleId) => onFiltersChange({ ...filters, roleId })}
        className="w-44"
      />

      <FilterSelect
        label="Sort team members"
        value={filters.sortBy}
        options={SORT_OPTIONS}
        onChange={(sortBy) => onFiltersChange({ ...filters, sortBy })}
        className="w-48"
      />
    </div>
  );
}
