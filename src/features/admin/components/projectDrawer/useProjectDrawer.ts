import type { AdminProjectDetails, AdminUser, ProjectOverview } from "../../types";
import { deriveDrawer } from "./drawerRules";
import { useDrawerActions } from "./useDrawerActions";
import { useLeaveGuard } from "./useLeaveGuard";
import { useProjectForm } from "./useProjectForm";

type Input = {
  project: ProjectOverview;
  availableUsers: AdminUser[];
  isOpen: boolean;
  onClose: () => void;
  onProjectUpdated?: (updatedProject: AdminProjectDetails) => void;
  onProjectDeleted?: (projectId: string) => void;
  onMembershipsMoved?: () => void;
};

/** The project, its drafts, what follows from them, the actions, and the guard on leaving. */
export function useProjectDrawer(input: Input) {
  const { project } = input;
  const form = useProjectForm(project, input.isOpen);
  const derived = deriveDrawer({
    project,
    projectDetails: form.projectDetails,
    draftProject: form.draftProject,
    peopleDraft: form.peopleDraft,
    availableUsers: input.availableUsers,
  });
  const actions = useDrawerActions({
    project,
    form,
    derived,
    onClose: input.onClose,
    onProjectUpdated: input.onProjectUpdated,
    onProjectDeleted: input.onProjectDeleted,
    onMembershipsMoved: input.onMembershipsMoved,
  });
  const guard = useLeaveGuard(derived.hasPendingChanges, actions.discardChanges);

  const updateField = (field: "name" | "description", value: string) => {
    actions.clearSaveError();
    form.updateDraftField(field, value);
  };

  return { form, derived, actions, guard, updateField };
}
