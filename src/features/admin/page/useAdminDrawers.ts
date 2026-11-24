import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DRAWER_CLOSE_DELAY_MS } from "../data";
import type { AdminTab, AdminUser, ProjectOverview, Skill } from "../types";
import { drawerOriginName, type DrawerOrigin } from "./pageRules";

type Selection = {
  users: AdminUser[];
  projects: ProjectOverview[];
  selectedUser: AdminUser | null;
  setSelectedUser: (user: AdminUser | null) => void;
  selectedProject: ProjectOverview | null;
  setSelectedProject: (project: ProjectOverview | null) => void;
};

type Args = {
  selection: Selection;
  setActiveTab: (tab: AdminTab) => void;
  /** Shows the whole project list again, as when a project is opened from a user drawer. */
  resetProjectList: () => void;
};

/** The thing a drawer shows: a user, a project, or a skill (or a new one being made). */
type Target = {
  user?: AdminUser;
  project?: ProjectOverview;
  skill?: Skill;
  creatingSkill?: boolean;
};

/**
 * Whether a drawer is open and what it shows besides the user and the project, which the data
 * hook holds. Closing is animated: the selection is cleared only after the slide-out, and opening
 * anything in that time has to cancel the clearing, or the stale timeout wipes the new selection
 * and the drawer vanishes again.
 */
function useDrawerFrame(clearSelection: () => void) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [isCreatingSkill, setIsCreatingSkill] = useState(false);
  // The drawer a drawer was opened from (a project of a user, a member of a project). Drawers
  // replace each other, so this is what lets the new one offer a way back. Only one step is kept:
  // going back clears it, and opening anything unrelated from the page does too.
  const [origin, setOrigin] = useState<DrawerOrigin | null>(null);
  // Cleaned up on unmount so that setState calls after teardown don't hit a missing `window` in
  // test environments.
  const closeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = useCallback(() => {
    if (closeTimeout.current !== null) {
      clearTimeout(closeTimeout.current);
      closeTimeout.current = null;
    }
  }, []);

  useEffect(() => cancelClose, [cancelClose]);

  function close() {
    setOrigin(null);
    setIsOpen(false);
    cancelClose();
    closeTimeout.current = setTimeout(() => {
      closeTimeout.current = null;
      clearSelection();
      setSelectedSkill(null);
      setIsCreatingSkill(false);
    }, DRAWER_CLOSE_DELAY_MS);
  }

  return {
    isOpen,
    setIsOpen,
    selectedSkill,
    setSelectedSkill,
    isCreatingSkill,
    setIsCreatingSkill,
    origin,
    setOrigin,
    cancelClose,
    close,
  };
}

type Frame = ReturnType<typeof useDrawerFrame>;

/** Shows exactly one thing in the drawer; whatever else was open goes. */
function useShowOnly(selection: Selection, frame: Frame, closeMenu: () => void) {
  const { setSelectedUser, setSelectedProject } = selection;
  const { cancelClose, setOrigin, setIsOpen, setSelectedSkill, setIsCreatingSkill } = frame;

  return (target: Target) => {
    cancelClose();
    setOrigin(null);
    closeMenu();
    setSelectedUser(target.user ?? null);
    setSelectedProject(target.project ?? null);
    setSelectedSkill(target.skill ?? null);
    setIsCreatingSkill(target.creatingSkill ?? false);
    setIsOpen(true);
  };
}

type HopArgs = Pick<Args, "selection" | "setActiveTab" | "resetProjectList"> & {
  frame: Frame;
  closeMenu: () => void;
  showOnly: (target: Target) => void;
};

/**
 * Drawers that replace each other with a way back: the project of a user, the member of a
 * project. The back link's label is looked up live, so a rename shows up and a deleted origin
 * simply offers no way back instead of a button that does nothing.
 */
function useDrawerHops({
  selection,
  setActiveTab,
  resetProjectList,
  frame,
  closeMenu,
  showOnly,
}: HopArgs) {
  const { users, projects, selectedUser, selectedProject } = selection;
  const { setSelectedUser, setSelectedProject } = selection;
  const { cancelClose, setOrigin, setIsOpen, origin } = frame;
  const originName = useMemo(
    () => drawerOriginName(origin, users, projects),
    [origin, users, projects],
  );

  function openProjectFromUser(projectId: string) {
    const project = projects.find((entry) => entry.id === projectId);
    if (!project) return;

    cancelClose();
    closeMenu();
    setOrigin(selectedUser ? { kind: "user", id: selectedUser.id } : null);
    setActiveTab("projects");
    resetProjectList();
    setSelectedUser(null);
    setSelectedProject(project);
    setIsOpen(true);
  }

  function openUserFromProject(userId: string) {
    const user = users.find((entry) => entry.id === userId);
    if (!user) return;

    cancelClose();
    closeMenu();
    setOrigin(selectedProject ? { kind: "project", id: selectedProject.id } : null);
    setActiveTab("users");
    setSelectedProject(null);
    setSelectedUser(user);
    setIsOpen(true);
  }

  function goBack() {
    if (origin?.kind === "user") {
      const user = users.find((entry) => entry.id === origin.id);
      if (user) {
        setActiveTab("users");
        showOnly({ user });
      }
    } else if (origin) {
      const project = projects.find((entry) => entry.id === origin.id);
      if (project) {
        setActiveTab("projects");
        showOnly({ project });
      }
    }
  }

  return {
    openProjectFromUser,
    openUserFromProject,
    backLink: originName ? { label: `Back to ${originName}`, onBack: goBack } : undefined,
  };
}

/** Opening the user, project and skill drawers, and getting back to where one was opened from. */
export function useAdminDrawers({ selection, setActiveTab, resetProjectList }: Args) {
  const { setSelectedUser, setSelectedProject } = selection;
  const [openUserMenuId, setOpenUserMenuId] = useState<string | null>(null);
  const frame = useDrawerFrame(() => {
    setSelectedUser(null);
    setSelectedProject(null);
  });
  const closeMenu = () => setOpenUserMenuId(null);
  const showOnly = useShowOnly(selection, frame, closeMenu);
  const hops = useDrawerHops({
    selection,
    setActiveTab,
    resetProjectList,
    frame,
    closeMenu,
    showOnly,
  });

  return {
    isOpen: frame.isOpen,
    setIsOpen: frame.setIsOpen,
    selectedSkill: frame.selectedSkill,
    setSelectedSkill: frame.setSelectedSkill,
    isCreatingSkill: frame.isCreatingSkill,
    origin: frame.origin,
    openUserMenuId,
    setOpenUserMenuId,
    backLink: hops.backLink,
    openProjectFromUser: hops.openProjectFromUser,
    openUserFromProject: hops.openUserFromProject,
    close: () => {
      closeMenu();
      frame.close();
    },
    openUser: (user: AdminUser) => showOnly({ user }),
    openProject: (project: ProjectOverview) => showOnly({ project }),
    openSkill: (skill: Skill) => showOnly({ skill }),
    openCreateSkill: () => showOnly({ creatingSkill: true }),
  };
}

export type AdminDrawers = ReturnType<typeof useAdminDrawers>;
