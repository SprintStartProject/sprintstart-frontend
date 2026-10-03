import { ChevronRight, Database, FolderKanban, ShieldCheck, Tag, Users } from "lucide-react";
import { EmptyState } from "../../../components/ui/EmptyState";
import { getProjectSourcesCount, getProjectUsersCount, pluralize } from "../data";
import type { ProjectManager } from "../../../services/projectService";
import { ProjectMonogram } from "../../projects/components/ProjectMonogram";
import type { ProjectOverview } from "../types";
import { SourceTypeChips } from "./SourceTypeChips";

type ProjectsTabProps = {
  filteredProjects: ProjectOverview[];
  onOpenProjectDetails: (project: ProjectOverview) => void;
  hasSearchQuery?: boolean;
  totalCount?: number;
};

/** Manager display name, falling back to the username when no name is set. */
function getManagerName(manager: ProjectManager) {
  const fullName = [manager.firstName, manager.lastName].filter(Boolean).join(" ");

  return fullName || manager.username;
}

export function ProjectsTab({
  filteredProjects,
  onOpenProjectDetails,
  hasSearchQuery,
  totalCount,
}: ProjectsTabProps) {
  if (filteredProjects.length === 0) {
    const noProjectsExist = totalCount !== undefined && totalCount === 0;

    return (
      <EmptyState
        icon={<FolderKanban className="h-8 w-8" aria-hidden="true" />}
        title={noProjectsExist ? "No projects yet" : "No projects found"}
      >
        {noProjectsExist
          ? "Create your first project to get started."
          : hasSearchQuery
            ? "Try adjusting your search term."
            : "Try another search term or create a new project first."}
      </EmptyState>
    );
  }

  return (
    <div className="space-y-3">
      {filteredProjects.map((project) => {
        return (
          <button
            key={project.id}
            type="button"
            onClick={() => onOpenProjectDetails(project)}
            // Lifted rather than scaled on hover. Scaling resamples the card's
            // 1px border from the pre-scale bitmap, and on a row this wide that
            // reads as the outline thinning out and partly vanishing. A
            // translation moves the same crisp pixels.
            className="group flex w-full cursor-pointer flex-row items-start gap-3 overflow-hidden rounded-2xl border border-app-border bg-app-surface p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-app-brand-border-strong hover:bg-app-surface-hover hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-app-brand-glow motion-reduce:hover:translate-y-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:p-5"
            aria-label={`Open details for ${project.name}`}
          >
            <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
              <ProjectMonogram projectId={project.id} name={project.name} size="md" />

              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold break-words text-app-text">
                    {project.name}
                  </span>
                </div>

                <p className="line-clamp-2 text-sm leading-relaxed text-app-text-muted">
                  {project.description || "No project description available yet."}
                </p>

                <SourceTypeChips sources={project.sources} className="mt-3" />

                <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-app-text-muted">
                  <span className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    {pluralize(getProjectUsersCount(project), "member")}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Database className="h-3.5 w-3.5" />
                    {pluralize(getProjectSourcesCount(project), "source")}
                  </span>
                  {/* Spelled out even when unset: a project without a manager
                      is the state an admin most needs to spot from the list. */}
                  <span className="flex min-w-0 items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                      {project.manager ? getManagerName(project.manager) : "No manager"}
                    </span>
                  </span>
                  <span className="flex min-w-0 items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{project.industry || "No industry"}</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex h-11 w-11 shrink-0 items-center justify-center self-center rounded-xl text-app-text-muted transition-colors group-hover:text-app-text">
              <ChevronRight className="h-4 w-4" />
            </div>
          </button>
        );
      })}
    </div>
  );
}
