import { createPortal } from "react-dom";
import { useState } from "react";
import type { MouseEvent } from "react";
import { ExternalLink, MoreVertical, Trash2 } from "lucide-react";
import { getDisplayName } from "../data";
import { UserAvatar } from "../../../components/common/UserAvatar";
import type { AdminUser } from "../types";
import { PermissionGroupBadge } from "./Badges";
import { ProjectList } from "./ProjectList";
import { SelectionCheckbox } from "./SelectionCheckbox";
import { TableHeader } from "./TableHeader";

type UsersTabProps = {
    paginatedUsers: AdminUser[];
    selectedUserIds: Set<string>;
    allVisibleUsersSelected: boolean;
    openUserMenuId: string | null;
    onToggleAllVisibleUsers: () => void;
    onToggleUserSelection: (userId: string) => void;
    onOpenUserDetails: (user: AdminUser) => void;
    onToggleUserContextMenu: (event: MouseEvent<HTMLButtonElement>, userId: string) => void;
    onOpenUserDetailsFromMenu: (event: MouseEvent<HTMLButtonElement>, user: AdminUser) => void;
    onRequestUserDeleteFromMenu: (event: MouseEvent<HTMLButtonElement>, user: AdminUser) => void;
};

type MenuPosition = {
    top: number;
    left: number;
};

function getMenuPosition(button: HTMLButtonElement): MenuPosition {
    const rect = button.getBoundingClientRect();
    const menuWidth = 176;
    const menuHeight = 96;
    const viewportPadding = 8;
    const gap = 8;

    const left = Math.min(
        Math.max(viewportPadding, rect.right - menuWidth),
        window.innerWidth - menuWidth - viewportPadding,
    );

    const belowTop = rect.bottom + gap;
    const top =
        belowTop + menuHeight > window.innerHeight - viewportPadding
            ? Math.max(viewportPadding, rect.top - menuHeight - gap)
            : belowTop;

    return { top, left };
}

