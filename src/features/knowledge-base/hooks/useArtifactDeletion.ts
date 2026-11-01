import type { Dispatch } from "react";
import { useAuth } from "../../../context/useAuth";
import { useToast } from "../../../context/useToast";
import { knowledgeService } from "../../../services/knowledgeService";
import type { DrawerAction } from "../drawerState";
import type { Artifact } from "../types";

interface ArtifactDeletionOptions {
  artifact: Artifact | null;
  projectId: string;
  dispatch: Dispatch<DrawerAction>;
  /** Called after a successful deletion so the parent can clear the selection and refetch. */
  onDelete: (artifactId: string) => void;
}

/**
 * Deletes the currently selected uploaded artifact.
 *
 * Runs after the user confirmed in the alertdialog. The `removerId` is the authenticated
 * user's id; the backend uses it for audit and project-membership validation. Outcomes
 * are toasts; on failure the confirm dialog stays open so the user can retry.
 *
 * @remarks The delete endpoint expects the `UploadedArtifact`'s UUID, not the ingestion
 * `Artifact`'s UUID. The displayed artifact is usually the ingestion mirror (its `id` is
 * the ingestion UUID); the corresponding `UploadedArtifact` id is carried in
 * `artifact.sourceId`, which the backend fills in from the upload row. When `sourceId` is
 * missing (e.g. ingestion mirror without a matching upload), deletion is refused with a
 * user-facing error.
 */
export function useArtifactDeletion({
  artifact,
  projectId,
  dispatch,
  onDelete,
}: ArtifactDeletionOptions): () => Promise<void> {
  const { profile } = useAuth();
  const toast = useToast();

  return async () => {
    if (!artifact) return;
    const removerId = profile?.id;
    if (!removerId) {
      toast.error("Could not resolve the authenticated user id.");
      return;
    }
    const uploadArtifactId = artifact.sourceId;
    if (!uploadArtifactId) {
      toast.error("Couldn't resolve the uploaded artifact id for deletion.");
      return;
    }

    dispatch({ type: "deleteStart" });
    try {
      await knowledgeService.deleteUpload(projectId, uploadArtifactId, removerId);
      dispatch({ type: "deleteSuccess" });
      dispatch({ type: "closeDeleteConfirm" });
      onDelete(artifact.id);
      toast.success("Artifact deleted");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't delete the artifact.";
      dispatch({ type: "deleteFailed" });
      toast.error(message);
    }
  };
}
