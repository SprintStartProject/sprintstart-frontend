import type { HTMLAttributes } from "react";
import type { CreateKind, EditTarget, SortKind } from "../../pathEditorTypes.ts";
import type { BlueprintPhase } from "../../types.ts";

/** A set of ids that are collapsed in the outline, and the two things to do with it. */
export type CollapsedIds = {
  has: (id: string) => boolean;
  toggle: (id: string) => void;
};

/** Everything the outline's cards can ask the page to do, handed down once rather than prop by prop. */
export interface OutlineActions {
  dragProps: (kind: SortKind, id: string, position: number) => HTMLAttributes<HTMLElement>;
  whenEditable: (run: () => void) => void;
  openEdit: (target: NonNullable<EditTarget>) => void;
  openCreate: (kind: CreateKind, parentId: string, position: number) => void;
  requestDelete: (kind: CreateKind, id: string, label: string) => void;
  deletingId: string | null;
  openInGraph: (phaseTitle: string) => void;
  addBlocker: (blocked: BlueprintPhase, blockerId: string) => Promise<void>;
  removeBlocker: (blocked: BlueprintPhase, blockerId: string) => Promise<void>;
  runGraphEdit: (edit: () => Promise<void>) => Promise<void>;
  openRequirementPicker: (phaseId: string) => void;
  removeRequirement: (phaseId: string, requirementId: string) => void;
  removingRequirementId: string | null;
  phasesCollapsed: CollapsedIds;
  stepsCollapsed: CollapsedIds;
  questionsCollapsed: CollapsedIds;
}
