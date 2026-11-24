import { Check, FilePlus2, Trash2 } from "lucide-react";
import { Button } from "../../../components/ui/Button.tsx";
import type { BlueprintGraphNode } from "../../../services/blueprintTypes.ts";

type NodeDetailFooterProps = {
  node: BlueprintGraphNode;
  /** A step is open (otherwise a knowledge check, or nothing). */
  isStep: boolean;
  /** A step or a knowledge check is open. */
  hasEntity: boolean;
  editable: boolean;
  dirty: boolean;
  saving: boolean;
  onDelete: () => void;
  onDiscard: () => void;
  /** Asks the page to open a draft carrying this node. */
  onRequestDraft?: (node: BlueprintGraphNode) => void;
};

function SaveState({
  dirty,
  isStep,
  saving,
  onDiscard,
}: Pick<NodeDetailFooterProps, "dirty" | "isStep" | "saving" | "onDiscard">) {
  if (!dirty) {
    return (
      <p className="flex items-center gap-1.5 text-sm text-app-text-muted">
        <Check className="h-4 w-4 text-app-success-solid" aria-hidden="true" />
        Saved
      </p>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="secondary" type="button" onClick={onDiscard}>
        Discard
      </Button>
      <Button
        variant="primary"
        type="submit"
        form={isStep ? "edit-blueprint-step" : "edit-blueprint-question"}
        loading={saving}
      >
        Save changes
      </Button>
    </div>
  );
}

/**
 * The foot of the details panel.
 *
 * There is no edit mode, and so nothing to cancel: the fields are live and the footer says whether
 * what is on screen has reached the server. On a version that cannot be edited it offers a draft
 * instead, because a panel with no footer at all reads as "this has no actions" rather than "not
 * on this version".
 */
export function NodeDetailFooter(props: NodeDetailFooterProps) {
  const { node, hasEntity, editable, onRequestDraft } = props;

  if (hasEntity && editable) {
    return (
      <div className="flex items-center justify-between gap-3">
        <Button variant="dangerSoft" icon={<Trash2 className="h-4 w-4" />} onClick={props.onDelete}>
          Delete
        </Button>
        <SaveState {...props} />
      </div>
    );
  }

  if (!onRequestDraft) return null;

  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm text-app-text-muted">This version is published, so it is read-only.</p>
      <Button
        variant="primary"
        icon={<FilePlus2 className="h-4 w-4" />}
        onClick={() => onRequestDraft(node)}
      >
        Edit as draft
      </Button>
    </div>
  );
}
