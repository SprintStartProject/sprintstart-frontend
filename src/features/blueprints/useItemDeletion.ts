import { useState } from "react";
import type { CreateKind } from "./pathEditorTypes.ts";
import type { PathPageContext } from "./pathPageContext.ts";
import {
  afterPhaseDeletion,
  afterQuestionDeletion,
  afterStepDeletion,
  findDeletable,
  nodesAfterDeletion,
  sendDelete,
  type DeletionResult,
} from "./pathDeletion.ts";
import type { SubGraphState } from "./useSubGraph.ts";

type PendingDelete = { kind: CreateKind; id: string; label: string } | null;

/** Writes what a delete reported onto the path and, for steps and questions, the open graph. */
function useSettleDeletion(context: PathPageContext, sub: SubGraphState) {
  return function settle(result: DeletionResult | undefined) {
    if (!result) return;
    const { kind, id, updated } = result;
    if (kind === "phase") {
      context.setPath((current) => (current ? afterPhaseDeletion(current, id, updated) : current));
      return;
    }
    sub.setNodes((current) => nodesAfterDeletion(current, id, updated));
    const after = kind === "step" ? afterStepDeletion : afterQuestionDeletion;
    context.setPath((current) => (current ? after(current, id, updated) : current));
  };
}

/** Deleting one item at once: send it, show what changed, and let the caller see a failure. */
export function useDeleteItem(
  context: PathPageContext,
  sub: SubGraphState,
  refresh: () => Promise<void>,
) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const settle = useSettleDeletion(context, sub);

  async function deleteItem(kind: CreateKind, id: string) {
    setDeletingId(id);
    context.setPageError(null);
    try {
      const item = findDeletable(context.path, kind, id);
      if (!item) throw new Error(`The ${kind} could not be found.`);
      const result = await sendDelete(context.scope, kind, item);
      settle(result);
      if (!result) await refresh();
    } catch (reason) {
      context.setPageError(
        reason instanceof Error ? reason.message : `The ${kind} could not be deleted.`,
      );
      // Rethrown, not swallowed: the graph panels close themselves and toast "deleted" on a
      // resolved promise, so a 409 on a stale revision read as a success with the node still on
      // the canvas. Every caller handles the rejection.
      throw reason;
    } finally {
      setDeletingId(null);
    }
  }

  return { deletingId, deleteItem };
}

/**
 * Asks before deleting, for everything the list editor can delete.
 *
 * The graph editor already asked; the list editor did not, so the same phase was one guarded
 * click away on one surface and one unguarded click away on the other. Nothing here is
 * recoverable from the UI — there is no undo endpoint — so the question is the only safety net
 * there is.
 */
export function useDeleteConfirmation(
  whenEditable: (run: () => void) => void,
  deleteItem: (kind: CreateKind, id: string) => Promise<void>,
) {
  const [pending, setPending] = useState<PendingDelete>(null);
  const [error, setError] = useState<string | null>(null);

  function cancel() {
    setPending(null);
    setError(null);
  }

  function confirm() {
    if (!pending) return;
    const { kind, id } = pending;
    setError(null);
    void deleteItem(kind, id).then(
      () => setPending(null),
      (reason: unknown) =>
        setError(reason instanceof Error ? reason.message : `The ${kind} could not be deleted.`),
    );
  }

  return {
    pending,
    error,
    cancel,
    confirm,
    request: (kind: CreateKind, id: string, label: string) =>
      whenEditable(() => setPending({ kind, id, label })),
  };
}
