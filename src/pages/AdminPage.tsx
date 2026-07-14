import { useCallback, useMemo, useState } from "react";
import type { MouseEvent } from "react";
import { AlertCircle, Check, Loader2, RefreshCw, Terminal } from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { AlertDialog } from "../components/ui/AlertDialog";
import { Modal } from "../components/ui/Modal";
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
import { ProjectDetailsDrawer } from "../features/admin/components/ProjectDetailsDrawer";
import { ProjectsTab } from "../features/admin/components/ProjectsTab";
import { TabSwitcher } from "../features/admin/components/TabSwitcher";
import { TokensTab } from "../features/admin/components/TokensTab";
import { UserDetailsDrawer } from "../features/admin/components/UserDetailsDrawer";
import { UsersTab } from "../features/admin/components/UsersTab";
import { useAdminData } from "../features/admin/hooks/useAdminData";
import type {
  AdminProjectDetails,
  AdminTab,
  AdminUser,
  ProjectOverview,
  UserFilter,
} from "../features/admin/types";
import { adminUserService } from "../services/adminUserService";
import { projectService } from "../services/projectService";

export function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>("users");
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(
    new Set(),
  );
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const [searchValue, setSearchValue] = useState("");
  const [projectSearchValue, setProjectSearchValue] = useState("");
  const [userFilter, setUserFilter] = useState<UserFilter>("all");
  const [showFilters, setShowFilters] = useState(false);

  const [page, setPage] = useState(1);
  const [openUserMenuId, setOpenUserMenuId] = useState<string | null>(null);
  const [userPendingDelete, setUserPendingDelete] = useState<AdminUser | null>(
    null,
  );
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [deleteUserErrorMessage, setDeleteUserErrorMessage] = useState("");

  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [isBulkDeletingUsers, setIsBulkDeletingUsers] = useState(false);
  const [bulkDeleteErrorMessage, setBulkDeleteErrorMessage] = useState("");

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [createProjectError, setCreateProjectError] = useState("");

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

  const availableProjects = useMemo(
    () => getAvailableProjects(projects),
    [projects],
  );

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

  const allVisibleUsersSelected = areAllVisibleUsersSelected(
    paginatedUsers,
    selectedUserIds,
  );

  const openCreateModal = useCallback(() => {
    setNewProjectName("");
    setNewProjectDescription("");
    setCreateProjectError("");
    setIsCreateModalOpen(true);
  }, []);

  const closeCreateModal = useCallback(() => {
    if (isCreatingProject) return;

    setIsCreateModalOpen(false);
    setCreateProjectError("");
  }, [isCreatingProject]);

  const handleCreateProject = useCallback(async () => {
    const trimmedName = newProjectName.trim();
    if (!trimmedName) return;

    setIsCreatingProject(true);
    setCreateProjectError("");

    try {
      await projectService.createProject({
        name: trimmedName,
        description: newProjectDescription.trim() || undefined,
      });

      setProjects(await projectService.getProjects());
      closeCreateModal();
    } catch (error) {
      setCreateProjectError(
        error instanceof Error ? error.message : "Failed to create project.",
      );
    } finally {
      setIsCreatingProject(false);
    }
  }, [closeCreateModal, newProjectDescription, newProjectName, setProjects]);

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds((current) => {
      return toggleSelectedUserId(current, userId);
    });
  };

  const toggleAllVisibleUsers = () => {
    setSelectedUserIds((current) => {
      return toggleVisibleUserSelection(
        current,
        paginatedUsers,
        allVisibleUsersSelected,
      );
    });
  };

  const openUserDetails = (user: AdminUser) => {
    setOpenUserMenuId(null);
    setSelectedProject(null);
    setSelectedUser(user);
    setIsDrawerOpen(true);
  };

  const toggleUserContextMenu = (
    event: MouseEvent<HTMLButtonElement>,
    userId: string,
  ) => {
    event.stopPropagation();
    setOpenUserMenuId((currentUserMenuId) =>
      currentUserMenuId === userId ? null : userId,
    );
  };

  const openUserDetailsFromMenu = (
    event: MouseEvent<HTMLButtonElement>,
    user: AdminUser,
  ) => {
    event.stopPropagation();
    openUserDetails(user);
  };

  const requestUserDelete = (user: AdminUser) => {
    setOpenUserMenuId(null);
    setDeleteUserErrorMessage("");
    setUserPendingDelete(user);
  };

  const requestUserDeleteFromMenu = (
    event: MouseEvent<HTMLButtonElement>,
    user: AdminUser,
  ) => {
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

      setUsers((currentUsers) =>
        currentUsers.filter((currentUser) => currentUser.id !== userId),
      );

      setProjects((currentProjects) =>
        removeUsersFromProjects(currentProjects, new Set([userId])),
      );

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
      await Promise.all(
        userIdsToDelete.map((userId) => adminUserService.deleteUser(userId)),
      );

      setUsers((currentUsers) =>
        currentUsers.filter(
          (currentUser) => !userIdsToDeleteSet.has(currentUser.id),
        ),
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
        error instanceof Error
          ? error.message
          : "Selected users could not be deleted.",
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
    const project = projects.find(
      (currentProject) => currentProject.id === projectId,
    );

    if (!project) return;

    setOpenUserMenuId(null);
    setActiveTab("projects");
    setProjectSearchValue("");
    setSelectedUser(null);
    setSelectedProject(project);
    setIsDrawerOpen(true);
  };

  const handleProjectUpdated = useCallback(
    (updatedProject: AdminProjectDetails) => {
      const projectSummary = {
        id: updatedProject.id,
        name: updatedProject.name,
      };
      const assignedUserIds = new Set(
        updatedProject.users.map((projectUser) => projectUser.id),
      );

      setProjects((currentProjects) =>
        currentProjects.map((currentProject) =>
          currentProject.id === updatedProject.id
            ? updatedProject
            : currentProject,
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
              projects: nextProjects.sort((left, right) =>
                left.name.localeCompare(right.name),
              ),
            };
          }

          if (hasProject) {
            return {
              ...currentUser,
              projects: currentUser.projects.filter(
                (project) => project.id !== updatedProject.id,
              ),
            };
          }

          return currentUser;
        }),
      );

      setSelectedProject((currentSelectedProject) =>
        currentSelectedProject?.id === updatedProject.id
          ? updatedProject
          : currentSelectedProject,
      );
    },
    [setProjects, setSelectedProject, setUsers],
  );

  const openSourceDetails = (projectId: string, sourceId: string) => {
    const params = new URLSearchParams({ projectId, sourceId });
    window.history.pushState(null, "", `/data-ingestion?${params.toString()}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const handleUserUpdated = useCallback(
    (updatedUser: AdminUser) => {
      setUsers((currentUsers) =>
        currentUsers.map((currentUser) =>
          currentUser.id === updatedUser.id ? updatedUser : currentUser,
        ),
      );
      setSelectedUser((currentSelectedUser) =>
        currentSelectedUser?.id === updatedUser.id
          ? updatedUser
          : currentSelectedUser,
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

  const showInitialLoading =
    loadingState === "idle" || loadingState === "loading";

  return (
    <div className="h-dvh overflow-y-scroll overscroll-contain bg-app-bg">
      <header className="border-b border-app-border bg-app-bg">
        <div className="admin-page-frame py-4 sm:py-6">
          <PageHeader
            icon={Terminal}
            title="Access Management"
            subtitle="Manage users, projects and access tokens."
            actions={
              <AdminMetrics
                userCount={users.length}
                projectCount={projects.length}
              />
            }
          />
        </div>
      </header>

      <main className="admin-page-frame py-4 sm:py-6">
        <div className="overflow-hidden rounded-2xl border border-app-border bg-app-surface shadow-sm sm:rounded-3xl">
          <div className="flex flex-col gap-4 border-b border-app-border px-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
            <TabSwitcher activeTab={activeTab} onChange={handleTabChange} />

            <button
              type="button"
              onClick={() => void refreshAdminData()}
              disabled={isRefreshing}
              className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-app-border bg-app-surface text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text disabled:cursor-not-allowed disabled:opacity-60 sm:w-11"
              aria-label="Refresh admin data"
            >
              <RefreshCw
                className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
            </button>
          </div>

          <div className="p-3 sm:p-6">
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
                  <h3 className="text-base font-semibold text-app-text">
                    Admin data could not be loaded
                  </h3>
                  <p className="mt-2 text-sm text-app-text-muted">
                    {errorMessage}
                  </p>
                  <button
                    type="button"
                    onClick={() => void refreshAdminData()}
                    className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-app-text px-5 py-2.5 text-sm font-medium text-app-text-inverse transition-colors hover:opacity-90"
                  >
                    Try again
                  </button>
                </div>
              </div>
            ) : activeTab === "users" ? (
              <>
                <AdminUsersToolbar
                  userCount={filteredUsers.length}
                  selectedUserCount={selectedUserIds.size}
                  searchValue={searchValue}
                  userFilter={userFilter}
                  showFilters={showFilters}
                  onSearchChange={(value) => {
                    setSearchValue(value);
                    setPage(1);
                  }}
                  onFilterChange={(value) => {
                    setUserFilter(value);
                    setShowFilters(false);
                    setPage(1);
                  }}
                  onToggleFilters={() => setShowFilters((current) => !current)}
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
                  onCreateProject={openCreateModal}
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
              />
            )}
          </div>
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
        <ProjectDetailsDrawer
          project={selectedProject}
          availableUsers={users}
          isOpen={isDrawerOpen}
          onClose={closeDetails}
          onOpenSourceDetails={openSourceDetails}
          onProjectUpdated={handleProjectUpdated}
        />
      )}

      <AlertDialog
        isOpen={Boolean(userPendingDelete)}
        title="Delete user?"
        description={
          userPendingDelete ? (
            <>
              Are you sure you want to delete{" "}
              <strong>{getDisplayName(userPendingDelete)}</strong>? This action
              cannot be undone.
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
            Are you sure you want to delete{" "}
            <strong>{selectedUserIds.size}</strong>{" "}
            {selectedUserIds.size === 1 ? "selected user" : "selected users"}?
            This action cannot be undone.
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

      <Modal
        isOpen={isCreateModalOpen}
        title="New Project"
        description="Create a project shell for sources and member assignments."
        onClose={closeCreateModal}
        isDismissDisabled={isCreatingProject}
        footer={
          <>
            <button
              type="button"
              onClick={closeCreateModal}
              disabled={isCreatingProject}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-app-border bg-app-surface px-5 text-sm font-medium text-app-text transition-colors hover:bg-app-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="create-project-form"
              disabled={isCreatingProject || !newProjectName.trim()}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-app-brand bg-app-brand px-5 text-sm font-medium text-white transition-colors hover:border-app-brand-hover hover:bg-app-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCreatingProject ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Create Project
            </button>
          </>
        }
      >
        <form
          id="create-project-form"
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void handleCreateProject();
          }}
        >
          {createProjectError && (
            <div className="flex items-start gap-2 rounded-2xl border border-app-danger-border bg-app-danger-bg px-4 py-3 text-sm text-app-danger-text">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{createProjectError}</span>
            </div>
          )}

          <label className="block">
            <span className="text-sm font-medium text-app-text-muted">
              Name
            </span>
            <input
              value={newProjectName}
              onChange={(event) => setNewProjectName(event.target.value)}
              disabled={isCreatingProject}
              className="mt-1 h-11 w-full rounded-xl border border-app-border bg-app-surface px-3 text-sm font-medium text-app-text outline-none placeholder:text-app-text-disabled focus:border-app-brand-border-strong focus:ring-2 focus:ring-app-brand-glow disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-app-text-muted">
              Description
            </span>
            <textarea
              value={newProjectDescription}
              onChange={(event) => setNewProjectDescription(event.target.value)}
              disabled={isCreatingProject}
              rows={4}
              className="mt-1 min-h-28 w-full resize-y rounded-xl border border-app-border bg-app-surface px-3 py-2 text-sm font-medium leading-relaxed text-app-text outline-none placeholder:text-app-text-disabled focus:border-app-brand-border-strong focus:ring-2 focus:ring-app-brand-glow disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>
        </form>
      </Modal>
    </div>
  );
}
