import { useState } from "react";
import type { Dispatch, FormEvent, SetStateAction } from "react";
import { useToast } from "../../context/useToast.ts";
import type { BlueprintScope } from "../../services/blueprintService.ts";
import { BLANK_VALUES, valuesForEdit, type ItemFormValues } from "./itemFormValues.ts";
import { createItem, updateItem, type CreatedItem } from "./itemRequests.ts";
import { kindLabels } from "./pathEditorCopy.ts";
import type { CreateTarget, EditTarget } from "./pathEditorTypes.ts";
import type { BlueprintPath, BlueprintQuestion, BlueprintStep } from "./types.ts";

/** The add/edit overlay's own state: what it is open for, what has been typed, how saving went. */
export function useItemForm() {
  const [target, setTarget] = useState<CreateTarget>(null);
  const [editTarget, setEditTarget] = useState<EditTarget>(null);
  const [values, setValues] = useState<ItemFormValues>(BLANK_VALUES);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function openCreate(next: NonNullable<CreateTarget>) {
    setValues(BLANK_VALUES);
    setError(null);
    setTarget(next);
  }

  function openEdit(next: NonNullable<EditTarget>) {
    setError(null);
    setValues(valuesForEdit(next));
    setEditTarget(next);
  }

  function setField<K extends keyof ItemFormValues>(key: K, value: ItemFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  /** Closes the overlay, whichever way it was opened. */
  function finish() {
    setTarget(null);
    setEditTarget(null);
  }

  function close() {
    finish();
    setError(null);
  }

  return {
    target,
    editTarget,
    values,
    error,
    isSaving,
    // What the overlay is about, whichever way it was opened: `target?.kind` is only set while
    // creating.
    kind: editTarget?.kind ?? target?.kind ?? null,
    openCreate,
    openEdit,
    setField,
    setError,
    setIsSaving,
    finish,
    close,
  };
}

export type ItemForm = ReturnType<typeof useItemForm>;

interface SaveDependencies {
  scope: BlueprintScope;
  setPath: Dispatch<SetStateAction<BlueprintPath | null>>;
  setPageError: (message: string | null) => void;
  refresh: () => Promise<void>;
  placeStep: (step: BlueprintStep, place: Placement) => void;
  placeQuestion: (question: BlueprintQuestion, place: Placement) => void;
}

type Placement = { revision: number; graphX: number; graphY: number };

/** Puts a freshly created item on the canvas it was created on; false when it was not made there. */
function placeOnCanvas(
  created: CreatedItem,
  graphPosition: { graphX: number; graphY: number } | undefined,
  deps: SaveDependencies,
): boolean {
  if (!graphPosition) return false;
  if (created.kind === "phase") {
    deps.setPath((current) =>
      current
        ? { ...current, blueprintPhases: [...current.blueprintPhases, created.item] }
        : current,
    );
    return true;
  }
  if (created.kind === "step") {
    deps.placeStep(created.item, { revision: created.item.revision, ...graphPosition });
    return true;
  }
  if (created.kind === "question") {
    deps.placeQuestion(created.item, { revision: created.item.revision, ...graphPosition });
    return true;
  }
  return false;
}

/** Saves the overlay: an edit to the item it was opened on, or a new item under its parent. */
export function useSaveItem(form: ItemForm, deps: SaveDependencies) {
  const toast = useToast();

  async function persist() {
    const { editTarget, target, values } = form;
    if (editTarget) {
      await updateItem(deps.scope, editTarget, values);
      form.finish();
      await deps.refresh();
      toast.success(`${kindLabels[editTarget.kind]} saved`);
      return;
    }
    if (!target) return;
    const created = await createItem(deps.scope, target, values);
    form.finish();
    if (placeOnCanvas(created, target.graphPosition, deps)) return;
    await deps.refresh();
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.target && !form.editTarget) return;
    form.setIsSaving(true);
    deps.setPageError(null);
    try {
      await persist();
    } catch (reason) {
      form.setError(
        reason instanceof Error ? reason.message : `The ${form.kind ?? "item"} could not be saved.`,
      );
    } finally {
      form.setIsSaving(false);
    }
  }

  return save;
}
