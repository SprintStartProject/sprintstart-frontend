import type { Dispatch, SetStateAction } from "react";
import { MemberPicker } from "../../MemberPicker";
import { toggleSelectedUserId, toggleVisibleUserSelection } from "../../../data";
import type { AdminUser } from "../../../types";

type WizardMembersStepProps = {
  users: AdminUser[];
  selectedUserIds: Set<string>;
  disabled?: boolean;
  onChange: Dispatch<SetStateAction<Set<string>>>;
};

/**
 * Step 2 of the create-project wizard: who works on the project. The manager
 * picked on the details step is already a member, so this list only adds the
 * rest — the review step folds the manager back into the member count.
 */
export function WizardMembersStep({
  users,
  selectedUserIds,
  disabled = false,
  onChange,
}: WizardMembersStepProps) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-app-text">Members</p>
        <p className="mt-1 text-sm leading-relaxed text-app-text-muted">
          Pick who works on this project. You can change the team later from the project drawer.
        </p>
      </div>

      <MemberPicker
        users={users}
        selectedUserIds={selectedUserIds}
        disabled={disabled}
        label="Members"
        onToggleUser={(userId) => onChange((current) => toggleSelectedUserId(current, userId))}
        onToggleVisible={(visibleUsers, allSelected) =>
          onChange((current) => toggleVisibleUserSelection(current, visibleUsers, allSelected))
        }
      />
    </div>
  );
}
