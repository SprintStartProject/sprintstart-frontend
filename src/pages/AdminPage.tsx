import { useCallback, useMemo, useRef, useEffect, useState } from "react";
import type { MouseEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, RefreshCw, Terminal } from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { AlertDialog } from "../components/ui/AlertDialog";
import { Button } from "../components/ui/Button";
import { Spinner } from "../components/ui/Spinner";
import { SCROLL_CONTAINER_ATTRIBUTE } from "../components/ui/useScrollLock";
import {
  DRAWER_CLOSE_DELAY_MS,
  areAllVisibleUsersSelected,
  filterAdminProjects,
  filterAdminUsers,
  filterSkills,
  getAvailableProjects,
  getDisplayName,
  getPaginatedProjects,
  getPaginatedSkills,
  getPaginatedUsers,
  getSafePage,
  getSkillCategories,
  getTotalPages,
  removeUsersFromProjects,
  toggleSelectedUserId,
  toggleVisibleUserSelection,
} from "../features/admin/data";
import { DEFAULT_ACCESS_SOURCE_FILTER } from "../features/access/components/AccessManagementView";
import { AdminMetrics } from "../features/admin/components/AdminMetrics";
import { AdminPagination } from "../features/admin/components/AdminPagination";
import { AdminProjectsToolbar } from "../features/admin/components/AdminProjectsToolbar";
import { AdminSkillsToolbar } from "../features/admin/components/AdminSkillsToolbar";
import { AdminUsersToolbar } from "../features/admin/components/AdminUsersToolbar";
import { CreateProjectWizard } from "../features/admin/components/CreateProjectWizard";
import { ProjectDetailsDrawer } from "../features/admin/components/ProjectDetailsDrawer";
import { ProjectsTab } from "../features/admin/components/ProjectsTab";
import { SkillDetailsDrawer } from "../features/admin/components/SkillDetailsDrawer";
import { SkillsTab } from "../features/admin/components/SkillsTab";
import { TabSwitcher } from "../features/admin/components/TabSwitcher";
import { TokensTab } from "../features/admin/components/TokensTab";
import { UserDetailsDrawer } from "../features/admin/components/UserDetailsDrawer";
import { UsersTab } from "../features/admin/components/UsersTab";
import { useAdminData } from "../features/admin/hooks/useAdminData";
import { useSkillPool } from "../features/admin/hooks/useSkillPool";
import { useAuth } from "../context/useAuth";
import { useProjectContext } from "../features/projects/useProjectContext";
import { ADMIN_TAB_ORDER } from "../features/admin/types";
import type {
  AdminProjectDetails,
  AdminTab,
  AdminUser,
  ProjectOverview,
  Skill,
  SkillStatusFilter,
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
  // Skills is ADMIN-only: every mutation on it (create/update/retire) 403s for
  // HR, so the tab itself is hidden rather than shown and failing on click.
  const visibleAdminTabs = useMemo(
    () => ADMIN_TAB_ORDER.filter((tab) => tab !== "skills" || profile?.permissionGroup === "ADMIN"),
    [profile],
  );
  /*
    `?tab=projects` opens the page on that section. The dashboard's Projects card links here,
    and without this it always landed on Users — a card about projects dropping the reader on
    a list of people.

    A hand-off, not a permanent part of the URL: it seeds the tab once and is then stripped, so
    the tab bar keeps behaving exactly as before and the back button does not turn into a
    step-through of sections.
  */
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<AdminTab>(() => {
    const requested = searchParams.get("tab");
    return visibleAdminTabs.find((tab) => tab === requested) ?? "users";
  });

  const tabParamConsumed = useRef(false);

  useEffect(() => {
    if (tabParamConsumed.current) return;
    tabParamConsumed.current = true;

    if (!searchParams.has("tab")) return;

    const next = new URLSearchParams(searchParams);
    next.delete("tab");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [isCreatingSkill, setIsCreatingSkill] = useState(false);

  const [searchValue, setSearchValue] = useState("");
  const [projectSearchValue, setProjectSearchValue] = useState("");
  const [userFilter, setUserFilter] = useState<UserFilter>("all");
  // Lives here, not in the tokens section, for the same reason as the two
  // above: only one tab is mounted at a time, so a filter kept inside a section
  // would reset every time you leave and come back.
  const [accessSourceFilter, setAccessSourceFilter] = useState<string>(
    DEFAULT_ACCESS_SOURCE_FILTER,
  );
  // Same reasoning as the filter above: the Skills tab unmounts when you
  // leave it, so its search/filters live here instead of resetting on every
  // visit.
  const [skillSearchValue, setSkillSearchValue] = useState("");
  const [skillStatusFilter, setSkillStatusFilter] = useState<SkillStatusFilter>("all");
  const [skillCategoryFilter, setSkillCategoryFilter] = useState("all");
  const [skillRoleFilter, setSkillRoleFilter] = useState("all");

  const [page, setPage] = useState(1);
  const [projectPage, setProjectPage] = useState(1);
  const [skillPage, setSkillPage] = useState(1);
  const [openUserMenuId, setOpenUserMenuId] = useState<string | null>(null);
  const [userPendingDelete, setUserPendingDelete] = useState<AdminUser | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [deleteUserErrorMessage, setDeleteUserErrorMessage] = useState("");

  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [isBulkDeletingUsers, setIsBulkDeletingUsers] = useState(false);
  const [bulkDeleteErrorMessage, setBulkDeleteErrorMessage] = useState("");

  const [isCreateWizardOpen, setIsCreateWizardOpen] = useState(false);

  /**
   * Ref for the animated drawer-close timeout. Cleaned up on unmount so
   * that setState calls after teardown don't hit a missing `window` in
   * test environments.
   */
  const drawerCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Stops a running close animation from clearing the selection afterwards.
   * Every handler that opens a drawer has to call this first: otherwise opening
   * something within the close delay of the previous drawer lets the stale
   * timeout wipe the new selection and the drawer vanishes again.
   */
  const cancelPendingDrawerClose = () => {
    if (drawerCloseTimeoutRef.current !== null) {
      clearTimeout(drawerCloseTimeoutRef.current);
      drawerCloseTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (drawerCloseTimeoutRef.current !== null) {
        clearTimeout(drawerCloseTimeoutRef.current);
      }
    };
  }, []);

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

  const {
    skills: skillPool,
    roles: skillPoolRoles,
    loadingState: skillPoolLoadingState,
    errorMessage: skillPoolErrorMessage,
    loadSkillPool,
    upsertSkill,
  } = useSkillPool();

  // Lazy, like the tokens section: only fetched once this tab is actually
  // opened. `loadSkillPool` itself no-ops on repeat calls unless forced, so
  // switching back to the tab later does not refetch.
  useEffect(() => {
    if (activeTab === "skills") {
      void loadSkillPool();
    }
  }, [activeTab, loadSkillPool]);

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

  const projectTotalPages = getTotalPages(filteredProjects.length);
  const safeProjectPage = getSafePage(projectPage, projectTotalPages);

  const paginatedProjects = useMemo(() => {
    return getPaginatedProjects(filteredProjects, safeProjectPage);
  }, [filteredProjects, safeProjectPage]);

  const skillCategories = useMemo(() => getSkillCategories(skillPool), [skillPool]);

  const filteredSkills = useMemo(() => {
    return filterSkills(
      skillPool,
      skillSearchValue,
      skillStatusFilter,
      skillCategoryFilter,
      skillRoleFilter,
    );
  }, [skillPool, skillSearchValue, skillStatusFilter, skillCategoryFilter, skillRoleFilter]);

  const skillTotalPages = getTotalPages(filteredSkills.length);
  const safeSkillPage = getSafePage(skillPage, skillTotalPages);

  const paginatedSkills = useMemo(() => {
    return getPaginatedSkills(filteredSkills, safeSkillPage);
  }, [filteredSkills, safeSkillPage]);

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
    cancelPendingDrawerClose();
    setOpenUserMenuId(null);
    setSelectedProject(null);
    setSelectedSkill(null);
    setIsCreatingSkill(false);
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
    cancelPendingDrawerClose();
    setOpenUserMenuId(null);
    setSelectedUser(null);
    setSelectedSkill(null);
    setIsCreatingSkill(false);
    setSelectedProject(project);
    setIsDrawerOpen(true);
  };

  const openSkillDetails = (skill: Skill) => {
    cancelPendingDrawerClose();
    setOpenUserMenuId(null);
    setSelectedUser(null);
    setSelectedProject(null);
    setIsCreatingSkill(false);
    setSelectedSkill(skill);
    setIsDrawerOpen(true);
  };

  const openCreateSkillDrawer = () => {
    cancelPendingDrawerClose();
    setOpenUserMenuId(null);
    setSelectedUser(null);
    setSelectedProject(null);
    setSelectedSkill(null);
    setIsCreatingSkill(true);
    setIsDrawerOpen(true);
  };

  const handleSkillSaved = (updatedSkill: Skill) => {
    upsertSkill(updatedSkill);
    setSelectedSkill((current) => (current?.id === updatedSkill.id ? updatedSkill : current));
  };

  const openProjectDetailsFromUserDrawer = (projectId: string) => {
    const project = projects.find((currentProject) => currentProject.id === projectId);

    if (!project) return;

    cancelPendingDrawerClose();
    setOpenUserMenuId(null);
    setActiveTab("projects");
    setProjectSearchValue("");
    setProjectPage(1);
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

    cancelPendingDrawerClose();
    drawerCloseTimeoutRef.current = setTimeout(() => {
      drawerCloseTimeoutRef.current = null;
      setSelectedUser(null);
      setSelectedProject(null);
      setSelectedSkill(null);
      setIsCreatingSkill(false);
    }, DRAWER_CLOSE_DELAY_MS);
  };

  // Switching tabs only closes a drawer that is actually open; scheduling a
  // close for nothing would leave a timeout behind that could clear a drawer
  // opened right after the switch.
  const handleTabChange = (tab: AdminTab) => {
    setOpenUserMenuId(null);

    if (isDrawerOpen) {
      closeDetails();
    }

    setActiveTab(tab);
  };

  // Two-finger swipe between the sections, for people who would rather not aim
  // at the bar.
  const swipeRef = useSwipeableTabs<AdminTab, HTMLElement>({
    order: visibleAdminTabs,
    value: activeTab,
    onChange: handleTabChange,
  });

  const showInitialLoading = loadingState === "idle" || loadingState === "loading";
  const isSkillsTabActive = activeTab === "skills";

  const handleRefresh = () => {
    if (isSkillsTabActive) {
      void loadSkillPool(true);
      return;
    }

    void refreshAdminData();
  };

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
      // Below lg the app shell offsets the page by the 64px fixed mobile
      // header (App's main has pt-[64px] lg:pt-0). A plain h-dvh would then run
      // 64px past the viewport, hiding the last row of content (e.g. the
      // pagination) below the fold, so subtract the header there.
      className="h-[calc(100dvh-64px)] overflow-y-scroll overscroll-contain lg:h-dvh"
    >
      <header className="border-b border-app-border bg-app-bg">
        <div className="admin-page-frame py-4 sm:py-6">
          <PageHeader
            icon={Terminal}
            title="Access Management"
            subtitle="Manage users, projects, access tokens and the skill pool."
            actions={<AdminMetrics userCount={users.length} projectCount={projects.length} />}
          />
        </div>
      </header>

      <main className="admin-page-frame py-4 sm:py-6">
        {/* No card around the sections, matching the other tabbed pages: the
            box drew a second frame inside the page frame and made the tab bar
            look like it belonged to a widget rather than to the page. */}
        <div className="mb-6 flex items-center gap-3 sm:justify-between">
          <TabSwitcher activeTab={activeTab} onChange={handleTabChange} tabs={visibleAdminTabs} />

          <Button
            variant="secondary"
            iconOnly
            onClick={handleRefresh}
            disabled={isSkillsTabActive ? skillPoolLoadingState === "loading" : isRefreshing}
            className="shrink-0"
            aria-label="Refresh admin data"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                (isSkillsTabActive ? skillPoolLoadingState === "loading" : isRefreshing)
                  ? "animate-spin"
                  : ""
              }`}
            />
          </Button>
        </div>

        {/* Clipped horizontally because the section content slides in from
              the side; without it the travel briefly widens the page. `clip`
              rather than `hidden`, so this does not become a scroll container
              and swallow sticky positioning inside the sections. */}
        <div className="overflow-x-clip">
          {showInitialLoading ? (
            <div className="flex min-h-96 items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-app-text-muted">
                <Spinner size="lg" silent />
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
                <Button variant="primary" onClick={() => void refreshAdminData()} className="mt-5">
                  Try again
                </Button>
              </div>
            </div>
          ) : (
            // Only the tab content slides; the loading and error states above
            // are not tabs and would otherwise animate on their way in too.
            <SlidingTabPanel activeKey={activeTab} index={visibleAdminTabs.indexOf(activeTab)}>
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
                    onProjectSearchChange={(value) => {
                      setProjectSearchValue(value);
                      setProjectPage(1);
                    }}
                    onCreateProject={openCreateWizard}
                  />

                  <ProjectsTab
                    filteredProjects={paginatedProjects}
                    hasSearchQuery={projectSearchValue.trim().length > 0}
                    totalCount={projects.length}
                    onOpenProjectDetails={openProjectDetails}
                  />

                  <AdminPagination
                    safePage={safeProjectPage}
                    totalPages={projectTotalPages}
                    onPageChange={setProjectPage}
                  />
                </>
              ) : activeTab === "skills" ? (
                <>
                  <AdminSkillsToolbar
                    skillCount={filteredSkills.length}
                    searchValue={skillSearchValue}
                    statusFilter={skillStatusFilter}
                    categoryFilter={skillCategoryFilter}
                    categoryOptions={skillCategories}
                    roleFilter={skillRoleFilter}
                    roleOptions={skillPoolRoles}
                    onSearchChange={(value) => {
                      setSkillSearchValue(value);
                      setSkillPage(1);
                    }}
                    onStatusFilterChange={(value) => {
                      setSkillStatusFilter(value);
                      setSkillPage(1);
                    }}
                    onCategoryFilterChange={(value) => {
                      setSkillCategoryFilter(value);
                      setSkillPage(1);
                    }}
                    onRoleFilterChange={(value) => {
                      setSkillRoleFilter(value);
                      setSkillPage(1);
                    }}
                    onCreateSkill={openCreateSkillDrawer}
                  />

                  <SkillsTab
                    skills={paginatedSkills}
                    roles={skillPoolRoles}
                    loadingState={skillPoolLoadingState}
                    errorMessage={skillPoolErrorMessage}
                    hasSearchQuery={skillSearchValue.trim().length > 0}
                    totalCount={skillPool.length}
                    onOpenSkillDetails={openSkillDetails}
                    onRetryLoad={() => void loadSkillPool(true)}
                  />

                  <AdminPagination
                    safePage={safeSkillPage}
                    totalPages={skillTotalPages}
                    onPageChange={setSkillPage}
                  />
                </>
              ) : (
                <TokensTab
                  sourceFilter={accessSourceFilter}
                  onSourceFilterChange={setAccessSourceFilter}
                />
              )}
            </SlidingTabPanel>
          )}
        </div>
      </main>

      {(selectedUser || selectedProject || selectedSkill || isCreatingSkill) && (
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
          onMembershipsMoved={() => void refreshAdminData()}
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
          onMembershipsMoved={() => void refreshAdminData()}
        />
      )}

      {(selectedSkill || isCreatingSkill) && (
        // Keyed the same way as the project drawer, so switching between two
        // skills (or into create mode) always starts from a fresh draft.
        <SkillDetailsDrawer
          key={selectedSkill?.id ?? "create-skill"}
          skill={selectedSkill}
          skills={skillPool}
          roles={skillPoolRoles}
          isOpen={isDrawerOpen}
          onClose={closeDetails}
          onSkillSaved={handleSkillSaved}
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
        existingProjectNames={projects.map((project) => project.name)}
        onClose={() => setIsCreateWizardOpen(false)}
        onProjectCreated={handleProjectCreated}
        onMembershipsMoved={() => void refreshAdminData()}
      />
    </div>
  );
}
