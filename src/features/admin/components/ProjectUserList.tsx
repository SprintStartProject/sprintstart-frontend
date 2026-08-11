import { Trash2, Users } from "lucide-react";
import { UserAvatar } from "../../../components/common/UserAvatar";
import { Button } from "../../../components/ui/Button";
import type { ProjectUser, ProjectUserSummary } from "../types";
import { RoleBadgeList } from "./RoleBadgeList";

type ProjectUserListProps = {
  users: Array<ProjectUser | ProjectUserSummary>;
  pendingUserId?: string | null;
  onRemoveUser?: (userId: string) => void;
};

function getProjectUserDisplayName(user: ProjectUser | ProjectUserSummary) {
  if ("firstName" in user && "lastName" in user) {
    return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || user.email;
  }

  return user.username || user.email;
}

export function ProjectUserList({
  users,
  pendingUserId = null,
  onRemoveUser,
}: ProjectUserListProps) {
  if (users.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-app-border px-4 py-6 text-center">
        <Users className="mx-auto mb-2 h-5 w-5 text-app-text-disabled" />
        <p className="text-sm text-app-text-muted">No users assigned yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {users.map((user) => {
        const displayName = getProjectUserDisplayName(user);
        const globalRoles = "roles" in user ? (user.roles ?? []) : [];
        const hasGlobalRoles = globalRoles.length > 0;
        const hasProjectRoles = user.projectRoles.length > 0;
        const isPending = pendingUserId === user.id;

        return (
          <div
            key={user.id}
            className="rounded-xl border border-app-border bg-app-surface-muted px-3 py-2.5 transition hover:border-app-border-strong hover:bg-app-surface-hover"
          >
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex shrink-0 items-center justify-center">
                <UserAvatar
                  size={36}
                  profileIcon={user.profileIcon}
                  fallbackName={displayName}
                  seed={user.id}
                />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-app-text">{displayName}</p>
                <p className="truncate text-xs text-app-text-muted">{user.email}</p>
              </div>

              <div className="flex w-full flex-wrap items-center gap-2 rounded-lg px-0 py-1 sm:w-auto sm:shrink-0 sm:gap-3 sm:px-3 sm:py-2">
                {hasGlobalRoles && (
                  <div className="flex min-w-0 items-center">
                    <RoleBadgeList roles={globalRoles} variant="neutral" />
                  </div>
                )}

                {hasGlobalRoles && hasProjectRoles && (
                  <div className="hidden h-6 shrink-0 border-l-3 border-app-surface sm:block" />
                )}

                {hasProjectRoles && (
                  <div className="flex min-w-0 items-center">
                    <RoleBadgeList roles={user.projectRoles} variant="brand" />
                  </div>
                )}
              </div>

              {onRemoveUser && (
                <Button
                  variant="dangerGhost"
                  size="sm"
                  iconOnly
                  onClick={() => onRemoveUser(user.id)}
                  disabled={pendingUserId !== null}
                  loading={isPending}
                  className="shrink-0"
                  aria-label={`Remove ${displayName} from project`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
