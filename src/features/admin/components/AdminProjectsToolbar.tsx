import { Plus, Search } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { FilterSelect } from "../../../components/ui/FilterSelect";
import { Input } from "../../../components/ui/Input";
import { PROJECT_FILTER_OPTIONS, pluralize } from "../data";
import type { ProjectFilter } from "../types";

type AdminProjectsToolbarProps = {
  projectCount: number;
  projectSearchValue: string;
  projectFilter: ProjectFilter;
  onProjectSearchChange: (value: string) => void;
  onProjectFilterChange: (filter: ProjectFilter) => void;
  onCreateProject: () => void;
};

export function AdminProjectsToolbar({
  projectCount,
  projectSearchValue,
  projectFilter,
  onProjectSearchChange,
  onProjectFilterChange,
  onCreateProject,
}: AdminProjectsToolbarProps) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm font-semibold text-app-text">
        {pluralize(projectCount, "project")}
      </span>

      <div className="flex flex-row items-center gap-2 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1 sm:w-64 sm:min-w-[auto] sm:flex-initial">
          <Input
            value={projectSearchValue}
            onChange={(event) => onProjectSearchChange(event.target.value)}
            placeholder="Search projects..."
            aria-label="Search projects"
            icon={<Search className="h-4 w-4" />}
          />
        </div>

        <FilterSelect
          label="Filter projects"
          value={projectFilter}
          options={PROJECT_FILTER_OPTIONS}
          onChange={onProjectFilterChange}
          className="w-36 sm:w-56"
        />

        <Button
          variant="primary"
          onClick={onCreateProject}
          icon={<Plus className="h-4 w-4" />}
          className="w-auto shrink-0 sm:w-auto sm:shrink"
        >
          New Project
        </Button>
      </div>
    </div>
  );
}
