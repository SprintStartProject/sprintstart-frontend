import type { BlueprintQuestion, BlueprintStep } from "../types.ts";

export type BlueprintQuestionMetadata = {
  title: string;
  type: BlueprintQuestion["type"];
  question: string;
  explanation: string | null;
  correctAnswer: string | null;
};

export type BlueprintStepMetadata = Pick<
  BlueprintStep,
  "title" | "description" | "type" | "aiAssisted" | "estimatedMinutes" | "expectedOutcome"
>;

export const EMPTY_STEP_METADATA: BlueprintStepMetadata = {
  title: "",
  description: "",
  type: "DOCUMENT",
  aiAssisted: false,
  estimatedMinutes: 0,
  expectedOutcome: "",
};

export const EMPTY_QUESTION_METADATA: BlueprintQuestionMetadata = {
  title: "",
  type: "MULTIPLE_CHOICE",
  question: "",
  explanation: null,
  correctAnswer: null,
};

/** Each entity as it is stored, which is what "changed" is measured against. */
export function stepMetadataOf(step: BlueprintStep): BlueprintStepMetadata {
  return {
    title: step.title,
    description: step.description,
    type: step.type,
    aiAssisted: step.aiAssisted,
    estimatedMinutes: step.estimatedMinutes,
    expectedOutcome: step.expectedOutcome,
  };
}

export function questionMetadataOf(question: BlueprintQuestion): BlueprintQuestionMetadata {
  return {
    title: question.title,
    type: question.type,
    question: question.question,
    explanation: question.explanation,
    correctAnswer: question.correctAnswer,
  };
}

/** Whether what is on screen differs from what is stored. */
export function isStepChanged(step: BlueprintStep | null, edited: BlueprintStepMetadata): boolean {
  return step !== null && JSON.stringify(edited) !== JSON.stringify(stepMetadataOf(step));
}

export function isQuestionChanged(
  question: BlueprintQuestion | null,
  edited: BlueprintQuestionMetadata,
): boolean {
  return (
    question !== null && JSON.stringify(edited) !== JSON.stringify(questionMetadataOf(question))
  );
}

/** A setter for one field of the edited metadata, for the form's inputs. */
export function fieldSetter<T extends object>(
  onChange: (update: (current: T) => T) => void,
): <K extends keyof T>(key: K) => (value: T[K]) => void {
  return (key) => (value) => onChange((current) => ({ ...current, [key]: value }));
}
