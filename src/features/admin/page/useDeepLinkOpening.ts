import type { Dispatch, SetStateAction } from "react";
import type { AdminTab, AdminUser, ProjectOverview } from "../types";
import { resolveDeepLink, type DeepLink } from "./pageRules";

type Args = {
  pending: DeepLink | null;
  clearPending: () => void;
  /** The lists have loaded, so the record a link names can be found. */
  loaded: boolean;
  users: AdminUser[];
  projects: ProjectOverview[];
  setSelectedUser: Dispatch<SetStateAction<AdminUser | null>>;
  setSelectedProject: Dispatch<SetStateAction<ProjectOverview | null>>;
  setActiveTab: (tab: AdminTab) => void;
  openDrawer: () => void;
};

/**
 * Opens the drawer a `?projectId=` / `?userId=` link asked for. It waits for the lists, and a link
 * to something that does not exist any more simply opens nothing rather than an error -- the page
 * underneath is still the right place.
 *
 * Done while rendering rather than in an effect: this is state derived from data arriving, and it
 * settles in one extra render because the link is cleared as it is applied. No drawer can be
 * closing yet, so there is no pending close to cancel.
 */
export function useDeepLinkOpening({
  pending,
  clearPending,
  loaded,
  users,
  projects,
  setSelectedUser,
  setSelectedProject,
  setActiveTab,
  openDrawer,
}: Args) {
  if (!pending || !loaded) return;

  const target = resolveDeepLink(pending, projects, users);
  clearPending();
  if (!target) return;

  setSelectedProject(target.project);
  setSelectedUser(target.user);
  setActiveTab(target.tab);
  openDrawer();
}
