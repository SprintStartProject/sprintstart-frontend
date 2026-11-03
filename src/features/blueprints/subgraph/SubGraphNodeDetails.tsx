import type { FormEvent } from "react";
import type {
  BlueprintGraphNode,
  BlueprintOption,
  BlueprintPhase,
  BlueprintQuestion,
  BlueprintStep,
} from "../types.ts";
import type { BlueprintQuestionMetadata, BlueprintStepMetadata } from "./metadata.ts";
import type { Dispatch, SetStateAction } from "react";
import { QuestionDetails } from "./QuestionDetails.tsx";
import { StepDetails } from "./StepDetails.tsx";

type Task = BlueprintStep["blueprintTasks"][number];
type Resource = BlueprintStep["blueprintResources"][number];

/** What the details can ask the page to do with a node's tasks, resources and options. */
export type DetailActions = {
  onAddOption: (question: BlueprintQuestion, label: string, correct: boolean) => Promise<void>;
  onRemoveOption: (option: BlueprintOption) => Promise<void>;
  onEditOption: (option: BlueprintOption) => void;
  onAddTask: (step: BlueprintStep) => void;
  onRemoveTask: (task: Task) => void;
  onEditTask: (task: Task) => void;
  onAddResource: (step: BlueprintStep) => void;
  onRemoveResource: (resource: Resource) => void;
  onEditResource: (resource: Resource) => void;
};

/** The fields being edited in the open node, with where they are saved and how that went. */
export type DetailFields = {
  stepMetadata: BlueprintStepMetadata;
  stepSaveError: string | null;
  onStepMetadataChange: Dispatch<SetStateAction<BlueprintStepMetadata>>;
  onStepSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  questionMetadata: BlueprintQuestionMetadata;
  questionSaveError: string | null;
  onQuestionMetadataChange: Dispatch<SetStateAction<BlueprintQuestionMetadata>>;
  onQuestionSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
};

type SubGraphNodeDetailsProps = {
  node: BlueprintGraphNode;
  phase: BlueprintPhase;
  editable: boolean;
  fields: DetailFields;
  actions: DetailActions;
};

/** The step's or the knowledge check's details, whichever the node is. */
export function SubGraphNodeDetails({
  node,
  phase,
  editable,
  fields,
  actions,
}: SubGraphNodeDetailsProps) {
  const step = phase.blueprintSteps.find((item) => item.id === node.id);
  const question = phase.blueprintCheckQuestions.find((item) => item.id === node.id);

  if (step)
    return (
      <StepDetails
        step={step}
        editable={editable}
        saveError={fields.stepSaveError}
        metadata={fields.stepMetadata}
        onMetadataChange={fields.onStepMetadataChange}
        onSubmit={fields.onStepSubmit}
        onAddTask={actions.onAddTask}
        onRemoveTask={actions.onRemoveTask}
        onAddResource={actions.onAddResource}
        onRemoveResource={actions.onRemoveResource}
        onEditTask={actions.onEditTask}
        onEditResource={actions.onEditResource}
      />
    );
  if (question)
    return (
      <QuestionDetails
        question={question}
        editable={editable}
        metadata={fields.questionMetadata}
        saveError={fields.questionSaveError}
        onMetadataChange={fields.onQuestionMetadataChange}
        onSubmit={fields.onQuestionSubmit}
        onAddOption={actions.onAddOption}
        onRemoveOption={actions.onRemoveOption}
        onEditOption={actions.onEditOption}
      />
    );
  return <p className="text-sm text-app-text-muted">Details for this node are not available.</p>;
}
