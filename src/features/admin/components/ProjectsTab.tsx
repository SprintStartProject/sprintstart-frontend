import { ChevronRight, FileText, Folder, Users } from "lucide-react";
import { getProjectSourcesCount, getProjectUsersCount } from "../data";
import type { ProjectOverview, ProjectSource } from "../types";
import { AccessBadge } from "./Badges";

type ProjectsTabProps = {
  filteredProjects: ProjectOverview[];
  onOpenProjectDetails: (project: ProjectOverview) => void;
  hasSearchQuery?: boolean;
  totalCount?: number;
};

function formatSourceType(type: string) {
  return type
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getSourceTypeBadges(sources: ProjectSource[]) {
  const countsByType = new Map<string, number>();

  sources.forEach((source) => {
    countsByType.set(source.type, (countsByType.get(source.type) ?? 0) + 1);
  });

  return Array.from(countsByType.entries()).map(([type, count]) => ({
    type,
    count,
    label: formatSourceType(type),
  }));
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
      <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-app-border bg-app-surface px-6 text-center">
        {noProjectsExist ? (
          <>
            <p className="text-base font-medium text-app-text">
              No projects yet
            </p>
            <p className="mt-1 text-sm text-app-text-muted">
              Create your first project to get started.
            </p>
          </>
        ) : hasSearchQuery ? (
          <>
            <p className="text-base font-medium text-app-text">
              No projects found
            </p>
            <p className="mt-1 text-sm text-app-text-muted">
              Try adjusting your search term.
            </p>
          </>
        ) : (
          <>
            <p className="text-base font-medium text-app-text">
              No projects found
            </p>
            <p className="mt-1 text-sm text-app-text-muted">
              Try another search term or create a new project first.
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {filteredProjects.map((project) => {
        const sourceTypeBadges = getSourceTypeBadges(project.sources);
        const visibleSourceTypeBadges = sourceTypeBadges.slice(0, 3);

        return (
          <button
            key={project.id}
            type="button"
            onClick={() => onOpenProjectDetails(project)}
            // Lifted rather than scaled on hover. Scaling resamples the card's
            // 1px border from the pre-scale bitmap, and on a row this wide that
            // reads as the outline thinning out and partly vanishing. A
            // translation moves the same crisp pixels.
            className="group flex w-full cursor-pointer flex-col gap-4 overflow-hidden rounded-2xl border border-app-border bg-app-surface p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-app-brand-border-strong hover:bg-app-surface-hover hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-app-brand-glow motion-reduce:hover:translate-y-0 sm:flex-row sm:items-start sm:justify-between sm:p-5"
            aria-label={`Open details for ${project.name}`}
          >
            <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-app-border bg-app-surface-muted text-app-text-muted">
                <Folder className="h-5 w-5" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="break-words text-sm font-semibold text-app-text">
                    {project.name}
                  </span>
                </div>

                <p className="line-clamp-2 text-sm leading-relaxed text-app-text-muted">
                  {project.description ||
                    "No project description available yet."}
                </p>

                {visibleSourceTypeBadges.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {visibleSourceTypeBadges.map((sourceType) => (
                      <AccessBadge key={sourceType.type} variant="neutral">
                        {sourceType.count > 1
                          ? `${sourceType.label} (${sourceType.count})`
                          : sourceType.label}
                      </AccessBadge>
                    ))}

                    {sourceTypeBadges.length >
                      visibleSourceTypeBadges.length && (
                      <AccessBadge variant="neutral">
                        +
                        {sourceTypeBadges.length -
                          visibleSourceTypeBadges.length}
                      </AccessBadge>
                    )}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-app-text-disabled">
                  <span className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    {getProjectUsersCount(project)} members
                  </span>
                  <span className="flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" />
                    {getProjectSourcesCount(project)} sources
                  </span>
                </div>
              </div>
            </div>

            <div className="flex h-11 w-11 shrink-0 items-center justify-center self-end rounded-xl text-app-text-muted transition-colors group-hover:text-app-text sm:self-center">
              <ChevronRight className="h-4 w-4" />
            </div>
          </button>
        );
      })}
    </div>
  );
}
