import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { AdminUser, Skill } from "../types";
import type { AdminSources } from "./useAdminSources";
import { useAdminDrawers } from "./useAdminDrawers";
import { useAdminSync } from "./useAdminSync";
import { useDeepLinkOpening } from "./useDeepLinkOpening";
import { useUserRemoval } from "./useUserRemoval";

/** The project wizard: step 2 needs the saved PAT names, which are only fetched on demand. */
function useCreateWizard({ tokensLoaded, loadTokenNames }: AdminSources["data"]) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => {
    // Without visiting the tokens tab first they were never fetched.
    if (!tokensLoaded) void loadTokenNames();
    setIsOpen(true);
  }, [loadTokenNames, tokensLoaded]);

  return { isOpen, open, close: () => setIsOpen(false) };
}

/** Everything the page does in response to the person: open, delete, save, switch. */
export function useAdminInteractions(
  sources: AdminSources,
  reloadProjects: () => Promise<void> | void,
) {
  const navigate = useNavigate();
  const { data, pool, handoff, userList } = sources;
  const { setUsers, setProjects, setSelectedUser, setSelectedProject } = data;

  const drawers = useAdminDrawers({
    selection: data,
    setActiveTab: handoff.setActiveTab,
    resetProjectList: sources.projectList.reset,
  });
  useDeepLinkOpening({
    pending: handoff.pendingDeepLink,
    clearPending: () => handoff.setPendingDeepLink(null),
    loaded: data.loadingState === "success",
    users: data.users,
    projects: data.projects,
    setSelectedUser,
    setSelectedProject,
    setActiveTab: handoff.setActiveTab,
    openDrawer: () => drawers.setIsOpen(true),
  });
  const removal = useUserRemoval(
    {
      selectedUser: data.selectedUser,
      setUsers,
      setProjects,
      setSelectedUser,
      closeDrawer: () => drawers.setIsOpen(false),
    },
    userList.paginated,
  );
  const sync = useAdminSync({
    setUsers,
    setProjects,
    setSelectedUser,
    setSelectedProject,
    reloadProjects,
  });

  return {
    drawers,
    removal,
    sync,
    requestUserDelete: (user: AdminUser) => {
      drawers.setOpenUserMenuId(null);
      removal.single.request(user);
    },
    openSourceDetails: (projectId: string, sourceId: string) =>
      void navigate(`/data-ingestion?${new URLSearchParams({ projectId, sourceId }).toString()}`),
    openDataIngestion: (projectId: string) =>
      void navigate(`/data-ingestion?${new URLSearchParams({ projectId }).toString()}`),
    wizard: useCreateWizard(data),
    saveSkill: (skill: Skill) => {
      pool.upsertSkill(skill);
      drawers.setSelectedSkill((current) => (current?.id === skill.id ? skill : current));
    },
  };
}

export type AdminInteractions = ReturnType<typeof useAdminInteractions>;
