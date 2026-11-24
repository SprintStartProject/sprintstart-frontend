import type { MouseEvent } from "react";
import { AdminPagination } from "../components/AdminPagination";
import { AdminProjectsToolbar } from "../components/AdminProjectsToolbar";
import { AdminSkillsToolbar } from "../components/AdminSkillsToolbar";
import { AdminUsersToolbar } from "../components/AdminUsersToolbar";
import { ProjectsTab } from "../components/ProjectsTab";
import { SkillsTab } from "../components/SkillsTab";
import { TokensTab } from "../components/TokensTab";
import { UsersTab } from "../components/UsersTab";
import type { AdminUser } from "../types";
import type { AdminInteractions } from "./useAdminInteractions";
import type { AdminSources } from "./useAdminSources";

type SectionProps = { sources: AdminSources; interactions: AdminInteractions };

export function UsersSection({ sources, interactions }: SectionProps) {
  const { userList, data } = sources;
  const { drawers, removal } = interactions;
  const { ticks } = removal;

  const stop = (event: MouseEvent<HTMLButtonElement>) => event.stopPropagation();

  return (
    <>
      <AdminUsersToolbar
        userCount={userList.filtered.length}
        selectedUserCount={ticks.selectedIds.size}
        searchValue={userList.search}
        userFilter={userList.filter}
        onSearchChange={userList.setSearch}
        onFilterChange={userList.setFilter}
        onRequestBulkDelete={() => {
          if (ticks.selectedIds.size === 0) return;
          drawers.setOpenUserMenuId(null);
          removal.bulk.request();
        }}
      />

      <UsersTab
        paginatedUsers={userList.paginated}
        projects={data.projects}
        selectedUserIds={ticks.selectedIds}
        allVisibleUsersSelected={ticks.allVisibleSelected}
        openUserMenuId={drawers.openUserMenuId}
        onToggleAllVisibleUsers={ticks.toggleAllVisible}
        onToggleUserSelection={ticks.toggle}
        onOpenUserDetails={drawers.openUser}
        onToggleUserContextMenu={(event, userId) => {
          stop(event);
          drawers.setOpenUserMenuId((current) => (current === userId ? null : userId));
        }}
        onOpenUserDetailsFromMenu={(event, user: AdminUser) => {
          stop(event);
          drawers.openUser(user);
        }}
        onRequestUserDeleteFromMenu={(event, user) => {
          stop(event);
          interactions.requestUserDelete(user);
        }}
      />

      <AdminPagination
        safePage={userList.safePage}
        totalPages={userList.totalPages}
        onPageChange={userList.setPage}
      />
    </>
  );
}

export function ProjectsSection({ sources, interactions }: SectionProps) {
  const { projectList, data } = sources;

  return (
    <>
      <AdminProjectsToolbar
        projectCount={projectList.filtered.length}
        projectSearchValue={projectList.search}
        projectFilter={projectList.filter}
        onProjectSearchChange={projectList.setSearch}
        onProjectFilterChange={projectList.setFilter}
        onCreateProject={interactions.wizard.open}
      />

      <ProjectsTab
        filteredProjects={projectList.paginated}
        users={data.users}
        isFiltered={projectList.isFiltered}
        totalCount={data.projects.length}
        onOpenProjectDetails={interactions.drawers.openProject}
      />

      <AdminPagination
        safePage={projectList.safePage}
        totalPages={projectList.totalPages}
        onPageChange={projectList.setPage}
      />
    </>
  );
}

export function SkillsSection({ sources, interactions }: SectionProps) {
  const { skillList, pool } = sources;

  return (
    <>
      <AdminSkillsToolbar
        skillCount={skillList.filtered.length}
        searchValue={skillList.search}
        statusFilter={skillList.status}
        categoryFilter={skillList.category}
        categoryOptions={skillList.categories}
        roleFilter={skillList.role}
        roleOptions={pool.roles}
        onSearchChange={skillList.setSearch}
        onStatusFilterChange={skillList.setStatus}
        onCategoryFilterChange={skillList.setCategory}
        onRoleFilterChange={skillList.setRole}
        onCreateSkill={interactions.drawers.openCreateSkill}
      />

      <SkillsTab
        skills={skillList.paginated}
        roles={pool.roles}
        loadingState={pool.loadingState}
        errorMessage={pool.errorMessage}
        hasSearchQuery={skillList.hasSearch}
        totalCount={pool.skills.length}
        onOpenSkillDetails={interactions.drawers.openSkill}
        onRetryLoad={() => void pool.loadSkillPool(true)}
      />

      <AdminPagination
        safePage={skillList.safePage}
        totalPages={skillList.totalPages}
        onPageChange={skillList.setPage}
      />
    </>
  );
}

/** The section of the active tab. */
export function ActiveSection({ sources, interactions }: SectionProps) {
  switch (sources.handoff.activeTab) {
    case "users":
      return <UsersSection sources={sources} interactions={interactions} />;
    case "projects":
      return <ProjectsSection sources={sources} interactions={interactions} />;
    case "skills":
      return <SkillsSection sources={sources} interactions={interactions} />;
    default:
      return (
        <TokensTab
          sourceFilter={sources.accessSourceFilter}
          onSourceFilterChange={sources.setAccessSourceFilter}
        />
      );
  }
}
