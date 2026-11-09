import { blueprintService, type BlueprintScope } from "../../services/blueprintService.ts";
import type { CreateKind } from "./pathEditorTypes.ts";
import { findItem } from "./pathOrdering.ts";
import type { BlueprintGraphNode, BlueprintPath } from "./types.ts";

/** An item the server renumbered or touched while deleting another one. */
export type Revision = { id: string; revision: number };

type Edges = Revision & { blockerIds: string[] };

/** What deleting a phase, step or question reports back; the other kinds report nothing. */
export type DeletionResult = {
  kind: "phase" | "step" | "question";
  id: string;
  updated: Revision[];
};

const byId = (updated: Revision[]) => new Map(updated.map((entry) => [entry.id, entry.revision]));

/**
 * The list without the deleted item, and with the server's new revision on whatever it touched --
 * which also stops waiting for the deleted item. The response lists the deleted item itself too;
 * filtering it out first makes that entry a no-op.
 */
function settle<T extends Edges>(items: T[], deletedId: string, updated: Revision[]): T[] {
  const revisions = byId(updated);
  return items
    .filter((item) => item.id !== deletedId)
    .map((item) => {
      const revision = revisions.get(item.id);
      return revision === undefined
        ? item
        : {
            ...item,
            revision,
            blockerIds: item.blockerIds.filter((blockerId) => blockerId !== deletedId),
          };
    });
}

/** The list without the deleted item, and with the server's new revision on whatever it touched. */
function bump<T extends Revision>(items: T[], deletedId: string, updated: Revision[]): T[] {
  const revisions = byId(updated);
  return items
    .filter((item) => item.id !== deletedId)
    .map((item) => {
      const revision = revisions.get(item.id);
      return revision === undefined ? item : { ...item, revision };
    });
}

/** The path after a phase was deleted. */
export function afterPhaseDeletion(
  path: BlueprintPath,
  phaseId: string,
  updated: Revision[],
): BlueprintPath {
  return { ...path, blueprintPhases: settle(path.blueprintPhases, phaseId, updated) };
}

/** The path after a step was deleted; questions only take the new revisions. */
export function afterStepDeletion(
  path: BlueprintPath,
  stepId: string,
  updated: Revision[],
): BlueprintPath {
  return {
    ...path,
    blueprintPhases: path.blueprintPhases.map((phase) => ({
      ...phase,
      blueprintSteps: settle(phase.blueprintSteps, stepId, updated),
      blueprintCheckQuestions: bump(phase.blueprintCheckQuestions, stepId, updated),
    })),
  };
}

/** The path after a question was deleted; steps may have been waiting for it. */
export function afterQuestionDeletion(
  path: BlueprintPath,
  questionId: string,
  updated: Revision[],
): BlueprintPath {
  return {
    ...path,
    blueprintPhases: path.blueprintPhases.map((phase) => ({
      ...phase,
      blueprintSteps: settle(phase.blueprintSteps, questionId, updated),
      blueprintCheckQuestions: bump(phase.blueprintCheckQuestions, questionId, updated),
    })),
  };
}

/** The thin graph nodes after a step or question was deleted. */
export function nodesAfterDeletion(
  nodes: BlueprintGraphNode[],
  deletedId: string,
  updated: Revision[],
): BlueprintGraphNode[] {
  return settle(nodes, deletedId, updated);
}

/** The item to delete, with the revision the server needs to see, wherever it sits. */
export function findDeletable(
  path: BlueprintPath | null,
  kind: CreateKind,
  id: string,
): Revision | undefined {
  if (!path) return undefined;
  if (kind === "resource") {
    return path.blueprintPhases
      .flatMap((phase) => phase.blueprintSteps)
      .flatMap((step) => step.blueprintResources)
      .find((resource) => resource.id === id);
  }
  return findItem(path, kind, id);
}

/** Sends the delete for this kind of item; phases, steps and questions report what they touched. */
export async function sendDelete(
  scope: BlueprintScope,
  kind: CreateKind,
  item: Revision,
): Promise<DeletionResult | undefined> {
  const { id, revision } = item;
  switch (kind) {
    case "phase":
      return {
        kind,
        id,
        updated: (await blueprintService.deletePhase(scope, id, revision)).updatedPhases,
      };
    case "step":
      return {
        kind,
        id,
        updated: (await blueprintService.deleteStep(scope, id, revision)).updatedSteps,
      };
    case "question":
      return {
        kind,
        id,
        updated: (await blueprintService.deleteQuestion(scope, id, revision)).updatedQuestions,
      };
    case "task":
      await blueprintService.deleteTask(scope, id, revision);
      return undefined;
    case "resource":
      await blueprintService.deleteResource(scope, id, revision);
      return undefined;
    case "option":
      await blueprintService.deleteOption(scope, id, revision);
      return undefined;
  }
}
