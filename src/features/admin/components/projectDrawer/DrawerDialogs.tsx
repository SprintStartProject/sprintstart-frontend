import { AlertDialog } from "../../../../components/ui/AlertDialog";
import { getDisplayName } from "../../data";
import { discardDescription, moveDialogTitle } from "./drawerRules";
import type { Derived } from "./drawerRules";
import type { useDrawerActions } from "./useDrawerActions";
import type { useLeaveGuard } from "./useLeaveGuard";

type DialogsProps = {
  derived: Derived;
  actions: ReturnType<typeof useDrawerActions>;
  guard: ReturnType<typeof useLeaveGuard>;
};

/** The three questions the drawer can ask: move people, discard changes, delete the project. */
export function DrawerDialogs({ derived, actions, guard }: DialogsProps) {
  return (
    <>
      <MoveDialog derived={derived} actions={actions} />

      <AlertDialog
        isOpen={guard.isAsking}
        variant="danger"
        title="Discard unsaved changes?"
        description={discardDescription(derived.pendingChangeCount)}
        confirmLabel="Discard and leave"
        cancelLabel="Keep editing"
        onClose={guard.keepEditing}
        onConfirm={guard.confirmLeave}
      />

      <DeleteDialog derived={derived} actions={actions} />
    </>
  );
}

function MoveDialog({ derived, actions }: Omit<DialogsProps, "guard">) {
  return (
    <AlertDialog
      isOpen={actions.isMoveDialogOpen}
      variant="danger"
      title={moveDialogTitle(derived.movedUsers.length)}
      description={
        <>
          <span className="block">
            These people are in other projects and will be removed from them. Their project roles
            and onboarding progress are reset.
          </span>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            {derived.movedUsers.map(({ user, leaving }) => (
              <li key={user.id}>
                <span className="font-semibold text-app-text">{getDisplayName(user)}</span> (from{" "}
                {leaving.map((left) => left.name).join(", ")})
              </li>
            ))}
          </ul>
        </>
      }
      confirmLabel="Move and save"
      onClose={() => actions.setIsMoveDialogOpen(false)}
      onConfirm={actions.saveChanges}
    />
  );
}

function DeleteDialog({ derived, actions }: Omit<DialogsProps, "guard">) {
  const { memberCount, visibleProject } = derived;

  return (
    <AlertDialog
      isOpen={actions.isDeleteDialogOpen}
      title="Delete project?"
      description={
        <>
          <span className="font-semibold text-app-text">{visibleProject.name}</span> and its{" "}
          {memberCount} user assignment
          {memberCount === 1 ? "" : "s"} are deleted permanently. This cannot be undone.
        </>
      }
      confirmLabel="Delete project"
      cancelLabel="Cancel"
      variant="danger"
      isLoading={actions.isDeleting}
      loadingLabel="Deleting..."
      onClose={() => actions.setIsDeleteDialogOpen(false)}
      onConfirm={actions.confirmDelete}
    />
  );
}
