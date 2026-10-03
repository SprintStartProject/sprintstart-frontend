import { useMemo } from "react";
import {
  AlertTriangle,
  ChevronRight,
  Database,
  FolderKanban,
  ShieldCheck,
  Tag,
  Users,
} from "lucide-react";
import { UserAvatar } from "../../../components/common/UserAvatar";
import { Badge } from "../../../components/ui/Badge";
import { EmptyState } from "../../../components/ui/EmptyState";
import {
  getDisplayName,
  getManagerName,
  getProjectSourcesCount,
  getProjectUsersCount,
  getSourceHealth,
  pluralize,
} from "../data";
import { ProjectMonogram } from "../../projects/components/ProjectMonogram";
import type { AdminUser, ProjectOverview } from "../types";
import { SourceHealthChip } from "./SourceHealthChip";
import { SourceTypeChips } from "./SourceTypeChips";

type ProjectsTabProps = {
  filteredProjects: ProjectOverview[];
  /**
   * The user directory. The project list only carries ids, usernames and emails,
   * so avatars and display names for the member stack are looked up here.
   */
  users?: AdminUser[];
  onOpenProjectDetails: (project: ProjectOverview) => void;
  /** Whether a search or filter is narrowing the list, so an empty result can say so. */
  isFiltered?: boolean;
  totalCount?: number;
};

/** Avatars shown in a card's member stack before the rest collapse into `+N`. */
const MAX_STACKED_MEMBERS = 4;

function MemberStack({
  project,
  usersById,
}: {
  project: ProjectOverview;
  usersById: Map<string, AdminUser>;
}) {
  const members = project.users;
  const visibleMembers = members.slice(0, MAX_STACKED_MEMBERS);
  const hiddenCount = members.length - visibleMembers.length;

  return (
    <span className="flex items-center gap-2">
      {members.length > 0 ? (
        <span className="flex -space-x-2">
          {visibleMembers.map((member) => {
            const knownUser = usersById.get(member.id);

            return (
              <span
                key={member.id}
                className="inline-flex rounded-full ring-2 ring-app-surface transition-shadow group-hover:ring-app-surface-hover"
              >
                <UserAvatar
                  size={24}
                  profileIcon={knownUser?.profileIcon ?? member.profileIcon}
                  fallbackName={knownUser ? getDisplayName(knownUser) : member.username}
                  seed={member.id}
                />
              </span>
            );
          })}

          {hiddenCount > 0 && (
            <span
              className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-app-surface-muted px-1 text-xs font-semibold text-app-text-muted ring-2 ring-app-surface transition-shadow group-hover:ring-app-surface-hover"
              title={`${hiddenCount} more`}
            >
              +{hiddenCount}
            </span>
          )}
        </span>
      ) : (
        <Users className="h-3.5 w-3.5" aria-hidden="true" />
      )}

      <span>{pluralize(getProjectUsersCount(project), "member")}</span>
    </span>
  );
}

/**
 * Project cards for the Projects tab.
 *
 * Each card answers the questions an admin scans a list for without opening it:
 * who manages the project, who is in it, and whether its sources are healthy. A
 * missing manager gets a warning badge rather than plain text, since that is the
 * gap most worth catching from the list.
 */
export function ProjectsTab({
  filteredProjects,
  users = [],
  onOpenProjectDetails,
  isFiltered,
  totalCount,
}: ProjectsTabProps) {
  const usersById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);

  if (filteredProjects.length === 0) {
    const noProjectsExist = totalCount !== undefined && totalCount === 0;

    return (
      <EmptyState
        icon={<FolderKanban className="h-8 w-8" aria-hidden="true" />}
        title={noProjectsExist ? "No projects yet" : "No projects found"}
      >
        {noProjectsExist
          ? "Create your first project to get started."
          : isFiltered
            ? "Try adjusting your search or filter."
            : "Try another search term or create a new project first."}
      </EmptyState>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {filteredProjects.map((project) => {
        const manager = project.manager;
        const managerUser = manager ? usersById.get(manager.id) : undefined;
        const sourceHealth = getSourceHealth(project.sources);

        return (
          <button
            key={project.id}
            type="button"
            onClick={() => onOpenProjectDetails(project)}
            // Lifted rather than scaled on hover. Scaling resamples the card's
            // 1px border from the pre-scale bitmap, which reads as the outline
            // thinning out and partly vanishing. A translation moves the same
            // crisp pixels.
            className="group flex h-full w-full cursor-pointer flex-col gap-4 overflow-hidden rounded-2xl border border-app-border bg-app-surface p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-app-brand-border-strong hover:bg-app-surface-hover hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-app-focus motion-reduce:hover:translate-y-0 sm:p-5"
            aria-label={`Open details for ${project.name}`}
          >
            <div className="flex w-full items-center gap-3">
              <ProjectMonogram projectId={project.id} name={project.name} size="md" />

              <span className="min-w-0 flex-1 text-sm font-semibold break-words text-app-text">
                {project.name}
              </span>

              <ChevronRight
                className="h-4 w-4 shrink-0 text-app-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-app-text motion-reduce:group-hover:translate-x-0"
                aria-hidden="true"
              />
            </div>

            <p
              className={`line-clamp-2 text-sm leading-relaxed text-app-text-muted ${
                project.description ? "" : "italic"
              }`}
            >
              {project.description || "No project description available yet."}
            </p>

            <div className="mt-auto flex w-full flex-col gap-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                {manager ? (
                  <span className="flex min-w-0 items-center gap-1.5 text-xs text-app-text-muted">
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <UserAvatar
                      size={18}
                      profileIcon={managerUser?.profileIcon}
                      fallbackName={getManagerName(manager)}
                      seed={manager.id}
                    />
                    <span className="truncate font-medium text-app-text">
                      {getManagerName(manager)}
                    </span>
                  </span>
                ) : (
                  <Badge variant="danger" size="sm" className="py-1">
                    <AlertTriangle className="mr-1 h-3 w-3 shrink-0" aria-hidden="true" />
                    No manager
                  </Badge>
                )}

                <span className="flex min-w-0 items-center gap-1.5 text-xs text-app-text-muted">
                  <Tag className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{project.industry || "No industry"}</span>
                </span>

                <span className="flex items-center text-xs text-app-text-muted">
                  <MemberStack project={project} usersById={usersById} />
                </span>

                <span className="flex items-center gap-1.5 text-xs text-app-text-muted">
                  <Database className="h-3.5 w-3.5" aria-hidden="true" />
                  {pluralize(getProjectSourcesCount(project), "source")}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <SourceHealthChip health={sourceHealth} />
                <SourceTypeChips sources={project.sources} />
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
