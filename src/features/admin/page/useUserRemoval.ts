import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  areAllVisibleUsersSelected,
  removeUsersFromProjects,
  toggleSelectedUserId,
  toggleVisibleUserSelection,
} from "../data";
import { adminUserService } from "../../../services/adminUserService";
import type { AdminUser, ProjectOverview } from "../types";
import { withoutId } from "./pageRules";

type Env = {
  selectedUser: AdminUser | null;
  setUsers: Dispatch<SetStateAction<AdminUser[]>>;
  setProjects: Dispatch<SetStateAction<ProjectOverview[]>>;
  setSelectedUser: Dispatch<SetStateAction<AdminUser | null>>;
  /** Closes the drawer, when the user it shows is one of those removed. */
  closeDrawer: () => void;
};

/** What the page forgets about users that are gone. */
function forgetUsers(env: Env, ids: Set<string>) {
  env.setUsers((users) => users.filter((user) => !ids.has(user.id)));
  env.setProjects((projects) => removeUsersFromProjects(projects, ids));
  env.setSelectedUser((current) => (current && ids.has(current.id) ? null : current));
  if (env.selectedUser && ids.has(env.selectedUser.id)) env.closeDrawer();
}

/** The ticks in the users table. */
function useUserTicks(visibleUsers: AdminUser[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const allVisibleSelected = areAllVisibleUsersSelected(visibleUsers, selectedIds);

  return {
    selectedIds,
    allVisibleSelected,
    toggle: (userId: string) => setSelectedIds((current) => toggleSelectedUserId(current, userId)),
    toggleAllVisible: () =>
      setSelectedIds((current) =>
        toggleVisibleUserSelection(current, visibleUsers, allVisibleSelected),
      ),
    forget: (userId: string) => setSelectedIds((current) => withoutId(current, userId)),
    clear: () => setSelectedIds(new Set()),
  };
}

/** One user, asked about in a dialog of its own. */
function useSingleDeletion(env: Env, ticks: ReturnType<typeof useUserTicks>) {
  const [pending, setPending] = useState<AdminUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    if (!pending) return;
    const userId = pending.id;

    setIsDeleting(true);
    setError("");
    try {
      await adminUserService.deleteUser(userId);
      forgetUsers(env, new Set([userId]));
      ticks.forget(userId);
      setPending(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "User could not be deleted.");
    } finally {
      setIsDeleting(false);
    }
  }

  return {
    pending,
    isDeleting,
    error,
    request: (user: AdminUser) => {
      setError("");
      setPending(user);
    },
    cancel: () => {
      if (isDeleting) return;
      setPending(null);
      setError("");
    },
    confirm,
  };
}

/** Everyone ticked, asked about in one dialog. */
function useBulkDeletion(env: Env, ticks: ReturnType<typeof useUserTicks>) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    const ids = Array.from(ticks.selectedIds);
    if (ids.length === 0) {
      setIsOpen(false);
      return;
    }

    setIsDeleting(true);
    setError("");
    try {
      await Promise.all(ids.map((userId) => adminUserService.deleteUser(userId)));
      forgetUsers(env, new Set(ids));
      ticks.clear();
      setIsOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Selected users could not be deleted.");
    } finally {
      setIsDeleting(false);
    }
  }

  return {
    isOpen,
    isDeleting,
    error,
    request: () => {
      if (ticks.selectedIds.size === 0) return;
      setError("");
      setIsOpen(true);
    },
    cancel: () => {
      if (isDeleting) return;
      setIsOpen(false);
      setError("");
    },
    confirm,
  };
}

/** Ticking users in the table, and deleting one or all of the ticked. */
export function useUserRemoval(env: Env, visibleUsers: AdminUser[]) {
  const ticks = useUserTicks(visibleUsers);
  const single = useSingleDeletion(env, ticks);
  const bulk = useBulkDeletion(env, ticks);

  return { ticks, single, bulk };
}

export type UserRemoval = ReturnType<typeof useUserRemoval>;
