import { useMemo, type Dispatch, type SetStateAction } from "react";
import { MemberPicker } from "../../MemberPicker";
import { getDisplayName, toggleSelectedUserId, toggleVisibleUserSelection } from "../../../data";
import { useToast } from "../../../../../context/useToast";
import type { AdminUser } from "../../../types";

type WizardMembersStepProps = {
  users: AdminUser[];
  selectedUserIds: Set<string>;
  /** The manager picked on the Details step; shown pre-checked in the list. */
  managerId: string;
  disabled?: boolean;
  onChange: Dispatch<SetStateAction<Set<string>>>;
  /** Clears the manager when their member row is unchecked here. */
  onManagerRemoved: () => void;
};

/**
 * Step 2 of the create-project wizard: who works on the project. The manager
 * picked on the details step is already a member, so they show pre-checked here
 * — and unchecking them also drops them as manager, surfaced with a single info
 * toast so it is never a silent side effect.
 */
export function WizardMembersStep({
  users,
  selectedUserIds,
  managerId,
  disabled = false,
  onChange,
  onManagerRemoved,
}: WizardMembersStepProps) {
  const toast = useToast();

  const managerName = useMemo(() => {
    const manager = users.find((user) => user.id === managerId);
    return manager ? getDisplayName(manager) : null;
  }, [users, managerId]);

  // The manager is always a member, so show them checked even if they were never
  // added to the member set explicitly.
  const displaySelected = useMemo(() => {
    if (!managerId || selectedUserIds.has(managerId)) return selectedUserIds;
    const next = new Set(selectedUserIds);
    next.add(managerId);
    return next;
  }, [selectedUserIds, managerId]);

  const handleToggleUser = (userId: string) => {
    if (userId === managerId) {
      // Unchecking the manager drops both their membership and the manager role.
      onManagerRemoved();
      onChange((current) => {
        if (!current.has(userId)) return current;
        const next = new Set(current);
        next.delete(userId);
        return next;
      });
      toast.info(`${managerName ?? "This member"} is no longer the project manager.`);
      return;
    }

    onChange((current) => toggleSelectedUserId(current, userId));
  };

  return (
    <MemberPicker
      users={users}
      selectedUserIds={displaySelected}
      disabled={disabled}
      label="Add members"
      onToggleUser={handleToggleUser}
      onToggleVisible={(visibleUsers, allSelected) =>
        onChange((current) => toggleVisibleUserSelection(current, visibleUsers, allSelected))
      }
    />
  );
}
