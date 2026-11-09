import type {
  BlueprintOption,
  BlueprintPath,
  BlueprintPhase,
  BlueprintQuestion,
  BlueprintResource,
  BlueprintStep,
  BlueprintTask,
} from "./types.ts";

export type CreateKind = "phase" | "step" | "task" | "resource" | "question" | "option";
export type CreateTarget = {
  kind: CreateKind;
  parentId: string;
  position: number;
  graphPosition?: { graphX: number; graphY: number };
} | null;
/**
 * What the create/edit overlay is currently editing.
 *
 * Phase, step and question were missing: the list editor could add one and delete one, but not
 * rename one — the only way to change a phase's own fields was the graph editor's side panel, three
 * levels down and only on a draft. Deleting a phase from a surface that cannot edit it is the wrong
 * half of the pair to offer.
 */
export type EditTarget =
  | { kind: "phase"; item: BlueprintPhase }
  | { kind: "step"; item: BlueprintStep }
  | { kind: "question"; item: BlueprintQuestion }
  | { kind: "task"; item: BlueprintTask }
  | { kind: "resource"; item: BlueprintResource }
  | { kind: "option"; item: BlueprintOption }
  | null;
export type SortKind = "phase" | "step" | "task" | "question" | "option";
export type RequirementType = "SKILL" | "PROJECT_ROLE";
export type RequirementTarget = { phaseId: string } | null;
export type RequirementCatalog = {
  skills: { id: string; name: string }[];
  projectRoles: { id: string; name: string }[];
};

export type LifecycleAction = "publish" | "rollback" | "delete-draft";

/** A one-way lifecycle action waiting for the author to confirm it, and the version it is about. */
export type PendingLifecycle = { action: LifecycleAction; version: BlueprintPath };

/**
 * What to put back in front of the author after landing somewhere new.
 *
 * Carried by title, not by id, because the one journey that needs it ends on a *copy*: opening a
 * draft duplicates every phase, step and question, so the ids the author was looking at a moment
 * ago exist nowhere on the page they arrive at. The titles are the ones they just read.
 */
export type BlueprintReopen = { phaseTitle: string; nodeTitle?: string };

/**
 * The two ways of looking at a blueprint, in the order the bar draws them.
 *
 * Both are editable, which is why neither is called "the editor": the outline is the whole thing
 * written out in order, the graph is the same content arranged by what waits on what.
 */
export const EDITOR_MODE_ORDER = ["list", "graph"] as const;
export type EditorMode = (typeof EDITOR_MODE_ORDER)[number];
