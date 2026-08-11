import { useCallback, useMemo, useState } from "react";
import type { MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Loader2, RefreshCw, Terminal } from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { AlertDialog } from "../components/ui/AlertDialog";
import { SCROLL_CONTAINER_ATTRIBUTE } from "../components/ui/useScrollLock";
import {
  DRAWER_CLOSE_DELAY_MS,
  areAllVisibleUsersSelected,
  filterAdminProjects,
  filterAdminUsers,
  getAvailableProjects,
  getDisplayName,
  getPaginatedUsers,
  getSafePage,
  getTotalPages,
  removeUsersFromProjects,
  toggleSelectedUserId,
  toggleVisibleUserSelection,
} from "../features/admin/data";
import { AdminMetrics } from "../features/admin/components/AdminMetrics";
import { AdminPagination } from "../features/admin/components/AdminPagination";
import { AdminProjectsToolbar } from "../features/admin/components/AdminProjectsToolbar";
import { AdminUsersToolbar } from "../features/admin/components/AdminUsersToolbar";
import { CreateProjectWizard } from "../features/admin/components/CreateProjectWizard";
import { ProjectDetailsDrawer } from "../features/admin/components/ProjectDetailsDrawer";
import { ProjectsTab } from "../features/admin/components/ProjectsTab";
import { TabSwitcher } from "../features/admin/components/TabSwitcher";
import { TokensTab } from "../features/admin/components/TokensTab";
import { UserDetailsDrawer } from "../features/admin/components/UserDetailsDrawer";
import { UsersTab } from "../features/admin/components/UsersTab";
import { useAdminData } from "../features/admin/hooks/useAdminData";
import { useAuth } from "../context/useAuth";
import { useProjectContext } from "../features/projects/useProjectContext";
import { ADMIN_TAB_ORDER } from "../features/admin/types";
import type {
  AdminProjectDetails,
  AdminTab,
  AdminUser,
  ProjectOverview,
  UserFilter,
} from "../features/admin/types";
import { SlidingTabPanel } from "../components/ui/SlidingTabPanel";
import { useSwipeableTabs } from "../hooks/useHorizontalWheelNavigation";
import { adminUserService } from "../services/adminUserService";
import { projectService } from "../services/projectService";

