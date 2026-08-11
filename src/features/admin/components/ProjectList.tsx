import type { ProjectSummary } from "../types";
import { AccessBadge } from "./Badges";

type ProjectListProps = {
  projects: ProjectSummary[];
  max?: number;
};

export function ProjectList({ projects, max = 2 }: ProjectListProps) {
  if (projects.length === 0) {
    return <span className="text-sm text-app-text-muted">No projects</span>;
  }

  return (
    <div className="flex min-w-0 flex-wrap gap-2">
      {projects.slice(0, max).map((project) => (
        <AccessBadge key={project.id} variant="neutral">
          {project.name}
        </AccessBadge>
      ))}

      {projects.length > max && (
        <AccessBadge variant="neutral">+{projects.length - max}</AccessBadge>
      )}
    </div>
  );
}
