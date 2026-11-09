import { blueprintService, type BlueprintScope } from "../../services/blueprintService.ts";
import type { ItemFormValues } from "./itemFormValues.ts";
import type { CreateTarget, EditTarget } from "./pathEditorTypes.ts";
import type { BlueprintQuestion, BlueprintStep } from "./types.ts";

type Editing = NonNullable<EditTarget>;
type Creating = NonNullable<CreateTarget>;
type StepType = "VIDEO" | "DOCUMENT" | "TASK";
type QuestionType = "MULTIPLE_CHOICE" | "SHORT_TEXT";

/** Sends the overlay's values as the change to the item being edited. */
export async function updateItem(scope: BlueprintScope, edit: Editing, v: ItemFormValues) {
  switch (edit.kind) {
    case "phase":
      await blueprintService.updatePhase(scope, edit.item.id, {
        revision: edit.item.revision,
        position: edit.item.position,
        title: v.title,
        description: v.description || null,
        type: v.phaseType,
        aiPrompt: v.phaseType === "AI_ENHANCED" ? v.aiPrompt || null : null,
      });
      return;
    case "step":
      await blueprintService.updateStep(scope, edit.item.id, {
        revision: edit.item.revision,
        position: edit.item.position,
        title: v.title,
        description: v.description,
        type: v.stepType as StepType,
        estimatedMinutes: Number(v.minutes),
        expectedOutcome: v.outcome,
        aiAssisted: edit.item.aiAssisted,
      });
      return;
    case "question":
      await blueprintService.updateQuestion(scope, edit.item.id, {
        revision: edit.item.revision,
        position: edit.item.position,
        title: v.questionTitle,
        type: v.questionType as QuestionType,
        question: v.title,
        explanation: v.explanation || null,
        correctAnswer: v.correctAnswer || null,
      });
      return;
    default:
      await updateLeaf(scope, edit, v);
  }
}

async function updateLeaf(
  scope: BlueprintScope,
  edit: Extract<Editing, { kind: "task" | "option" | "resource" }>,
  v: ItemFormValues,
) {
  if (edit.kind === "task") {
    await blueprintService.updateTask(scope, edit.item.id, {
      revision: edit.item.revision,
      position: edit.item.position,
      // The task form edits `title`; `questionTitle` belongs to the question form.
      title: v.title,
      description: v.description,
    });
  } else if (edit.kind === "option") {
    await blueprintService.updateOption(scope, edit.item.id, {
      revision: edit.item.revision,
      position: edit.item.position,
      label: v.title,
      correct: v.isCorrect,
    });
  } else {
    await blueprintService.updateResource(scope, edit.item.id, {
      revision: edit.item.revision,
      title: v.title,
      description: v.description,
      url: v.url,
    });
  }
}

/** What creating an item hands back: the new phase, step or question, which the page may place. */
export type CreatedItem =
  | { kind: "phase"; item: Awaited<ReturnType<typeof blueprintService.createPhase>> }
  | { kind: "step"; item: BlueprintStep }
  | { kind: "question"; item: BlueprintQuestion }
  | { kind: "other" };

/** Sends the overlay's values as a new item under `target.parentId`. */
export async function createItem(
  scope: BlueprintScope,
  target: Creating,
  v: ItemFormValues,
): Promise<CreatedItem> {
  const { parentId, position } = target;
  const placed = target.graphPosition;
  switch (target.kind) {
    case "phase":
      return {
        kind: "phase",
        item: await blueprintService.createPhase(scope, parentId, {
          position,
          title: v.title,
          description: v.description || null,
          aiPrompt: v.phaseType === "AI_ENHANCED" ? v.aiPrompt : null,
          type: v.phaseType,
          ...placed,
        }),
      };
    case "step":
      return {
        kind: "step",
        item: await blueprintService.createStep(scope, parentId, {
          position,
          title: v.title,
          description: v.description,
          type: v.stepType as StepType,
          estimatedMinutes: Number(v.minutes),
          expectedOutcome: v.outcome,
          ...placed,
        }),
      };
    case "question":
      return {
        kind: "question",
        item: await blueprintService.createQuestion(scope, parentId, {
          position,
          // The overlay asks for a node title separately, so a new question is not named after its
          // own wording.
          title: v.questionTitle || v.title,
          type: v.questionType as QuestionType,
          question: v.title,
          explanation: v.explanation || null,
          correctAnswer: v.correctAnswer || null,
          ...placed,
        }),
      };
    default:
      await createLeaf(scope, target, v);
      return { kind: "other" };
  }
}

async function createLeaf(scope: BlueprintScope, target: Creating, v: ItemFormValues) {
  const { parentId, position } = target;
  if (target.kind === "task") {
    await blueprintService.createTask(scope, parentId, {
      position,
      title: v.title,
      description: v.description,
    });
  } else if (target.kind === "resource") {
    await blueprintService.createResource(scope, parentId, {
      title: v.title,
      description: v.description,
      url: v.url,
    });
  } else {
    await blueprintService.createOption(scope, parentId, {
      position,
      label: v.title,
      correct: v.isCorrect,
    });
  }
}
