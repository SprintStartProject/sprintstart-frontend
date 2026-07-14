import { Users } from "lucide-react";
import type { ProjectUser, ProjectUserSummary } from "../types";
import { RoleBadgeList } from "./RoleBadgeList";
import { UserAvatar } from "../../../components/common/UserAvatar";

type ProjectUserListProps = {
    users: Array<ProjectUser | ProjectUserSummary>;
};

export function ProjectUserList({ users }: ProjectUserListProps) {
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
                const displayName =
                    "firstName" in user && "lastName" in user
                        ? [user.firstName, user.lastName].filter(Boolean).join(" ") ||
                        user.username ||
                        user.email
                        : user.username || user.email;

                const globalRoles = "roles" in user ? user.roles : [];
                const hasGlobalRoles = globalRoles.length > 0;
                const hasProjectRoles = user.projectRoles.length > 0;

                return (
                    <div
                        key={user.id}
                        className="rounded-xl border border-app-border bg-app-surface-muted px-3 py-2.5 transition hover:border-app-border-strong hover:bg-app-surface-hover"
                    >
                        <div className="flex items-center gap-3">
                            <div className="flex shrink-0 items-center justify-center">
                                <UserAvatar
                                    size={36}
                                    profileIcon={user.profileIcon}
                                    fallbackName={"firstName" in user ? `${user.firstName} ${user.lastName}`.trim() : user.username}
                                    seed={user.id}
                                />
                            </div>

                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-app-text">
                                    {displayName}
                                </p>
                                <p className="truncate text-xs text-app-text-muted">
                                    {user.email}
                                </p>
                            </div>

                            <div className="flex shrink-0 items-center gap-3 rounded-lg px-3 py-2">
                                {hasGlobalRoles && (
                                    <div className="flex items-center">
                                        <RoleBadgeList roles={globalRoles} variant="neutral" />
                                    </div>
                                )}

                                {hasGlobalRoles && hasProjectRoles && (
                                    <div className="h-6 shrink-0 border-l-3 border-app-surface" />
                                )}

                                {hasProjectRoles && (
                                    <div className="flex items-center">
                                        <RoleBadgeList roles={user.projectRoles} variant="brand" />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}