import { useMemo, useState } from "react";
import { useToast } from "../../context/useToast";
import type { ProjectRole } from "../../features/team-management/types";
import {
  assignProjectRoleToUser,
  unassignProjectRoleFromUser,
} from "../../services/teamManagementService";
import { unassignedRolesOf } from "./memberRules";
import type { MemberData } from "./useMemberData";

const failureText = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

/** Giving a member a role and taking one away, the removal behind a confirmation. */
export function useMemberRoles({ user, setUser, availableRoles }: MemberData) {
  const toast = useToast();
  const [savingRoleId, setSavingRoleId] = useState<string | null>(null);
  const [roleToRemove, setRoleToRemove] = useState<ProjectRole | null>(null);

  const assignable = useMemo(
    () => (user ? unassignedRolesOf(availableRoles, user) : []),
    [availableRoles, user],
  );

  async function add(roleId: string) {
    const roleToAdd = availableRoles.find((role) => role.id === roleId);
    if (!user || !roleToAdd) return;

    setSavingRoleId(roleId);
    try {
      await assignProjectRoleToUser(user.userId, roleId);
      setUser({ ...user, roles: [...user.roles, roleToAdd] });
      toast.success("Role assigned");
    } catch (error) {
      toast.error(failureText(error, "Couldn't assign the role."));
    } finally {
      setSavingRoleId(null);
    }
  }

  async function remove(roleId: string) {
    if (!user) return;

    setSavingRoleId(roleId);
    try {
      await unassignProjectRoleFromUser(user.userId, roleId);
      setUser({ ...user, roles: user.roles.filter((role) => role.id !== roleId) });
      toast.success("Role removed");
    } catch (error) {
      toast.error(failureText(error, "Couldn't remove the role."));
    } finally {
      setSavingRoleId(null);
    }
  }

  return { assignable, savingRoleId, roleToRemove, setRoleToRemove, add, remove };
}
