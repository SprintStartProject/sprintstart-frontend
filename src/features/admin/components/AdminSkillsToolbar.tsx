import { Plus, Search } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { FilterSelect } from "../../../components/ui/FilterSelect";
import { Input } from "../../../components/ui/Input";
import { SKILL_STATUS_FILTER_OPTIONS } from "../data";
import type { ProjectRole, SkillStatusFilter } from "../types";

type AdminSkillsToolbarProps = {
  skillCount: number;
  searchValue: string;
  statusFilter: SkillStatusFilter;
  categoryFilter: string;
  categoryOptions: string[];
  roleFilter: string;
  roleOptions: ProjectRole[];
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: SkillStatusFilter) => void;
  onCategoryFilterChange: (value: string) => void;
  onRoleFilterChange: (value: string) => void;
  onCreateSkill: () => void;
};

/** Toolbar above the Skills table: search, status/category/role filters, and creating a skill. */
export function AdminSkillsToolbar({
  skillCount,
  searchValue,
  statusFilter,
  categoryFilter,
  categoryOptions,
  roleFilter,
  roleOptions,
  onSearchChange,
  onStatusFilterChange,
  onCategoryFilterChange,
  onRoleFilterChange,
  onCreateSkill,
}: AdminSkillsToolbarProps) {
  const categoryFilterOptions = [
    { value: "all", label: "All categories" },
    ...categoryOptions.map((category) => ({ value: category, label: category })),
  ];
  const roleFilterOptions = [
    { value: "all", label: "All roles" },
    ...roleOptions.map((role) => ({ value: role.id, label: role.name })),
  ];

  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm font-semibold text-app-text">{skillCount} skills</span>

      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1 sm:w-56 sm:min-w-[auto] sm:flex-initial">
          <Input
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search skills..."
            aria-label="Search skills"
            icon={<Search className="h-4 w-4" />}
          />
        </div>

        <FilterSelect
          label="Filter skills by status"
          value={statusFilter}
          options={SKILL_STATUS_FILTER_OPTIONS}
          onChange={onStatusFilterChange}
          className="w-32 sm:w-36"
        />

        <FilterSelect
          label="Filter skills by category"
          value={categoryFilter}
          options={categoryFilterOptions}
          onChange={onCategoryFilterChange}
          className="w-36 sm:w-44"
        />

        <FilterSelect
          label="Filter skills by role"
          value={roleFilter}
          options={roleFilterOptions}
          onChange={onRoleFilterChange}
          className="w-36 sm:w-44"
        />

        <Button
          variant="primary"
          onClick={onCreateSkill}
          icon={<Plus className="h-4 w-4" />}
          className="w-auto shrink-0 sm:w-auto sm:shrink"
        >
          New skill
        </Button>
      </div>
    </div>
  );
}
