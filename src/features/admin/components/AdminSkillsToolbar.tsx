import { useId, useState } from "react";
import { ChevronDown, Plus, Search, SlidersHorizontal } from "lucide-react";
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

/**
 * Toolbar above the Skills table: search, status/category/role filters, and creating a skill.
 *
 * From `sm` up everything sits in one row. Below it, three dropdowns plus a search
 * field and a button cannot share a row, so the search gets its own row and the
 * dropdowns fold behind a "Filters" disclosure next to the primary button. The
 * disclosure shows how many filters are active, because a collapsed filter that is
 * narrowing the table without saying so reads as missing data.
 */
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
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const filtersPanelId = useId();

  const categoryFilterOptions = [
    { value: "all", label: "All categories" },
    ...categoryOptions.map((category) => ({ value: category, label: category })),
  ];
  const roleFilterOptions = [
    { value: "all", label: "All roles" },
    ...roleOptions.map((role) => ({ value: role.id, label: role.name })),
  ];

  const activeFilterCount = [statusFilter, categoryFilter, roleFilter].filter(
    (value) => value !== "all",
  ).length;

  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm font-semibold text-app-text">{skillCount} skills</span>

      {/* DOM order is the desktop order (search, filters, button). Below `sm` the
          `max-sm:order-*` classes rearrange it into search / toggle + button / panel. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full min-w-0 sm:w-56">
          <Input
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search skills..."
            aria-label="Search skills"
            icon={<Search className="h-4 w-4" />}
          />
        </div>

        <Button
          variant="secondary"
          onClick={() => setIsFiltersOpen((open) => !open)}
          aria-expanded={isFiltersOpen}
          aria-controls={filtersPanelId}
          icon={<SlidersHorizontal className="h-4 w-4" />}
          trailingIcon={
            <ChevronDown
              aria-hidden="true"
              className={`h-4 w-4 transition-transform duration-200 ${
                isFiltersOpen ? "rotate-180" : ""
              }`}
            />
          }
          className="min-w-0 flex-1 max-sm:order-1 sm:hidden"
          data-testid="skills-filters-toggle"
        >
          Filters
          {activeFilterCount > 0 && (
            <>
              <span
                aria-hidden="true"
                className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-app-brand px-1.5 text-xs font-semibold text-white"
              >
                {activeFilterCount}
              </span>
              <span className="sr-only">{activeFilterCount} active</span>
            </>
          )}
        </Button>

        <div
          id={filtersPanelId}
          className={`${isFiltersOpen ? "flex" : "hidden"} w-full flex-col gap-2 max-sm:order-3 sm:contents`}
        >
          <FilterSelect
            label="Filter skills by status"
            value={statusFilter}
            options={SKILL_STATUS_FILTER_OPTIONS}
            onChange={onStatusFilterChange}
            className="w-full sm:w-36"
          />

          <FilterSelect
            label="Filter skills by category"
            value={categoryFilter}
            options={categoryFilterOptions}
            onChange={onCategoryFilterChange}
            className="w-full sm:w-44"
          />

          <FilterSelect
            label="Filter skills by role"
            value={roleFilter}
            options={roleFilterOptions}
            onChange={onRoleFilterChange}
            className="w-full sm:w-44"
          />
        </div>

        <Button
          variant="primary"
          onClick={onCreateSkill}
          icon={<Plus className="h-4 w-4" />}
          className="min-w-0 flex-1 max-sm:order-2 sm:flex-none sm:shrink-0"
        >
          New skill
        </Button>
      </div>
    </div>
  );
}
