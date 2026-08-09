import { Plus, Search } from "lucide-react";
import { Button } from "../../../components/ui/Button";

type AdminProjectsToolbarProps = {
  projectCount: number;
  projectSearchValue: string;
  onProjectSearchChange: (value: string) => void;
  onCreateProject: () => void;
};

export function AdminProjectsToolbar({
  projectCount,
  projectSearchValue,
  onProjectSearchChange,
  onCreateProject,
}: AdminProjectsToolbarProps) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm font-semibold text-app-text">
        {projectCount} projects
      </span>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-text-disabled" />
          <input
            value={projectSearchValue}
            onChange={(event) => onProjectSearchChange(event.target.value)}
            placeholder="Search projects..."
            aria-label="Search projects"
            className="h-11 w-full rounded-xl border border-app-border bg-app-surface pl-10 pr-4 text-sm text-app-text outline-none placeholder:text-app-text-disabled focus:border-app-brand-border-strong focus:ring-2 focus:ring-app-brand-glow"
          />
        </div>

        <Button
          variant="primary"
          onClick={onCreateProject}
          icon={<Plus className="h-4 w-4" />}
          className="w-full sm:w-auto"
        >
          New Project
        </Button>
      </div>
    </div>
  );
}
