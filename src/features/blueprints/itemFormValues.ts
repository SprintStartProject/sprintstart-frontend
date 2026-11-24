import type { EditTarget } from "./pathEditorTypes.ts";

/** Everything the add/edit overlay can hold, whichever kind of item it is open for. */
export type ItemFormValues = {
  title: string;
  description: string;
  phaseType: "FIXED" | "AI_ENHANCED";
  aiPrompt: string;
  url: string;
  stepType: string;
  minutes: string;
  outcome: string;
  questionType: string;
  questionTitle: string;
  explanation: string;
  correctAnswer: string;
  isCorrect: boolean;
};

/** What a new item starts with. */
export const BLANK_VALUES: ItemFormValues = {
  title: "",
  description: "",
  phaseType: "FIXED",
  aiPrompt: "",
  url: "",
  stepType: "DOCUMENT",
  minutes: "15",
  outcome: "",
  questionType: "MULTIPLE_CHOICE",
  questionTitle: "",
  explanation: "",
  correctAnswer: "",
  isCorrect: false,
};

type Editing = NonNullable<EditTarget>;
type ItemOf<K extends Editing["kind"]> = Extract<Editing, { kind: K }>["item"];

/** What each kind of item puts into the overlay; the rest stays at its blank value. */
const SEEDS: { [K in Editing["kind"]]: (item: ItemOf<K>) => Partial<ItemFormValues> } = {
  option: (item) => ({ title: item.label, isCorrect: item.correct }),
  // The overlay keeps the node's own name and the question text in two different fields.
  question: (item) => ({
    questionTitle: item.title,
    title: item.question,
    questionType: item.type,
    explanation: item.explanation ?? "",
    correctAnswer: item.correctAnswer ?? "",
  }),
  phase: (item) => ({
    title: item.title,
    description: item.description ?? "",
    phaseType: item.type,
    aiPrompt: item.aiPrompt ?? "",
  }),
  step: (item) => ({
    title: item.title,
    description: item.description,
    stepType: item.type,
    minutes: String(item.estimatedMinutes),
    outcome: item.expectedOutcome,
  }),
  resource: (item) => ({ title: item.title, description: item.description, url: item.url }),
  task: (item) => ({ title: item.title, description: item.description }),
};

/** The overlay seeded with whatever the kind of item being edited actually has. */
export function valuesForEdit(target: Editing): ItemFormValues {
  const seed = SEEDS[target.kind] as (item: Editing["item"]) => Partial<ItemFormValues>;
  return { ...BLANK_VALUES, ...seed(target.item) };
}
