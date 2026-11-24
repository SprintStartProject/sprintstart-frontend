import { projectService } from "../../../../services/projectService";
import { applyPeopleChanges } from "../../peopleDraft";
import type { AdminProjectDetails, ProjectEditFormState, ProjectOverview } from "../../types";
import { failureMessage, saveDecision } from "./drawerRules";
import type { Derived } from "./drawerRules";

type Toast = { success: (message: string) => void; error: (message: string) => void };

/** Everything the drawer's actions read and write, handed in rather than closed over. */
export type ActionEnv = {
  project: ProjectOverview;
  toast: Toast;
  derived: Derived;
  draftProject: ProjectEditFormState;
  setProjectDetails: (details: AdminProjectDetails) => void;
  resetDrafts: (source: AdminProjectDetails | ProjectOverview) => void;
  adoptIfUntouched: (details: AdminProjectDetails) => void;
  setIsSaving: (saving: boolean) => void;
  setSaveErrorMessage: (message: string) => void;
  setIsMoveDialogOpen: (open: boolean) => void;
  setIsDeleteDialogOpen: (open: boolean) => void;
  setIsDeleting: (deleting: boolean) => void;
  onClose: () => void;
  onProjectUpdated?: (updated: AdminProjectDetails) => void;
  onProjectDeleted?: (projectId: string) => void;
  /**
   * Called after a save that removed people from other projects. Those projects' member lists are
   * held elsewhere on the page and are stale by then, so the parent is expected to reload them.
   */
  onMembershipsMoved?: () => void;
};

function applyProjectUpdate(env: ActionEnv, updated: AdminProjectDetails) {
  env.setProjectDetails(updated);
  env.onProjectUpdated?.(updated);
}

/** What pressing Save does: refuse a blank name, ask about people who move, or save. */
export function requestSave(env: ActionEnv): void {
  const decision = saveDecision({
    hasDetailsChanges: env.derived.hasDetailsChanges,
    name: env.draftProject.name,
    movedCount: env.derived.movedUsers.length,
  });

  if (decision === "name-required") {
    env.setSaveErrorMessage("Project name is required.");
  } else if (decision === "confirm-move") {
    env.setIsMoveDialogOpen(true);
  } else {
    void saveChanges(env);
  }
}

export async function saveChanges(env: ActionEnv): Promise<void> {
  const { project, derived, draftProject } = env;
  env.setIsMoveDialogOpen(false);
  env.setIsSaving(true);
  env.setSaveErrorMessage("");

  try {
    if (derived.hasDetailsChanges) {
      await projectService.updateProject(project.id, {
        name: draftProject.name.trim(),
        description: draftProject.description.trim(),
      });
    }

    if (derived.peopleChangeCount > 0) {
      await applyPeopleChanges(project.id, derived.activePeopleDraft);
    }

    // Refetch rather than merging locally: people changes touch membership, manager and the
    // source list's counts at once.
    const updated = await projectService.getProjectById(project.id);
    applyProjectUpdate(env, updated);
    env.resetDrafts(updated);
    env.toast.success("Project saved");

    if (derived.movedUsers.length > 0) env.onMembershipsMoved?.();
  } catch (error) {
    env.toast.error(failureMessage(error, "Couldn't save the project changes."));
  } finally {
    env.setIsSaving(false);
  }
}

/** Re-fetches and adopts the project after its industry was evaluated. */
export async function refreshAfterEvaluation(env: ActionEnv): Promise<void> {
  try {
    const updated = await projectService.getProjectById(env.project.id);
    applyProjectUpdate(env, updated);
    env.adoptIfUntouched(updated);
  } catch (error) {
    env.toast.error(failureMessage(error, "Couldn't refresh the project after evaluation."));
  }
}

/**
 * The same reload-and-adopt approach as {@link refreshAfterEvaluation}, plus the actual persist
 * call. Rethrows so the industry panel keeps its edit field open (with the typed value) for the
 * user to retry.
 */
export async function saveIndustry(env: ActionEnv, industry: string): Promise<void> {
  try {
    await projectService.setProjectIndustry(env.project.id, industry);
    const updated = await projectService.getProjectById(env.project.id);
    applyProjectUpdate(env, updated);
    env.adoptIfUntouched(updated);
    env.toast.success(`Industry set to "${industry}"`);
  } catch (error) {
    env.toast.error(failureMessage(error, "Couldn't save the project's industry."));
    throw error;
  }
}

export async function copyProjectId(env: ActionEnv): Promise<void> {
  try {
    await navigator.clipboard.writeText(env.project.id);
    env.toast.success("Project ID copied");
  } catch {
    env.toast.error("Couldn't copy the project ID.");
  }
}

export async function deleteProject(env: ActionEnv): Promise<void> {
  env.setIsDeleting(true);

  try {
    await projectService.deleteProject(env.project.id);
    env.setIsDeleteDialogOpen(false);
    env.onProjectDeleted?.(env.project.id);
    env.onClose();
    env.toast.success("Project deleted");
  } catch (error) {
    env.toast.error(failureMessage(error, "Couldn't delete the project."));
  } finally {
    env.setIsDeleting(false);
  }
}