export function UsersTab({
                             paginatedUsers,
                             selectedUserIds,
                             allVisibleUsersSelected,
                             openUserMenuId,
                             onToggleAllVisibleUsers,
                             onToggleUserSelection,
                             onOpenUserDetails,
                             onToggleUserContextMenu,
                             onOpenUserDetailsFromMenu,
                             onRequestUserDeleteFromMenu,
                         }: UsersTabProps) {
    const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);

    const handleToggleUserContextMenu = (
        event: MouseEvent<HTMLButtonElement>,
        userId: string,
    ) => {
        const shouldOpen = openUserMenuId !== userId;

        setMenuPosition(
            shouldOpen ? getMenuPosition(event.currentTarget) : null,
        );
        onToggleUserContextMenu(event, userId);
    };

    const openMenuUser = paginatedUsers.find(
        (user) => user.id === openUserMenuId,
    );

    const contextMenu =
        openMenuUser && typeof document !== "undefined"
            ? createPortal(
                  <div
                      role="menu"
                      style={{
                          top: menuPosition?.top ?? 8,
                          left: menuPosition?.left ?? 8,
                      }}
                      className="fixed z-50 w-44 overflow-hidden rounded-xl border border-app-border bg-app-surface shadow-xl"
                  >
                      <button
                          type="button"
                          role="menuitem"
                          onClick={(event) =>
                              onOpenUserDetailsFromMenu(event, openMenuUser)
                          }
                          className="flex min-h-11 w-full items-center gap-2 px-4 text-left text-sm font-medium text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text"
                      >
                          <ExternalLink className="h-4 w-4" />
                          Open details
                      </button>
                      <button
                          type="button"
                          role="menuitem"
                          onClick={(event) =>
                              onRequestUserDeleteFromMenu(event, openMenuUser)
                          }
                          className="flex min-h-11 w-full items-center gap-2 px-4 text-left text-sm font-medium text-app-danger-text transition-colors hover:bg-app-danger-bg"
                      >
                          <Trash2 className="h-4 w-4" />
                          Delete
                      </button>
                  </div>,
                  document.body,
              )
            : null;

    if (paginatedUsers.length === 0) {
        return (
            <div className="overflow-hidden rounded-2xl border border-app-border bg-app-surface p-6">
                <p className="text-base font-medium text-app-text">No users found</p>
                <p className="mt-1 text-sm text-app-text-muted">
                    Try another search term or change the filters.
                </p>
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-2xl border border-app-border bg-app-surface">
            <div>
                <div className="hidden grid-cols-[44px_2.5fr_1.8fr_1.8fr_52px] items-center border-b border-app-border bg-app-surface-muted px-5 py-3.5 sm:grid">
                    <div className="flex items-center">
                        <SelectionCheckbox
                            checked={allVisibleUsersSelected}
                            onChange={onToggleAllVisibleUsers}
                            ariaLabel="Select all users"
                        />
                    </div>

                    <TableHeader>User</TableHeader>
                    <TableHeader>Permission</TableHeader>
                    <TableHeader>Projects</TableHeader>
                    <div />
                </div>

                {paginatedUsers.map((user) => (
                    <div
                        key={user.id}
                        // An inset brand edge rather than the cards' lift: these
                        // rows share a grid with their neighbours, and a
                        // transform would break the column alignment.
                        className="group relative grid cursor-pointer grid-cols-[36px_minmax(0,1fr)_44px] gap-x-3 gap-y-3 border-b border-app-border px-3 py-4 transition-colors last:border-b-0 hover:bg-app-surface-hover hover:shadow-[inset_3px_0_0_0_var(--color-app-brand)] sm:grid-cols-[44px_2.5fr_1.8fr_1.8fr_52px] sm:items-center sm:gap-x-0 sm:gap-y-0 sm:px-5"
                    >
                        <button
                            type="button"
                            onClick={() => onOpenUserDetails(user)}
                            className="absolute inset-0 z-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-app-brand-glow"
                            aria-label={`Open details for ${getDisplayName(user)}`}
                        />

                        <div className="relative z-10 row-span-3 flex items-start pt-1 sm:row-auto sm:items-center sm:pt-0" data-user-row-action="true">
                            <SelectionCheckbox
                                checked={selectedUserIds.has(user.id)}
                                onChange={() => onToggleUserSelection(user.id)}
                                ariaLabel={`Select ${getDisplayName(user)}`}
                            />
                        </div>

                        <div className="pointer-events-none relative z-10 col-start-2 min-h-11 min-w-0 text-left sm:col-auto">
                            <div className="flex items-center gap-2.5">
                                <div className="flex shrink-0 items-center justify-center">
                                    <UserAvatar
                                        profileIcon={user.profileIcon}
                                        fallbackName={`${user.firstName} ${user.lastName}`.trim()}
                                        seed={user.id}
                                        size={40}
                                    />
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="truncate text-sm font-semibold text-app-text">
                                            {getDisplayName(user)}
                                        </span>
                                    </div>
                                    <div className="truncate text-xs text-app-text-muted">
                                        {user.email}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pointer-events-none relative z-10 col-start-2 min-w-0 sm:col-auto">
                            <PermissionGroupBadge permissionGroup={user.permissionGroup} />
                        </div>

                        <div className="pointer-events-none relative z-10 col-span-2 col-start-2 min-w-0 sm:col-auto sm:col-span-1">
                            <ProjectList projects={user.projects} />
                        </div>

                        <div
                            className="relative z-10 col-start-3 row-start-1 flex items-center justify-end sm:col-auto sm:row-auto"
                            data-user-row-action="true"
                        >
                            <button
                                type="button"
                                onClick={(event) => handleToggleUserContextMenu(event, user.id)}
                                className="flex h-11 w-11 items-center justify-center rounded-xl text-app-text-muted transition-colors hover:bg-app-surface-muted hover:text-app-text"
                                aria-label={`Open context menu for ${getDisplayName(user)}`}
                                aria-haspopup="menu"
                                aria-expanded={openUserMenuId === user.id}
                            >
                                <MoreVertical className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
            {contextMenu}
        </div>
    );
}
