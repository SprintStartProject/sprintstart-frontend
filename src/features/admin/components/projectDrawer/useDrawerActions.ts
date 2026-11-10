import { useState } from "react";
import { useToast } from "../../../../context/useToast";
import type { AdminProjectDetails, ProjectOverview } from "../../types";
import type { Derived } from "./drawerRules";
import {
  copyProjectId,
  deleteProject,
  refreshAfterEvaluation,
  requestSave,
  saveChanges,
  saveIndustry,
} from "./projectActions";
import type { ActionEnv } from "./projectActions";
import type { ProjectForm } from "./useProjectForm";

type Input = {
  project: ProjectOverview;
  form: ProjectForm;
  derived: Derived;
  onClose: () => void;
  onProjectUpdated?: (updated: AdminProjectDetails) => void;
  onProjectDeleted?: (projectId: string) => void;
  onMembershipsMoved?: () => void;
};

/**
 * What the footer, the cards and the dialogs can do: save, discard, delete, copy the id, and set
 * or re-evaluate the industry — with the flags that say one of them is under way.
 */
export function useDrawerActions(input: Input) {
  const { form, onClose } = input;
  const toast = useToast();
  const [isSaving, setIsSaving] = useState(false);
  // Carries only the inline "name required" validation; the save request's own failure is a toast.
  const [saveErrorMessage, setSaveErrorMessage] = useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);

  const env: ActionEnv = {
    project: input.project,
    derived: input.derived,
    onClose,
    onProjectUpdated: input.onProjectUpdated,
    onProjectDeleted: input.onProjectDeleted,
    onMembershipsMoved: input.onMembershipsMoved,
    toast,
    draftProject: form.draftProject,
    setProjectDetails: form.setProjectDetails,
    resetDrafts: form.resetDrafts,
    adoptIfUntouched: form.adoptIfUntouched,
    setIsSaving,
    setSaveErrorMessage,
    setIsMoveDialogOpen,
    setIsDeleteDialogOpen,
    setIsDeleting,
  };

  const discardChanges = () => {
    setSaveErrorMessage("");
    form.resetDrafts(input.derived.visibleProject);
  };

  return {
    isSaving,
    saveErrorMessage,
    isDeleteDialogOpen,
    isDeleting,
    isMoveDialogOpen,
    setIsDeleteDialogOpen,
    setIsMoveDialogOpen,
    openDelete: () => setIsDeleteDialogOpen(true),
    clearSaveError: () => setSaveErrorMessage(""),
    closeDrawer: () => {
      setSaveErrorMessage("");
      onClose();
    },
    discardChanges,
    requestSave: () => requestSave(env),
    saveChanges: () => void saveChanges(env),
    industryEvaluated: () => void refreshAfterEvaluation(env),
    saveIndustry: (industry: string) => saveIndustry(env, industry),
    copyProjectId: () => void copyProjectId(env),
    confirmDelete: () => void deleteProject(env),
  };
}
