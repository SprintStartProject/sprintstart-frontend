import { AlertDialog } from "../../../components/ui/AlertDialog";
import { nameList } from "../roleRules";

type DeleteRoleDialogProps = {
  /** The dialog is open while a role is asked to be deleted. */
  open: boolean;
  /** Its name, when it is still in the list. */
  roleName: string | undefined;
  /** What deleting would take away, so the confirmation can say it before it happens. */
  impact: { members: string[]; skills: number } | null;
  onClose: () => void;
  onConfirm: () => void;
};

export function DeleteRoleDialog({
  open,
  roleName,
  impact,
  onClose,
  onConfirm,
}: DeleteRoleDialogProps) {
  return (
    <AlertDialog
      isOpen={open}
      title="Confirm deletion"
      description={
        <>
          Are you sure you want to delete{" "}
          <span className="font-medium text-app-text">{roleName ?? "this item"}</span>?
          {impact && impact.members.length > 0 && (
            <>
              {" "}
              {impact.members.length === 1
                ? "1 member loses"
                : `${impact.members.length} members lose`}{" "}
              this role: {nameList(impact.members)}.
            </>
          )}
          {impact && impact.skills > 0 && (
            <>
              {" "}
              {impact.skills === 1 ? "Its 1 skill stays" : `Its ${impact.skills} skills stay`} in
              the catalog, no longer linked to the role.
            </>
          )}{" "}
          This action cannot be undone.
        </>
      }
      confirmLabel="Delete"
      variant="danger"
      onClose={() => onClose()}
      onConfirm={() => onConfirm()}
    />
  );
}
