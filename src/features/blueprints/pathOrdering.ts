import { blueprintService, type BlueprintScope } from "../../services/blueprintService.ts";
import type { SortKind } from "./pathEditorTypes.ts";
import type { BlueprintPath, BlueprintPhase } from "./types.ts";

type Positioned = { id: string; position: number };
type Revisioned = { id: string; revision: number };
type Update = Revisioned & { position: number };
type ListTransform = <T extends Positioned>(items: T[]) => T[];

const contains = (items: { id: string }[], id: string) => items.some((item) => item.id === id);

function withPhases(path: BlueprintPath, change: (phase: BlueprintPhase) => BlueprintPhase) {
  return { ...path, blueprintPhases: path.blueprintPhases.map(change) };
}

/**
 * The path with `transform` applied to the one list that holds the item `id` of this `kind`;
 * every other list is left as it was.
 */
function mapContainingList(
  path: BlueprintPath,
  kind: SortKind,
  id: string,
  transform: ListTransform,
): BlueprintPath {
  switch (kind) {
    case "phase":
      return { ...path, blueprintPhases: transform(path.blueprintPhases) };
    case "step":
      return withPhases(path, (phase) =>
        contains(phase.blueprintSteps, id)
          ? { ...phase, blueprintSteps: transform(phase.blueprintSteps) }
          : phase,
      );
    case "question":
      return withPhases(path, (phase) =>
        contains(phase.blueprintCheckQuestions, id)
          ? { ...phase, blueprintCheckQuestions: transform(phase.blueprintCheckQuestions) }
          : phase,
      );
    case "task":
      return withPhases(path, (phase) => ({
        ...phase,
        blueprintSteps: phase.blueprintSteps.map((step) =>
          contains(step.blueprintTasks, id)
            ? { ...step, blueprintTasks: transform(step.blueprintTasks) }
            : step,
        ),
      }));
    case "option":
      return withPhases(path, (phase) => ({
        ...phase,
        blueprintCheckQuestions: phase.blueprintCheckQuestions.map((question) =>
          contains(question.blueprintCheckOptions, id)
            ? { ...question, blueprintCheckOptions: transform(question.blueprintCheckOptions) }
            : question,
        ),
      }));
  }
}

/** The path with the item moved to `position` in its own list and the others renumbered. */
export function moveItem(
  path: BlueprintPath,
  kind: SortKind,
  id: string,
  position: number,
): BlueprintPath {
  const move: ListTransform = (items) => {
    const sourceIndex = items.findIndex((item) => item.id === id);
    if (sourceIndex < 0) return items;
    const reordered = [...items];
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(position, 0, moved);
    return reordered.map((item, index) => ({ ...item, position: index }));
  };
  return mapContainingList(path, kind, id, move);
}

/** The path with the revisions and positions the server reported written onto the list. */
export function applyPositionUpdates(
  path: BlueprintPath,
  kind: SortKind,
  id: string,
  updates: Update[],
): BlueprintPath {
  const byId = new Map(updates.map((update) => [update.id, update]));
  const apply: ListTransform = (items) =>
    items.map((item) => {
      const update = byId.get(item.id);
      return update ? { ...item, revision: update.revision, position: update.position } : item;
    });
  return mapContainingList(path, kind, id, apply);
}

/** The item `id` of this `kind`, wherever in the path it sits. */
export function findItem(path: BlueprintPath, kind: SortKind, id: string): Revisioned | undefined {
  const phases = path.blueprintPhases;
  const steps = phases.flatMap((phase) => phase.blueprintSteps);
  const questions = phases.flatMap((phase) => phase.blueprintCheckQuestions);
  const lists: Record<SortKind, Revisioned[]> = {
    phase: phases,
    step: steps,
    task: steps.flatMap((step) => step.blueprintTasks),
    question: questions,
    option: questions.flatMap((question) => question.blueprintCheckOptions),
  };
  return lists[kind].find((item) => item.id === id);
}

/** The ids of the list an item sits in -- a drag only reorders within one. */
export function siblingIds(path: BlueprintPath | null, kind: SortKind, id: string): string[] {
  const phases = path?.blueprintPhases ?? [];
  const steps = phases.flatMap((phase) => phase.blueprintSteps);
  const questions = phases.flatMap((phase) => phase.blueprintCheckQuestions);
  const lists: Record<SortKind, { id: string }[][]> = {
    phase: [phases],
    step: phases.map((phase) => phase.blueprintSteps),
    task: steps.map((step) => step.blueprintTasks),
    question: phases.map((phase) => phase.blueprintCheckQuestions),
    option: questions.map((question) => question.blueprintCheckOptions),
  };
  return (lists[kind].find((list) => contains(list, id)) ?? []).map((item) => item.id);
}

/** Tells the server the item's new position; the answer lists every sibling it renumbered. */
export function savePosition(
  scope: BlueprintScope,
  kind: SortKind,
  item: Revisioned,
  position: number,
): Promise<Update[]> {
  const body = { revision: item.revision, position };
  switch (kind) {
    case "phase":
      return blueprintService.updatePhasePosition(scope, item.id, body);
    case "step":
      return blueprintService.updateStepPosition(scope, item.id, body);
    case "task":
      return blueprintService.updateTaskPosition(scope, item.id, body);
    case "question":
      return blueprintService.updateQuestionPosition(scope, item.id, body);
    case "option":
      return blueprintService.updateOptionPosition(scope, item.id, body);
  }
}
