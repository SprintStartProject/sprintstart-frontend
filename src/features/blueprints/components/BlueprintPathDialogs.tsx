import { AlertDialog } from "../../../components/ui/AlertDialog.tsx";
import type { BlueprintPath } from "../types.ts";
import { DELETE_CONSEQUENCE, LIFECYCLE_COPY, kindLabels } from "../pathEditorCopy.ts";
import type { CreateKind, LifecycleAction } from "../pathEditorTypes.ts";

interface DeleteItemDialogProps {
  pendingDelete: { kind: CreateKind; id: string; label: string } | null;
  deletingId: string | null;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Asks before an item and everything under it is deleted. */
export function DeleteItemDialog({
  pendingDelete,
  deletingId,
  error,
  onCancel,
  onConfirm,
}: DeleteItemDialogProps) {
  const label = pendingDelete ? kindLabels[pendingDelete.kind] : null;
  return (
    <AlertDialog
      isOpen={pendingDelete !== null}
      title={pendingDelete ? `Delete ${label} "${pendingDelete.label}"?` : ""}
      description={
        pendingDelete ? (
          <>
            <p>{DELETE_CONSEQUENCE[pendingDelete.kind]}</p>
            <p className="mt-2">
              Hires who already have a path built from this blueprint keep theirs — a personalized
              path is a copy, not a live reference. This cannot be undone from here.
            </p>
          </>
        ) : undefined
      }
      confirmLabel={label ? `Delete ${label}` : "Delete"}
      variant="danger"
      isLoading={pendingDelete !== null && deletingId === pendingDelete.id}
      loadingLabel="Deleting…"
      errorMessage={error ?? undefined}
      onClose={onCancel}
      onConfirm={onConfirm}
    />
  );
}

interface DraftPromptDialogProps {
  path: BlueprintPath;
  isOpen: boolean;
  isBusy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

function DraftPromptBody({ path }: { path: BlueprintPath }) {
  if (path.status === "ARCHIVED") {
    return (
      <p>
        Archived versions are kept as they were. To work from this one again, use &ldquo;Revert to
        this version&rdquo; — it becomes the published blueprint, and you can open a draft from
        there.
      </p>
    );
  }
  return (
    <>
      <p>
        Changes are made in a draft, so the version new hires are being given never changes under
        them mid-edit.
      </p>
      <p className="mt-2">
        Opening draft v{path.version + 1} leaves v{path.version} published until you press Publish.
        Nothing you do in the draft reaches anybody before that.
      </p>
    </>
  );
}

/** Explains why a published or archived version cannot be edited, and offers the draft. */
export function DraftPromptDialog({
  path,
  isOpen,
  isBusy,
  error,
  onClose,
  onConfirm,
}: DraftPromptDialogProps) {
  const isArchived = path.status === "ARCHIVED";
  return (
    <AlertDialog
      isOpen={isOpen}
      title={isArchived ? "This version is archived" : "This version is published"}
      description={<DraftPromptBody path={path} />}
      confirmLabel={isArchived ? "Close" : `Open draft v${path.version + 1}`}
      cancelLabel={isArchived ? undefined : "Not now"}
      isLoading={isBusy}
      loadingLabel="Opening draft…"
      errorMessage={error ?? undefined}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}

interface ArchiveDialogProps {
  isOpen: boolean;
  isBusy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/** Asks before the blueprint stops being handed to new hires. */
export function ArchiveDialog({ isOpen, isBusy, onClose, onConfirm }: ArchiveDialogProps) {
  return (
    <AlertDialog
      isOpen={isOpen}
      title="Archive this blueprint?"
      description={
        <>
          <p>
            New hires stop being given this path. Anybody already on one keeps the copy they were
            given — a personalized path is a copy, not a live reference.
          </p>
          <p className="mt-2">
            Any unpublished draft of this blueprint is deleted with it. You can bring an archived
            version back from the version history.
          </p>
        </>
      }
      confirmLabel="Archive"
      variant="danger"
      isLoading={isBusy}
      loadingLabel="Archiving…"
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}

interface LifecycleDialogProps {
  pending: { action: LifecycleAction; version: BlueprintPath } | null;
  isBusy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

/** What the dialog says while it is closed and has nothing to ask. */
const CLOSED_LIFECYCLE_COPY = { title: () => "", description: "", confirm: "", busy: "" };

/** Asks before publishing, reverting or deleting a draft, and says what each costs. */
export function LifecycleDialog({
  pending,
  isBusy,
  error,
  onCancel,
  onConfirm,
}: LifecycleDialogProps) {
  const copy = pending ? LIFECYCLE_COPY[pending.action] : CLOSED_LIFECYCLE_COPY;
  return (
    <AlertDialog
      isOpen={pending !== null}
      title={copy.title(pending?.version.version ?? 0)}
      description={copy.description}
      confirmLabel={copy.confirm}
      variant={pending?.action === "delete-draft" ? "danger" : "default"}
      isLoading={isBusy}
      loadingLabel={copy.busy}
      errorMessage={error ?? undefined}
      onClose={onCancel}
      onConfirm={onConfirm}
    />
  );
}
