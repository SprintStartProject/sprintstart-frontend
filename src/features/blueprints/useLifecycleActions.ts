import { useState } from "react";
import { useToast } from "../../context/useToast.ts";
import { blueprintService } from "../../services/blueprintService.ts";
import { LIFECYCLE_COPY } from "./pathEditorCopy.ts";
import type { PendingLifecycle } from "./pathEditorTypes.ts";
import { blueprintAddress, type PathPageContext } from "./pathPageContext.ts";
import type { VersionHistory } from "./useVersionHistory.ts";
import type { BlueprintPath } from "./types.ts";

type Toast = ReturnType<typeof useToast>;

async function publishVersion(context: PathPageContext, toast: Toast) {
  const { path } = context;
  if (!path) return;
  await blueprintService.publishPath(context.scope, path.id);
  // Publishing answers with the same nested DTO, so the graph has to be put back.
  await context.loadPath(false);
  toast.success(`Version ${path.version} is now the published blueprint`, {
    description: "New hires on this project are given it from now on.",
  });
}

async function rollbackVersion(context: PathPageContext) {
  const { path } = context;
  if (!path) return;
  const restored = await blueprintService.rollbackPath(
    context.scope,
    path.blueprintKey,
    path.version,
  );
  if (restored.id === context.pathId) {
    // Same address, so the load effect will not refire -- and the response cannot be set
    // straight into state: `GET /paths/{id}` carries no `graphX`/`graphY`/`blockerIds`, so that
    // emptied the canvas and the next drag saved a position against it. See `loadPath`.
    await context.loadPath(false);
    return;
  }
  void context.navigate(blueprintAddress(restored.id, context.isGlobal));
}

async function deleteDraftVersion(
  context: PathPageContext,
  history: VersionHistory,
  version: BlueprintPath,
) {
  await blueprintService.deleteDraft(context.scope, version.id);
  history.drop(version.id);
  if (version.id === context.pathId) {
    history.close();
    void context.navigate(context.listPath);
  }
}

/**
 * Runs whichever lifecycle action was confirmed, one at a time.
 *
 * All three are one-way -- publishing swaps what new hires are handed, reverting does the same,
 * and a deleted draft has no undo endpoint -- so each is asked about first, and the dialog holds
 * the answer while the request is in flight, so a second click cannot send a second request.
 */
export function useLifecycleActions(context: PathPageContext, history: VersionHistory) {
  const toast = useToast();
  const [pending, setPending] = useState<PendingLifecycle | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!pending || isBusy) return;
    setIsBusy(true);
    setError(null);
    try {
      if (pending.action === "publish") await publishVersion(context, toast);
      else if (pending.action === "rollback") await rollbackVersion(context);
      else await deleteDraftVersion(context, history, pending.version);
      setPending(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : LIFECYCLE_COPY[pending.action].failure);
    } finally {
      setIsBusy(false);
    }
  }

  function cancel() {
    if (isBusy) return;
    setPending(null);
    setError(null);
  }

  return { pending, isBusy, error, request: setPending, cancel, run };
}

export type LifecycleActions = ReturnType<typeof useLifecycleActions>;

/** Archiving the blueprint: asked about first, then sent, then back to the list. */
export function useArchive(context: PathPageContext) {
  const { path } = context;
  const toast = useToast();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  async function archive() {
    if (!path) return;
    setIsArchiving(true);
    context.setPageError(null);
    try {
      await blueprintService.archivePath(context.scope, path.blueprintKey);
      setIsConfirmOpen(false);
      toast.success(`"${path.title}" archived`);
      void context.navigate(context.listPath);
    } catch (reason) {
      context.setPageError(
        reason instanceof Error ? reason.message : "Blueprint path could not be archived.",
      );
    } finally {
      setIsArchiving(false);
    }
  }

  return {
    isConfirmOpen,
    isArchiving,
    ask: () => setIsConfirmOpen(true),
    cancel: () => setIsConfirmOpen(false),
    archive,
  };
}
