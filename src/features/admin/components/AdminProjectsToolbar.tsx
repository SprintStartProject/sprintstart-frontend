import { Plus, Search } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";

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
      <span className="text-sm font-semibold text-app-text">{projectCount} projects</span>

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
