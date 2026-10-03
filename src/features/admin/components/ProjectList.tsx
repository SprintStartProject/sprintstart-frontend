import { AlertTriangle, ShieldCheck } from "lucide-react";
import { Badge } from "../../../components/ui/Badge";
import { ProjectMonogram } from "../../projects/components/ProjectMonogram";
import type { ProjectSummary } from "../types";
import { AccessBadge } from "./Badges";

type ProjectListProps = {
  projects: ProjectSummary[];
  /** Projects the person manages; they get a shield so the role is visible in the table. */
  managedProjectIds?: Set<string>;
  max?: number;
};

/**
 * A user's projects as monogram chips for the user table.
 *
 * Someone in no project gets a warning badge instead of plain text, since a
 * user without a project cannot use project knowledge or onboarding at all.
 */
export function ProjectList({ projects, managedProjectIds, max = 2 }: ProjectListProps) {
  if (projects.length === 0) {
    return (
      <Badge variant="warning" size="sm" className="py-1">
        <AlertTriangle className="mr-1 h-3 w-3" aria-hidden="true" />
        No project
      </Badge>
    );
  }

  return (
    <div className="flex min-w-0 flex-wrap gap-2">
      {projects.slice(0, max).map((project) => (
        <AccessBadge key={project.id} variant="neutral">
          <ProjectMonogram
            projectId={project.id}
            name={project.name}
            size="xs"
            className="mr-1.5 -ml-1.5"
          />
          {project.name}
          {managedProjectIds?.has(project.id) && (
            <ShieldCheck className="ml-1 h-3 w-3 shrink-0" role="img" aria-label="Manager" />
          )}
        </AccessBadge>
      ))}

      {projects.length > max && (
        <AccessBadge variant="neutral">+{projects.length - max}</AccessBadge>
      )}
    </div>
  );
}
