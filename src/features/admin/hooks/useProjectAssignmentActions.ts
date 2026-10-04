import { useState } from "react";
import { useToast } from "../../../context/useToast";

type UseProjectAssignmentActionsOptions = {
  onAssignProject: (projectId: string) => Promise<void>;
  onRemoveProject: (projectId: string) => Promise<void>;
  /**
   * Asked before a project is assigned; resolving `false` aborts the assignment
   * silently. Lets the parent warn about side effects (a move out of another
   * project) without the view knowing the rule.
   */
  confirmAssign?: (projectId: string) => Promise<boolean>;
};

/**
 * The save-immediately assignment flow shared by the single- and multi-project
 * views: one request in flight at a time, a toast for the outcome, and a result
 * the caller can use to close its picker or dialog.
 *
 * Both actions resolve `true` only when the change was saved. A cancelled
 * confirmation or a failed request resolves `false`, so the caller keeps its
 * UI open for another try.
 */
export function useProjectAssignmentActions({
  onAssignProject,
  onRemoveProject,
  confirmAssign,
}: UseProjectAssignmentActionsOptions) {
  const toast = useToast();
  const [pendingProjectId, setPendingProjectId] = useState<string | null>(null);
  const isBusy = pendingProjectId !== null;

  const assign = async (projectId: string): Promise<boolean> => {
    if (isBusy) return false;
    if (confirmAssign && !(await confirmAssign(projectId))) return false;

    setPendingProjectId(projectId);

    try {
      await onAssignProject(projectId);
      toast.success("Project assigned");
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save the project assignment.");
      return false;
    } finally {
      setPendingProjectId(null);
    }
  };

  const remove = async (projectId: string): Promise<boolean> => {
    if (isBusy) return false;

    setPendingProjectId(projectId);

    try {
      await onRemoveProject(projectId);
      toast.success("Project removed");
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't remove the project assignment.",
      );
      return false;
    } finally {
      setPendingProjectId(null);
    }
  };

  return { pendingProjectId, isBusy, assign, remove };
}
