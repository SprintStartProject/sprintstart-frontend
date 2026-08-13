import { AlertDialog } from "../../../../components/ui/AlertDialog";
import type { ProjectRole } from "../../types";

type MemberDetailDialogsProps = {
  firstName: string;
  roleToRemove: ProjectRole | null;
  savingRoleId: string | null;
  onCancelRoleRemove: () => void;
  onConfirmRoleRemove: (role: ProjectRole) => void;
};

export function MemberDetailDialogs({
  firstName,
  roleToRemove,
  savingRoleId,
  onCancelRoleRemove,
  onConfirmRoleRemove,
}: MemberDetailDialogsProps) {
  return (
    <>
      <AlertDialog
        isOpen={Boolean(roleToRemove)}
        title="Remove Role"
        description={
          roleToRemove ? (
            <>
              Are you sure you want to remove the role{" "}
              <span className="font-medium text-app-text">{roleToRemove.name}</span> from{" "}
              {firstName}?
            </>
          ) : undefined
        }
        confirmLabel="Remove"
        variant="danger"
        isLoading={Boolean(roleToRemove && savingRoleId === roleToRemove.id)}
        loadingLabel="Removing..."
        onClose={onCancelRoleRemove}
        onConfirm={() => {
          if (roleToRemove) {
            onConfirmRoleRemove(roleToRemove);
          }
        }}
      />
    </>
  );
}
