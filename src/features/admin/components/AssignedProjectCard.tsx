import type { ReactNode } from "react";
import { AlertTriangle, ChevronRight, Database, ShieldCheck, Tag, Users } from "lucide-react";
import { UserAvatar } from "../../../components/common/UserAvatar";
import { Badge } from "../../../components/ui/Badge";
import { ProjectMonogram } from "../../projects/components/ProjectMonogram";
import {
  getManagerName,
  getProjectSourcesCount,
  getProjectUsersCount,
  pluralize,
  type UserProject,
} from "../data";
import type { AdminUser } from "../types";

type AssignedProjectCardProps = {
  project: UserProject;
  /** `detailed` adds the description and industry; `compact` is one dense row. */
  variant?: "detailed" | "compact";
  /** The person whose projects are shown; decides whether "the manager" is them. */
  userId: string;
  /** Hides the manager line where the surrounding group already says it. */
  hideManager?: boolean;
  /** Looks up avatars for the manager; the project record carries no profile icon. */
  usersById: Map<string, AdminUser>;
  onOpen: (projectId: string) => void;
  /** A control that sits beside the card, e.g. remove. It must not nest in the open button. */
  action?: ReactNode;
};

/**
 * One of a user's projects, as a card that opens the project.
 *
 * Shows who manages it, how many people and sources it has and, in the detailed
 * variant, what it is about — enough to tell the projects apart without opening
 * them. When the project list does not know the project (a stale id) only the
 * name is shown, rather than a made-up "No manager".
 */
export function AssignedProjectCard({
  project,
  variant = "compact",
  userId,
  hideManager = false,
  usersById,
  onOpen,
  action,
}: AssignedProjectCardProps) {
  const { overview } = project;
  const manager = overview?.manager ?? null;
  const isDetailed = variant === "detailed";

  return (
    <div className="group flex items-stretch gap-1 rounded-2xl border border-app-border bg-app-surface-muted transition-all hover:-translate-y-0.5 hover:border-app-brand-border-strong hover:shadow-lg motion-reduce:hover:translate-y-0">
      <button
        type="button"
        onClick={() => onOpen(project.id)}
        aria-label={`Open ${project.name} project details`}
        className="flex min-w-0 flex-1 items-start gap-3 rounded-2xl px-3 py-4 text-left focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none sm:px-4"
      >
        <ProjectMonogram
          projectId={project.id}
          name={project.name}
          size={isDetailed ? "md" : "sm"}
        />

        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-app-text">{project.name}</span>

          {isDetailed && overview?.description && (
            <span className="mt-1 line-clamp-2 block text-sm text-app-text-muted">
              {overview.description}
            </span>
          )}

          {overview && (
            <span className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-app-text-muted">
              {!hideManager &&
                (manager ? (
                  <span className="flex min-w-0 items-center gap-1.5">
                    {manager.id === userId ? (
                      <Badge variant="brand" size="sm" className="py-1">
                        <ShieldCheck className="mr-1 h-3 w-3" aria-hidden="true" />
                        Manager
                      </Badge>
                    ) : (
                      <>
                        <UserAvatar
                          size={18}
                          profileIcon={usersById.get(manager.id)?.profileIcon}
                          fallbackName={getManagerName(manager)}
                          seed={manager.id}
                        />
                        <span className="truncate font-medium text-app-text">
                          {getManagerName(manager)}
                        </span>
                      </>
                    )}
                  </span>
                ) : (
                  <Badge variant="danger" size="sm" className="py-1">
                    <AlertTriangle className="mr-1 h-3 w-3" aria-hidden="true" />
                    No manager
                  </Badge>
                ))}

              <span className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" aria-hidden="true" />
                {pluralize(getProjectUsersCount(overview), "member")}
              </span>

              <span className="flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5" aria-hidden="true" />
                {pluralize(getProjectSourcesCount(overview), "source")}
              </span>

              {isDetailed && overview.industry && (
                <span className="flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5" aria-hidden="true" />
                  {overview.industry}
                </span>
              )}
            </span>
          )}
        </span>

        <ChevronRight
          className="mt-2.5 h-4 w-4 shrink-0 text-app-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-app-text motion-reduce:group-hover:translate-x-0"
          aria-hidden="true"
        />
      </button>

      {action && <div className="flex items-center pr-2 sm:pr-3">{action}</div>}
    </div>
  );
}
