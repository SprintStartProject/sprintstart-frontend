import { useState } from "react";
import { useToast } from "../../context/useToast.ts";
import { blueprintService } from "../../services/blueprintService.ts";
import type { BlueprintReopen } from "./pathEditorTypes.ts";
import { blueprintAddress, type PathPageContext } from "./pathPageContext.ts";

/**
 * Whether authoring actions apply right now, and the way forward when they do not.
 *
 * Only a draft is editable -- the backend refuses a mutation on a published or archived path -- but
 * hiding every control on a published one left a page that looks like an editor and silently is
 * not. So the controls stay, and asking one of them explains why and offers the draft.
 */
export function useDraftPrompt(context: PathPageContext) {
  const { path } = context;
  const toast = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDraft = path?.status === "DRAFT";

  /** Runs an authoring action on a draft, or offers to make one first. */
  function whenEditable(run: () => void) {
    if (isDraft) {
      run();
      return;
    }
    setError(null);
    setIsOpen(true);
  }

  /**
   * Opens (or reuses) the draft for this blueprint and continues there.
   *
   * `reopen` is what the author was looking at when they asked. Given one, the draft is opened
   * without stopping to explain first: the question was asked from inside that very phase, with a
   * line above the button already saying the version is read-only, and the toast on arrival says
   * what stays published. The dialog is for the buttons scattered across the outline, where
   * "why can I not type here" has not been answered yet.
   */
  async function openDraftAndContinue(reopen: BlueprintReopen | null) {
    if (!path) return;
    setIsOpening(true);
    setError(null);
    try {
      const draft = await blueprintService.openDraft(context.scope, path.blueprintKey);
      setIsOpen(false);
      toast.info(`Editing draft v${draft.version}`, {
        description: `Version ${path.version} stays published until you publish this one.`,
      });
      void context.navigate(blueprintAddress(draft.id, context.isGlobal), {
        state: reopen ? { reopen } : null,
      });
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "The draft could not be opened.";
      // With no dialog on screen there is nowhere for the dialog's error line to be read.
      if (reopen) toast.error("The draft could not be opened", { description: message });
      else setError(message);
    } finally {
      setIsOpening(false);
    }
  }

  return {
    isOpen,
    isOpening,
    error,
    isDraft,
    close: () => setIsOpen(false),
    whenEditable,
    openDraftAndContinue,
  };
}

export type DraftPrompt = ReturnType<typeof useDraftPrompt>;

/** Opens the draft of the published version from the header, reporting a failure on the page. */
export function useEditAsDraft(context: PathPageContext) {
  const { path } = context;
  const toast = useToast();

  return function editAsDraft() {
    if (!path) return Promise.resolve();
    return blueprintService
      .openDraft(context.scope, path.blueprintKey)
      .then((draft) => {
        toast.info(`Editing draft v${draft.version}`, {
          description: `Version ${path.version} stays published until you publish this one.`,
        });
        return context.navigate(blueprintAddress(draft.id, context.isGlobal));
      })
      .catch((reason: unknown) =>
        context.setPageError(
          reason instanceof Error ? reason.message : "Draft could not be opened.",
        ),
      );
  };
}