export function AdminPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { reloadProjects } = useProjectContext();
  const [activeTab, setActiveTab] = useState<AdminTab>("users");
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const [searchValue, setSearchValue] = useState("");
  const [projectSearchValue, setProjectSearchValue] = useState("");
  const [userFilter, setUserFilter] = useState<UserFilter>("all");

  const [page, setPage] = useState(1);
  const [openUserMenuId, setOpenUserMenuId] = useState<string | null>(null);
  const [userPendingDelete, setUserPendingDelete] = useState<AdminUser | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [deleteUserErrorMessage, setDeleteUserErrorMessage] = useState("");

  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [isBulkDeletingUsers, setIsBulkDeletingUsers] = useState(false);
  const [bulkDeleteErrorMessage, setBulkDeleteErrorMessage] = useState("");

  const [isCreateWizardOpen, setIsCreateWizardOpen] = useState(false);

  const {
    users,
    setUsers,
    projects,
    setProjects,
    selectedUser,
    setSelectedUser,
    selectedProject,
    setSelectedProject,
    loadingState,
    errorMessage,
    isRefreshing,
    refreshAdminData,
    tokenNames,
    tokensLoaded,
    loadTokenNames,
  } = useAdminData();

  const availableProjects = useMemo(() => getAvailableProjects(projects), [projects]);

  const filteredUsers = useMemo(() => {
    return filterAdminUsers(users, searchValue, userFilter);
  }, [users, searchValue, userFilter]);

  const filteredProjects = useMemo(() => {
    return filterAdminProjects(projects, projectSearchValue);
  }, [projects, projectSearchValue]);

  const totalPages = getTotalPages(filteredUsers.length);
  const safePage = getSafePage(page, totalPages);

  const paginatedUsers = useMemo(() => {
    return getPaginatedUsers(filteredUsers, safePage);
  }, [filteredUsers, safePage]);

  const allVisibleUsersSelected = areAllVisibleUsersSelected(paginatedUsers, selectedUserIds);

  const openCreateWizard = useCallback(() => {
    // Step 2 of the wizard needs the saved PAT names; without visiting the
    // tokens tab first they were never fetched.
    if (!tokensLoaded) {
      void loadTokenNames();
    }

    setIsCreateWizardOpen(true);
  }, [loadTokenNames, tokensLoaded]);

  const handleProjectCreated = useCallback(() => {
    void projectService.getProjects().then(setProjects);
    // Keep the global project switcher in sync with the new project.
    void reloadProjects();
  }, [reloadProjects, setProjects]);

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds((current) => {
      return toggleSelectedUserId(current, userId);
    });
  };

  const toggleAllVisibleUsers = () => {
    setSelectedUserIds((current) => {
      return toggleVisibleUserSelection(current, paginatedUsers, allVisibleUsersSelected);
    });
  };

  const openUserDetails = (user: AdminUser) => {
    setOpenUserMenuId(null);
    setSelectedProject(null);
    setSelectedUser(user);
    setIsDrawerOpen(true);
  };

  const toggleUserContextMenu = (event: MouseEvent<HTMLButtonElement>, userId: string) => {
    event.stopPropagation();
    setOpenUserMenuId((currentUserMenuId) => (currentUserMenuId === userId ? null : userId));
  };

  const openUserDetailsFromMenu = (event: MouseEvent<HTMLButtonElement>, user: AdminUser) => {
    event.stopPropagation();
    openUserDetails(user);
  };

  const requestUserDelete = (user: AdminUser) => {
    setOpenUserMenuId(null);
    setDeleteUserErrorMessage("");
    setUserPendingDelete(user);
  };

  const requestUserDeleteFromMenu = (event: MouseEvent<HTMLButtonElement>, user: AdminUser) => {
    event.stopPropagation();
    requestUserDelete(user);
  };

  const cancelUserDelete = () => {
    if (isDeletingUser) return;

    setUserPendingDelete(null);
    setDeleteUserErrorMessage("");
  };

  const confirmUserDelete = async () => {
    if (!userPendingDelete) return;

    const userId = userPendingDelete.id;

    setIsDeletingUser(true);
    setDeleteUserErrorMessage("");

    try {
      await adminUserService.deleteUser(userId);

      setUsers((currentUsers) => currentUsers.filter((currentUser) => currentUser.id !== userId));

      setProjects((currentProjects) => removeUsersFromProjects(currentProjects, new Set([userId])));

      setSelectedUserIds((currentSelectedUserIds) => {
        const nextSelectedUserIds = new Set(currentSelectedUserIds);
        nextSelectedUserIds.delete(userId);
        return nextSelectedUserIds;
      });

      setSelectedUser((currentSelectedUser) =>
        currentSelectedUser?.id === userId ? null : currentSelectedUser,
      );

      if (selectedUser?.id === userId) {
        setIsDrawerOpen(false);
      }

      setUserPendingDelete(null);
    } catch (error) {
      setDeleteUserErrorMessage(
        error instanceof Error ? error.message : "User could not be deleted.",
      );
    } finally {
      setIsDeletingUser(false);
    }
  };

  const requestBulkUserDelete = () => {
    if (selectedUserIds.size === 0) return;

    setOpenUserMenuId(null);
    setBulkDeleteErrorMessage("");
    setIsBulkDeleteDialogOpen(true);
  };

  const cancelBulkUserDelete = () => {
    if (isBulkDeletingUsers) return;

    setIsBulkDeleteDialogOpen(false);
    setBulkDeleteErrorMessage("");
  };

  const confirmBulkUserDelete = async () => {
    const userIdsToDelete = Array.from(selectedUserIds);

    if (userIdsToDelete.length === 0) {
      setIsBulkDeleteDialogOpen(false);
      return;
    }

    const userIdsToDeleteSet = new Set(userIdsToDelete);

    setIsBulkDeletingUsers(true);
    setBulkDeleteErrorMessage("");

    try {
      await Promise.all(userIdsToDelete.map((userId) => adminUserService.deleteUser(userId)));

      setUsers((currentUsers) =>
        currentUsers.filter((currentUser) => !userIdsToDeleteSet.has(currentUser.id)),
      );

      setProjects((currentProjects) =>
        removeUsersFromProjects(currentProjects, userIdsToDeleteSet),
      );

      setSelectedUser((currentSelectedUser) =>
        currentSelectedUser && userIdsToDeleteSet.has(currentSelectedUser.id)
          ? null
          : currentSelectedUser,
      );

      if (selectedUser && userIdsToDeleteSet.has(selectedUser.id)) {
        setIsDrawerOpen(false);
      }

      setSelectedUserIds(new Set());
      setIsBulkDeleteDialogOpen(false);
    } catch (error) {
      setBulkDeleteErrorMessage(
        error instanceof Error ? error.message : "Selected users could not be deleted.",
      );
    } finally {
      setIsBulkDeletingUsers(false);
    }
  };

  const openProjectDetails = (project: ProjectOverview) => {
    setOpenUserMenuId(null);
    setSelectedUser(null);
    setSelectedProject(project);
    setIsDrawerOpen(true);
  };

  const openProjectDetailsFromUserDrawer = (projectId: string) => {
    const project = projects.find((currentProject) => currentProject.id === projectId);

    if (!project) return;

    setOpenUserMenuId(null);
    setActiveTab("projects");
    setProjectSearchValue("");
    setSelectedUser(null);
    setSelectedProject(project);
    setIsDrawerOpen(true);
  };

  const handleProjectDeleted = useCallback(
    (projectId: string) => {
      setProjects((currentProjects) =>
        currentProjects.filter((project) => project.id !== projectId),
      );
      setSelectedProject(null);
      // The deleted project may have been the globally selected one; the
      // provider heals the selection when it reloads.
      void reloadProjects();
    },
    [reloadProjects, setProjects, setSelectedProject],
  );

  const handleProjectUpdated = useCallback(
    (updatedProject: AdminProjectDetails) => {
      const projectSummary = {
        id: updatedProject.id,
        name: updatedProject.name,
      };
      const assignedUserIds = new Set(updatedProject.users.map((projectUser) => projectUser.id));

      setProjects((currentProjects) =>
        currentProjects.map((currentProject) =>
          currentProject.id === updatedProject.id ? updatedProject : currentProject,
        ),
      );

      setUsers((currentUsers) =>
        currentUsers.map((currentUser) => {
          const isAssignedToProject = assignedUserIds.has(currentUser.id);
          const hasProject = currentUser.projects.some(
            (project) => project.id === updatedProject.id,
          );

          if (isAssignedToProject) {
            const nextProjects = hasProject
              ? currentUser.projects.map((project) =>
                  project.id === updatedProject.id ? projectSummary : project,
                )
              : [...currentUser.projects, projectSummary];

            return {
              ...currentUser,
              projects: nextProjects.sort((left, right) => left.name.localeCompare(right.name)),
            };
          }

          if (hasProject) {
            return {
              ...currentUser,
              projects: currentUser.projects.filter((project) => project.id !== updatedProject.id),
            };
          }

          return currentUser;
        }),
      );

      setSelectedProject((currentSelectedProject) =>
        currentSelectedProject?.id === updatedProject.id ? updatedProject : currentSelectedProject,
      );
    },
    [setProjects, setSelectedProject, setUsers],
  );

  const openSourceDetails = (projectId: string, sourceId: string) => {
    const params = new URLSearchParams({ projectId, sourceId });
    void navigate(`/data-ingestion?${params.toString()}`);
  };

  const handleUserUpdated = useCallback(
    (updatedUser: AdminUser) => {
      setUsers((currentUsers) =>
        currentUsers.map((currentUser) =>
          currentUser.id === updatedUser.id ? updatedUser : currentUser,
        ),
      );
      setSelectedUser((currentSelectedUser) =>
        currentSelectedUser?.id === updatedUser.id ? updatedUser : currentSelectedUser,
      );
    },
    [setSelectedUser, setUsers],
  );

  const closeDetails = () => {
    setOpenUserMenuId(null);
    setIsDrawerOpen(false);

    window.setTimeout(() => {
      setSelectedUser(null);
      setSelectedProject(null);
    }, DRAWER_CLOSE_DELAY_MS);
  };

  const handleTabChange = (tab: AdminTab) => {
    setOpenUserMenuId(null);
    closeDetails();
    setActiveTab(tab);
    if (tab === "tokens" && !tokensLoaded) {
      void loadTokenNames();
    }
  };

  // Two-finger swipe between the sections, for people who would rather not aim
  // at the bar.
  const swipeRef = useSwipeableTabs<AdminTab, HTMLElement>({
    order: ADMIN_TAB_ORDER,
    value: activeTab,
    onChange: handleTabChange,
  });

  const showInitialLoading = loadingState === "idle" || loadingState === "loading";

  return (
    // The swipe listens on the page rather than the panel: needing to be over
    // the content to change section makes the gesture feel like it only works
    // in some places.
    <div
      ref={swipeRef}
      // This page scrolls here rather than letting the document scroll, so a
      // dialog's scroll lock has to be told where to look — see
      // `SCROLL_CONTAINER_ATTRIBUTE`.
      {...{ [SCROLL_CONTAINER_ATTRIBUTE]: "" }}
      className="h-dvh overflow-y-scroll overscroll-contain"
    >
      <header className="border-b border-app-border bg-app-bg">
        <div className="admin-page-frame py-4 sm:py-6">
          <PageHeader
            icon={Terminal}
            title="Access Management"
            subtitle="Manage users, projects and access tokens."
            actions={<AdminMetrics userCount={users.length} projectCount={projects.length} />}
          />
        </div>
      </header>

      <main className="admin-page-frame py-4 sm:py-6">
        {/* No card around the sections, matching the other tabbed pages: the
            box drew a second frame inside the page frame and made the tab bar
            look like it belonged to a widget rather than to the page. */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <TabSwitcher activeTab={activeTab} onChange={handleTabChange} />

          <button
            type="button"
            onClick={() => void refreshAdminData()}
            disabled={isRefreshing}
            className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-app-border bg-app-surface text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text disabled:cursor-not-allowed disabled:opacity-60 sm:w-11"
            aria-label="Refresh admin data"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Clipped horizontally because the section content slides in from
              the side; without it the travel briefly widens the page. `clip`
              rather than `hidden`, so this does not become a scroll container
              and swallow sticky positioning inside the sections. */}
        <div className="overflow-x-clip">
          {showInitialLoading ? (
            <div className="flex min-h-96 items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-app-text-muted">
                <Loader2 className="h-8 w-8 animate-spin text-app-brand" />
                <p className="text-sm">Loading admin data...</p>
              </div>
            </div>
          ) : loadingState === "error" ? (
            <div className="flex min-h-96 items-center justify-center px-6 text-center">
              <div className="max-w-md">
                <AlertCircle className="mx-auto mb-4 h-10 w-10 text-app-danger-solid" />
                <h3 className="text-sm font-semibold text-app-text">
                  Admin data could not be loaded
                </h3>
                <p className="mt-2 text-sm text-app-text-muted">{errorMessage}</p>
                <button
                  type="button"
                  onClick={() => void refreshAdminData()}
                  className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-app-text px-5 py-2.5 text-sm font-medium text-app-text-inverse transition-colors hover:opacity-90"
                >
                  Try again
                </button>
              </div>
            </div>
          ) : (
            // Only the tab content slides; the loading and error states above
            // are not tabs and would otherwise animate on their way in too.
            <SlidingTabPanel activeKey={activeTab} index={ADMIN_TAB_ORDER.indexOf(activeTab)}>
              {activeTab === "users" ? (
                <>
                  <AdminUsersToolbar
                    userCount={filteredUsers.length}
                    selectedUserCount={selectedUserIds.size}
                    searchValue={searchValue}
                    userFilter={userFilter}
                    onSearchChange={(value) => {
                      setSearchValue(value);
                      setPage(1);
                    }}
                    onFilterChange={(value) => {
                      setUserFilter(value);
                      setPage(1);
                    }}
                    onRequestBulkDelete={requestBulkUserDelete}
                  />

                  <UsersTab
                    paginatedUsers={paginatedUsers}
                    selectedUserIds={selectedUserIds}
                    allVisibleUsersSelected={allVisibleUsersSelected}
                    openUserMenuId={openUserMenuId}
                    onToggleAllVisibleUsers={toggleAllVisibleUsers}
                    onToggleUserSelection={toggleUserSelection}
                    onOpenUserDetails={openUserDetails}
                    onToggleUserContextMenu={toggleUserContextMenu}
                    onOpenUserDetailsFromMenu={openUserDetailsFromMenu}
                    onRequestUserDeleteFromMenu={requestUserDeleteFromMenu}
                  />

                  <AdminPagination
                    safePage={safePage}
                    totalPages={totalPages}
                    onPageChange={setPage}
                  />
                </>
              ) : activeTab === "projects" ? (
                <>
                  <AdminProjectsToolbar
                    projectCount={filteredProjects.length}
                    projectSearchValue={projectSearchValue}
                    onProjectSearchChange={setProjectSearchValue}
                    onCreateProject={openCreateWizard}
                  />

                  <ProjectsTab
                    filteredProjects={filteredProjects}
                    hasSearchQuery={projectSearchValue.trim().length > 0}
                    totalCount={projects.length}
                    onOpenProjectDetails={openProjectDetails}
                  />
                </>
              ) : (
                <TokensTab
                  tokenNames={tokenNames}
                  onRefresh={() => void loadTokenNames()}
                  userEmail={profile?.email ?? null}
                />
              )}
            </SlidingTabPanel>
          )}
        </div>
      </main>

      {(selectedUser || selectedProject) && (
        <button
          type="button"
          aria-label="Close details overlay"
          onClick={closeDetails}
          className={`fixed inset-0 z-30 bg-app-overlay transition-opacity duration-300 ${
            isDrawerOpen ? "opacity-100" : "opacity-0"
          }`}
        />
      )}

      {selectedUser && (
        <UserDetailsDrawer
          user={selectedUser}
          availableProjects={availableProjects}
          isOpen={isDrawerOpen}
          onClose={closeDetails}
          onOpenProjectDetails={openProjectDetailsFromUserDrawer}
          onUserUpdated={handleUserUpdated}
          onRequestDelete={requestUserDelete}
        />
      )}

      {selectedProject && (
        // Keyed by project so every switch remounts the drawer with fresh
        // state instead of carrying the previous project's async results over.
        <ProjectDetailsDrawer
          key={selectedProject.id}
          project={selectedProject}
          availableUsers={users}
          isOpen={isDrawerOpen}
          canManageLifecycle={profile?.permissionGroup === "ADMIN"}
          onClose={closeDetails}
          onOpenSourceDetails={openSourceDetails}
          onProjectUpdated={handleProjectUpdated}
          onProjectDeleted={handleProjectDeleted}
        />
      )}

      <AlertDialog
        isOpen={Boolean(userPendingDelete)}
        title="Delete user?"
        description={
          userPendingDelete ? (
            <>
              Are you sure you want to delete <strong>{getDisplayName(userPendingDelete)}</strong>?
              This action cannot be undone.
            </>
          ) : undefined
        }
        confirmLabel="Delete user"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={isDeletingUser}
        loadingLabel="Deleting..."
        errorMessage={deleteUserErrorMessage}
        onClose={cancelUserDelete}
        onConfirm={() => void confirmUserDelete()}
      />

      <AlertDialog
        isOpen={isBulkDeleteDialogOpen}
        title="Delete selected users?"
        description={
          <>
            Are you sure you want to delete <strong>{selectedUserIds.size}</strong>{" "}
            {selectedUserIds.size === 1 ? "selected user" : "selected users"}? This action cannot be
            undone.
          </>
        }
        confirmLabel="Delete All"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={isBulkDeletingUsers}
        loadingLabel="Deleting..."
        errorMessage={bulkDeleteErrorMessage}
        onClose={cancelBulkUserDelete}
        onConfirm={() => void confirmBulkUserDelete()}
      />

      <CreateProjectWizard
        isOpen={isCreateWizardOpen}
        tokenNames={tokenNames}
        users={users}
        onClose={() => setIsCreateWizardOpen(false)}
        onProjectCreated={handleProjectCreated}
      />
    </div>
  );
}
