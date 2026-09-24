import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Trash2 } from "lucide-react";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { knowledgeService } from "../../../services/knowledgeService";
import { queryKeys } from "../../../services/queryKeys";
import type { Artifact } from "../types";

/** Props for {@link ArtifactBulkActions}. */
export interface ArtifactBulkActionsProps {
  projectId: string;
  /** Authenticated user id; null while the profile is unknown (delete refuses). */
  removerId: string | null;
  /** The ticked uploads that are on screen — never ids the reader cannot see. */
  selected: readonly Artifact[];
  onClearSelection: () => void;
  /** After a request that reached the backend: ingestion ids actually deleted. */
  onDeleted: (deletedArtifactIds: string[]) => void;
}

interface BulkDeleteReport {
  deleted: number;
  failures: { id: string; title: string; error: string }[];
}

/** "1 upload" / "3 uploads" — the toolbar says what kind of thing is selected. */
function countUploads(count: number): string {
  return `${count} ${count === 1 ? "upload" : "uploads"}`;
}

/**
 * Maps the backend's upload-id outcome back to the rows the reader ticked, so
 * failures are named by title. Ids the page could not resolve to an upload id
 * are failures too — they were never sent.
 */
function buildReport(
  selected: readonly Artifact[],
  deletedUploadIds: readonly string[],
  failed: readonly { artifactId: string; error: string }[],
): BulkDeleteReport {
  const bySourceId = new Map(selected.map((artifact) => [artifact.sourceId, artifact]));
  const failures = failed.map(({ artifactId, error }) => {
    const artifact = bySourceId.get(artifactId);
    return { id: artifactId, title: artifact?.title ?? artifactId, error };
  });
  for (const artifact of selected) {
    if (!artifact.sourceId) {
      failures.push({
        id: artifact.id,
        title: artifact.title ?? artifact.id,
        error: "Couldn't resolve the uploaded artifact id for deletion.",
      });
    }
  }
  return { deleted: deletedUploadIds.length, failures };
}

/**
 * Toolbar, confirmation and outcome for deleting several uploads at once.
 *
 * One request for the whole selection (the endpoint batches), confirmed in an
 * alertdialog with the drawer's consequence wording. The outcome is reported
 * per item: "N deleted", and a visible danger message naming each upload that
 * could not be deleted with the backend's reason.
 */
export function ArtifactBulkActions({
  projectId,
  removerId,
  selected,
  onClearSelection,
  onDeleted,
}: ArtifactBulkActionsProps) {
  const queryClient = useQueryClient();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [report, setReport] = useState<BulkDeleteReport | null>(null);
  // Snapshot taken when the dialog opens: what was confirmed is what is sent,
  // and the dialog keeps its wording while the cleared selection animates out.
  const [pending, setPending] = useState<readonly Artifact[]>([]);

  const mutation = useMutation({
    mutationFn: (uploadIds: string[]) =>
      knowledgeService.deleteUploads(projectId, uploadIds, removerId ?? ""),
    // Prefix invalidation: list, facets and any open detail refetch at once.
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledgeBase.project(projectId) }),
  });

  const openConfirm = () => {
    setRequestError(null);
    setPending(selected);
    setIsConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!removerId) {
      setRequestError("Could not resolve the authenticated user id.");
      return;
    }
    const uploadIds = pending.map((artifact) => artifact.sourceId).filter(Boolean);
    try {
      const outcome =
        uploadIds.length > 0
          ? await mutation.mutateAsync(uploadIds)
          : { deletedIds: [], failed: [] };
      const deleted = new Set(outcome.deletedIds);
      setReport(buildReport(pending, outcome.deletedIds, outcome.failed));
      setIsConfirmOpen(false);
      onDeleted(pending.filter((a) => deleted.has(a.sourceId)).map((a) => a.id));
    } catch (error) {
      // The request itself failed: nothing is known to be deleted, so the
      // dialog stays open with the reason and the selection is kept for a retry.
      setRequestError(error instanceof Error ? error.message : "Couldn't delete the uploads.");
    }
  };

  const count = selected.length;
  const isDeleting = mutation.isPending;

  return (
    <div className="space-y-3">
      {count > 0 && (
        <div
          role="group"
          aria-label="Selected uploads"
          data-testid="kb-bulk-toolbar"
          className="flex flex-wrap items-center gap-3 rounded-xl border border-app-border bg-app-surface px-4 py-2"
        >
          <Badge variant="brand">{countUploads(count)} selected</Badge>
          <Button
            variant="dangerSoft"
            size="sm"
            icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
            onClick={openConfirm}
            data-testid="kb-bulk-delete"
          >
            Delete
          </Button>
          <Button variant="ghost" size="sm" onClick={onClearSelection} data-testid="kb-bulk-clear">
            Clear selection
          </Button>
        </div>
      )}

      {/* Always mounted, so the count is announced when it arrives. */}
      <div aria-live="polite" aria-atomic="true">
        {report && report.deleted > 0 && (
          <p
            data-testid="kb-bulk-deleted"
            className="flex items-center gap-2 text-sm font-medium text-app-success-text"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            {report.deleted} deleted
          </p>
        )}
      </div>

      {report && report.failures.length > 0 && (
        <div
          role="alert"
          data-testid="kb-bulk-failed"
          className="rounded-xl border border-app-danger-border bg-app-danger-bg px-4 py-3 text-sm text-app-danger-text"
        >
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {countUploads(report.failures.length)} could not be deleted
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            {report.failures.map((failure) => (
              <li key={failure.id}>
                <span className="font-medium">{failure.title}</span>: {failure.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Modal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        role="alertdialog"
        title={`Delete ${countUploads(pending.length)}?`}
        description={`This will permanently remove ${countUploads(pending.length)} and their indexed content. This cannot be undone.`}
        size="sm"
        isDismissDisabled={isDeleting}
        errorMessage={requestError}
        testId="kb-bulk-delete-dialog"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setIsConfirmOpen(false)}
              disabled={isDeleting}
              data-testid="kb-bulk-cancel"
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={isDeleting}
              onClick={() => void confirmDelete()}
              data-testid="kb-bulk-confirm"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </>
        }
      >
        <ul className="max-h-48 list-disc space-y-1 overflow-y-auto pl-6 text-sm text-app-text">
          {pending.map((artifact) => (
            <li key={artifact.id} className="truncate">
              {artifact.title ?? "Untitled"}
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}
