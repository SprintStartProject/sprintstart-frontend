import { ArrowLeft, CircleHelp, ListChecks, Minus, Plus, Trash2 } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Badge } from "../../../components/ui/Badge.tsx";
import { Button } from "../../../components/ui/Button.tsx";
import { Field } from "../../../components/ui/Field.tsx";
import { Input } from "../../../components/ui/Input.tsx";
import { Select } from "../../../components/ui/Select.tsx";
import { SidePanel } from "../../../components/ui/SidePanel.tsx";
import { Textarea } from "../../../components/ui/Textarea.tsx";
import {
  BlueprintGraphCanvas,
  type BlueprintGraphCanvasNodeProps,
} from "./BlueprintGraphCanvas.tsx";
import type {
  BlueprintGraphNode,
  BlueprintOption,
  BlueprintPhase,
  BlueprintQuestion,
  BlueprintStep,
} from "../types.ts";

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

type Props = {
  phase: BlueprintPhase;
  nodes: BlueprintGraphNode[];
  editable: boolean;
  onBack: () => void;
  onPositionChange: (node: BlueprintGraphNode, x: number, y: number) => Promise<void>;
  onRemoveNode: (node: BlueprintGraphNode) => Promise<void>;
  onAddBlocker: (node: BlueprintGraphNode, blockerId: string) => Promise<void>;
  onRemoveBlocker: (node: BlueprintGraphNode, blockerId: string) => Promise<void>;
  onCreateFromLibrary: (kind: "step" | "question", graphX: number, graphY: number) => Promise<void>;
  onDeleteStep: (step: BlueprintStep) => Promise<void>;
  onDeleteQuestion: (question: BlueprintQuestion) => Promise<void>;
  onUpdateQuestion: (
    question: BlueprintQuestion,
    metadata: BlueprintQuestionMetadata,
  ) => Promise<void>;
  onAddOption: (question: BlueprintQuestion, label: string, correct: boolean) => Promise<void>;
  onRemoveOption: (option: BlueprintOption) => Promise<void>;
  onUpdateStep: (step: BlueprintStep, metadata: BlueprintStepMetadata) => Promise<void>;
  onAddTask: (step: BlueprintStep) => void;
  onRemoveTask: (task: BlueprintStep["blueprintTasks"][number]) => void;
  onAddResource: (step: BlueprintStep) => void;
  onRemoveResource: (resource: BlueprintStep["blueprintResources"][number]) => void;
  onEditTask: (task: BlueprintStep["blueprintTasks"][number]) => void;
  onEditResource: (resource: BlueprintStep["blueprintResources"][number]) => void;
  onEditOption: (option: BlueprintOption) => void;
};

/** Edits the step and knowledge-check dependency graph inside one fixed Blueprint phase. */
export function BlueprintSubGraphEditor({
  phase,
  nodes,
  editable,
  onBack,
  onPositionChange,
  onRemoveNode,
  onAddBlocker,
  onRemoveBlocker,
  onCreateFromLibrary,
  onDeleteStep,
  onDeleteQuestion,
  onUpdateQuestion,
  onAddOption,
  onRemoveOption,
  onUpdateStep,
  onAddTask,
  onRemoveTask,
  onAddResource,
  onRemoveResource,
  onEditTask,
  onEditResource,
  onEditOption,
}: Props) {
  const [detailsNodeId, setDetailsNodeId] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isQuestionEditing, setIsQuestionEditing] = useState(false);
  const [isQuestionSaving, setIsQuestionSaving] = useState(false);
  const [questionSaveError, setQuestionSaveError] = useState<string | null>(null);
  const [questionMetadata, setQuestionMetadata] = useState<BlueprintQuestionMetadata>({
    title: "",
    type: "MULTIPLE_CHOICE",
    question: "",
    explanation: null,
    correctAnswer: null,
  });
  const [isStepEditing, setIsStepEditing] = useState(false);
  const [stepMetadata, setStepMetadata] = useState<BlueprintStepMetadata>({
    title: "",
    description: "",
    type: "DOCUMENT",
    aiAssisted: false,
    estimatedMinutes: 0,
    expectedOutcome: "",
  });
  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

  function openNodeDetails(node: BlueprintGraphNode) {
    setDetailsNodeId(node.id);
    setIsQuestionEditing(false);
    setIsStepEditing(false);
    setQuestionSaveError(null);
    setIsDetailsOpen(true);
  }

  function closeNodeDetails() {
    setIsDetailsOpen(false);
    setIsQuestionEditing(false);
    setIsStepEditing(false);
    setDetailsNodeId(null);
  }

  const detailsNode = detailsNodeId ? nodeById.get(detailsNodeId) : null;
  const detailsQuestion = detailsNode
    ? (phase.blueprintCheckQuestions.find((question) => question.id === detailsNode.id) ?? null)
    : null;
  const detailsStep = detailsNode
    ? (phase.blueprintSteps.find((step) => step.id === detailsNode.id) ?? null)
    : null;

  async function deleteStep() {
    if (!detailsStep) return;
    closeNodeDetails();
    await onDeleteStep(detailsStep);
  }

  async function deleteQuestion() {
    if (!detailsQuestion) return;
    closeNodeDetails();
    await onDeleteQuestion(detailsQuestion);
  }

  function beginStepEditing() {
    if (!detailsStep) return;
    setStepMetadata({
      title: detailsStep.title,
      description: detailsStep.description,
      type: detailsStep.type,
      aiAssisted: detailsStep.aiAssisted,
      estimatedMinutes: detailsStep.estimatedMinutes,
      expectedOutcome: detailsStep.expectedOutcome,
    });
    setIsStepEditing(true);
  }

  async function saveStepMetadata(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detailsStep) return;
    await onUpdateStep(detailsStep, stepMetadata);
    setIsStepEditing(false);
  }

  function beginQuestionEditing() {
    if (!detailsQuestion) return;
    setQuestionMetadata({
      title: detailsQuestion.title,
      type: detailsQuestion.type,
      question: detailsQuestion.question,
      explanation: detailsQuestion.explanation,
      correctAnswer: detailsQuestion.correctAnswer,
    });
    setQuestionSaveError(null);
    setIsQuestionEditing(true);
  }

  async function saveQuestionMetadata(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detailsQuestion) return;
    setIsQuestionSaving(true);
    setQuestionSaveError(null);
    try {
      await onUpdateQuestion(detailsQuestion, questionMetadata);
      setIsQuestionEditing(false);
    } catch (reason) {
      setQuestionSaveError(
        reason instanceof Error ? reason.message : "Question metadata could not be saved.",
      );
    } finally {
      setIsQuestionSaving(false);
    }
  }

  return (
    <>
      <BlueprintGraphCanvas
        nodes={nodes}
        title={phase.title}
        description="Arrange this phase's steps and knowledge checks, then connect their prerequisites."
        headerAction={
          <Button
            variant="secondary"
            size="sm"
            icon={<ArrowLeft className="h-4 w-4" />}
            onClick={onBack}
          >
            Back to phases
          </Button>
        }
        libraryTitle="Phase content"
        libraryDescription="Drag steps and knowledge checks onto the canvas. Drop a canvas node here to return it to the library."
        libraryEmptyMessage="All phase content is on the canvas."
        libraryTemplates={[
          { id: "step", title: "New step", description: "Drop onto the canvas to create a step." },
          {
            id: "question",
            title: "New knowledge check",
            description: "Drop onto the canvas to create a knowledge check.",
          },
        ]}
        editable={editable}
        onNodeClick={openNodeDetails}
        onPositionChange={onPositionChange}
        onRemoveNode={onRemoveNode}
        onAddBlocker={onAddBlocker}
        onRemoveBlocker={onRemoveBlocker}
        onCreateFromLibrary={(templateId, graphX, graphY) => {
          if (templateId !== "step" && templateId !== "question")
            return Promise.reject(new Error("Unknown Blueprint node template."));
          return onCreateFromLibrary(templateId, graphX, graphY);
        }}
        renderNode={(node, graphNodeProps) => <SubGraphNodeCard node={node} {...graphNodeProps} />}
      />
      <SidePanel
        isOpen={isDetailsOpen && detailsNode !== null}
        onClose={() => {
          setIsDetailsOpen(false);
          setIsQuestionEditing(false);
          setIsStepEditing(false);
        }}
        title={detailsNode?.title ?? "Node details"}
        footer={
          detailsStep && editable ? (
            isStepEditing ? (
              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="dangerSoft"
                  icon={<Trash2 className="h-4 w-4" />}
                  onClick={() => void deleteStep()}
                >
                  Delete
                </Button>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setIsStepEditing(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" type="submit" form="edit-blueprint-step">
                    Save changes
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="dangerSoft"
                  icon={<Trash2 className="h-4 w-4" />}
                  onClick={() => void deleteStep()}
                >
                  Delete
                </Button>
                <Button variant="secondary" onClick={beginStepEditing}>
                  Edit
                </Button>
              </div>
            )
          ) : detailsQuestion && editable ? (
            isQuestionEditing ? (
              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="dangerSoft"
                  icon={<Trash2 className="h-4 w-4" />}
                  onClick={() => void deleteQuestion()}
                >
                  Delete
                </Button>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setIsQuestionEditing(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    type="submit"
                    form="edit-blueprint-question"
                    loading={isQuestionSaving}
                  >
                    Save changes
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="dangerSoft"
                  icon={<Trash2 className="h-4 w-4" />}
                  onClick={() => void deleteQuestion()}
                >
                  Delete
                </Button>
                <Button variant="secondary" onClick={beginQuestionEditing}>
                  Edit
                </Button>
              </div>
            )
          ) : undefined
        }
      >
        {detailsNode ? (
          <SubGraphNodeDetails
            node={detailsNode}
            phase={phase}
            editable={editable}
            isQuestionEditing={isQuestionEditing}
            questionMetadata={questionMetadata}
            questionSaveError={questionSaveError}
            onQuestionMetadataChange={setQuestionMetadata}
            onQuestionSubmit={saveQuestionMetadata}
            onAddOption={onAddOption}
            onRemoveOption={onRemoveOption}
            isStepEditing={isStepEditing}
            stepMetadata={stepMetadata}
            onStepMetadataChange={setStepMetadata}
            onStepSubmit={saveStepMetadata}
            onAddTask={onAddTask}
            onRemoveTask={onRemoveTask}
            onAddResource={onAddResource}
            onRemoveResource={onRemoveResource}
            onEditTask={onEditTask}
            onEditResource={onEditResource}
            onEditOption={onEditOption}
          />
        ) : null}
      </SidePanel>
    </>
  );
}

function SubGraphNodeCard({
  node,
  draggable,
  disabled,
  onDragStart,
  onClick,
}: { node: BlueprintGraphNode } & BlueprintGraphCanvasNodeProps) {
  const isQuestion = node.type === "QUESTION";
  return (
    <div
      data-graph-node
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      role="button"
      tabIndex={0}
      className={
        (draggable ? "cursor-grab " : "cursor-default ") +
        "min-h-20 rounded-xl border border-app-border bg-app-surface p-3 shadow-sm" +
        (disabled ? " pointer-events-none" : "")
      }
    >
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 text-sm font-semibold text-app-text">{node.title}</p>
        {isQuestion ? (
          <CircleHelp className="h-4 w-4 shrink-0 text-app-text-muted" aria-hidden="true" />
        ) : (
          <ListChecks className="h-4 w-4 shrink-0 text-app-text-muted" aria-hidden="true" />
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge variant="neutral">{isQuestion ? "Knowledge check" : "Step"}</Badge>
      </div>
    </div>
  );
}

function SubGraphNodeDetails({
  node,
  phase,
  editable,
  isQuestionEditing,
  questionMetadata,
  questionSaveError,
  onQuestionMetadataChange,
  onQuestionSubmit,
  onAddOption,
  onRemoveOption,
  isStepEditing,
  stepMetadata,
  onStepMetadataChange,
  onStepSubmit,
  onAddTask,
  onRemoveTask,
  onAddResource,
  onRemoveResource,
  onEditTask,
  onEditResource,
  onEditOption,
}: {
  node: BlueprintGraphNode;
  phase: BlueprintPhase;
  editable: boolean;
  isQuestionEditing: boolean;
  questionMetadata: BlueprintQuestionMetadata;
  questionSaveError: string | null;
  onQuestionMetadataChange: React.Dispatch<React.SetStateAction<BlueprintQuestionMetadata>>;
  onQuestionSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  onAddOption: (question: BlueprintQuestion, label: string, correct: boolean) => Promise<void>;
  onRemoveOption: (option: BlueprintOption) => Promise<void>;
  isStepEditing: boolean;
  stepMetadata: BlueprintStepMetadata;
  onStepMetadataChange: React.Dispatch<React.SetStateAction<BlueprintStepMetadata>>;
  onStepSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  onAddTask: (step: BlueprintStep) => void;
  onRemoveTask: (task: BlueprintStep["blueprintTasks"][number]) => void;
  onAddResource: (step: BlueprintStep) => void;
  onRemoveResource: (resource: BlueprintStep["blueprintResources"][number]) => void;
  onEditTask: (task: BlueprintStep["blueprintTasks"][number]) => void;
  onEditResource: (resource: BlueprintStep["blueprintResources"][number]) => void;
  onEditOption: (option: BlueprintOption) => void;
}) {
  const step = phase.blueprintSteps.find((item) => item.id === node.id);
  const question = phase.blueprintCheckQuestions.find((item) => item.id === node.id);

  if (step)
    return (
      <StepDetails
        step={step}
        editable={editable}
        isEditing={isStepEditing}
        metadata={stepMetadata}
        onMetadataChange={onStepMetadataChange}
        onSubmit={onStepSubmit}
        onAddTask={onAddTask}
        onRemoveTask={onRemoveTask}
        onAddResource={onAddResource}
        onRemoveResource={onRemoveResource}
        onEditTask={onEditTask}
        onEditResource={onEditResource}
      />
    );
  if (question)
    return (
      <QuestionDetails
        question={question}
        editable={editable}
        isEditing={isQuestionEditing}
        metadata={questionMetadata}
        saveError={questionSaveError}
        onMetadataChange={onQuestionMetadataChange}
        onSubmit={onQuestionSubmit}
        onAddOption={onAddOption}
        onRemoveOption={onRemoveOption}
        onEditOption={onEditOption}
      />
    );
  return <p className="text-sm text-app-text-muted">Details for this node are not available.</p>;
}

function StepDetails({
  step,
  editable,
  isEditing,
  metadata,
  onMetadataChange,
  onSubmit,
  onAddTask,
  onRemoveTask,
  onAddResource,
  onRemoveResource,
  onEditTask,
  onEditResource,
}: {
  step: BlueprintStep;
  editable: boolean;
  isEditing: boolean;
  metadata: BlueprintStepMetadata;
  onMetadataChange: React.Dispatch<React.SetStateAction<BlueprintStepMetadata>>;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  onAddTask: (step: BlueprintStep) => void;
  onRemoveTask: (task: BlueprintStep["blueprintTasks"][number]) => void;
  onAddResource: (step: BlueprintStep) => void;
  onRemoveResource: (resource: BlueprintStep["blueprintResources"][number]) => void;
  onEditTask: (task: BlueprintStep["blueprintTasks"][number]) => void;
  onEditResource: (resource: BlueprintStep["blueprintResources"][number]) => void;
}) {
  if (isEditing)
    return (
      <form
        id="edit-blueprint-step"
        className="space-y-5"
        onSubmit={(event) => void onSubmit(event)}
      >
        <Field label="Title" required>
          <Input
            value={metadata.title}
            onChange={(event) =>
              onMetadataChange((current) => ({ ...current, title: event.target.value }))
            }
            required
          />
        </Field>
        <Field label="Description" required>
          <Textarea
            value={metadata.description}
            onChange={(event) =>
              onMetadataChange((current) => ({ ...current, description: event.target.value }))
            }
            required
          />
        </Field>
        <Field label="Step type">
          <Select
            value={metadata.type}
            onChange={(event) =>
              onMetadataChange((current) => ({
                ...current,
                type: event.target.value as BlueprintStep["type"],
              }))
            }
          >
            <option value="DOCUMENT">Document</option>
            <option value="VIDEO">Video</option>
            <option value="TASK">Task</option>
          </Select>
        </Field>
        <Field label="Estimated minutes">
          <Input
            type="number"
            min="0"
            value={metadata.estimatedMinutes}
            onChange={(event) =>
              onMetadataChange((current) => ({
                ...current,
                estimatedMinutes: Number(event.target.value),
              }))
            }
          />
        </Field>
        <Field label="Expected outcome">
          <Textarea
            value={metadata.expectedOutcome}
            onChange={(event) =>
              onMetadataChange((current) => ({ ...current, expectedOutcome: event.target.value }))
            }
          />
        </Field>
      </form>
    );
  return (
    <div className="space-y-5 text-sm">
      <dl className="grid grid-cols-2 gap-3">
        <Detail label="Type" value={step.type} />
        <Detail label="Duration" value={`${step.estimatedMinutes} minutes`} />
      </dl>
      <Detail label="Expected outcome" value={step.expectedOutcome || "Not specified."} />
      <DetailList
        title="Tasks"
        action={
          editable ? (
            <Button
              size="sm"
              variant="secondary"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => onAddTask(step)}
            >
              Add task
            </Button>
          ) : undefined
        }
      >
        {step.blueprintTasks.length ? (
          step.blueprintTasks
            .toSorted((left, right) => left.position - right.position)
            .map((task) => (
              <div
                key={task.id}
                className="flex cursor-pointer justify-between gap-2 rounded-lg bg-app-surface-muted p-3"
                role="button"
                tabIndex={0}
                onClick={() => onEditTask(task)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onEditTask(task);
                  }
                }}
              >
                <div>
                  <p className="font-medium text-app-text">{task.title}</p>
                  <p className="mt-1 whitespace-pre-wrap text-app-text-muted">{task.description}</p>
                </div>
                {editable ? (
                  <Button
                    aria-label={`Delete task ${task.title}`}
                    iconOnly
                    size="sm"
                    variant="dangerGhost"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRemoveTask(task);
                    }}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            ))
        ) : (
          <EmptyDetailListItem>No tasks have been added.</EmptyDetailListItem>
        )}
      </DetailList>
      <DetailList
        title="Resources"
        action={
          editable ? (
            <Button
              size="sm"
              variant="secondary"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => onAddResource(step)}
            >
              Add resource
            </Button>
          ) : undefined
        }
      >
        {step.blueprintResources.length ? (
          step.blueprintResources.map((resource) => (
            <div
              key={resource.id}
              className="flex cursor-pointer items-start justify-between gap-3 rounded-lg bg-app-surface-muted p-3"
              role="button"
              tabIndex={0}
              onClick={() => onEditResource(resource)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onEditResource(resource);
                }
              }}
            >
              <div>
                <p className="font-medium text-app-text">{resource.title}</p>
                <p className="mt-1 whitespace-pre-wrap text-app-text-muted">
                  {resource.description}
                </p>
              </div>
              {editable ? (
                <Button
                  aria-label={`Delete resource ${resource.title}`}
                  iconOnly
                  size="sm"
                  variant="dangerGhost"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemoveResource(resource);
                  }}
                >
                  <Minus className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          ))
        ) : (
          <EmptyDetailListItem>No resources have been added.</EmptyDetailListItem>
        )}
      </DetailList>
    </div>
  );
}

function QuestionDetails({
  question,
  editable,
  isEditing,
  metadata,
  saveError,
  onMetadataChange,
  onSubmit,
  onAddOption,
  onRemoveOption,
  onEditOption,
}: {
  question: BlueprintQuestion;
  editable: boolean;
  isEditing: boolean;
  metadata: BlueprintQuestionMetadata;
  saveError: string | null;
  onMetadataChange: React.Dispatch<React.SetStateAction<BlueprintQuestionMetadata>>;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  onAddOption: (question: BlueprintQuestion, label: string, correct: boolean) => Promise<void>;
  onRemoveOption: (option: BlueprintOption) => Promise<void>;
  onEditOption: (option: BlueprintOption) => void;
}) {
  const [isAddingOption, setIsAddingOption] = useState(false);
  const [optionLabel, setOptionLabel] = useState("");
  const [isCorrectOption, setIsCorrectOption] = useState(false);
  const [isOptionSaving, setIsOptionSaving] = useState(false);
  const [optionError, setOptionError] = useState<string | null>(null);

  async function addOption(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsOptionSaving(true);
    setOptionError(null);
    try {
      await onAddOption(question, optionLabel, isCorrectOption);
      setOptionLabel("");
      setIsCorrectOption(false);
      setIsAddingOption(false);
    } catch (reason) {
      setOptionError(reason instanceof Error ? reason.message : "Option could not be added.");
    } finally {
      setIsOptionSaving(false);
    }
  }

  if (isEditing)
    return (
      <form
        id="edit-blueprint-question"
        className="space-y-5"
        onSubmit={(event) => void onSubmit(event)}
      >
        <Field label="Title" required>
          <Input
            value={metadata.title}
            onChange={(event) =>
              onMetadataChange((current) => ({ ...current, title: event.target.value }))
            }
            required
          />
        </Field>
        <Field label="Question type">
          <Select
            value={metadata.type}
            onChange={(event) =>
              onMetadataChange((current) => ({
                ...current,
                type: event.target.value as BlueprintQuestion["type"],
              }))
            }
          >
            <option value="MULTIPLE_CHOICE">Multiple choice</option>
            <option value="SHORT_TEXT">Short text</option>
          </Select>
        </Field>
        <Field label="Question" required>
          <Textarea
            value={metadata.question}
            onChange={(event) =>
              onMetadataChange((current) => ({ ...current, question: event.target.value }))
            }
            required
          />
        </Field>
        <Field label="Explanation">
          <Textarea
            value={metadata.explanation ?? ""}
            onChange={(event) =>
              onMetadataChange((current) => ({ ...current, explanation: event.target.value }))
            }
          />
        </Field>
        <Field label="Correct answer">
          <Input
            value={metadata.correctAnswer ?? ""}
            onChange={(event) =>
              onMetadataChange((current) => ({ ...current, correctAnswer: event.target.value }))
            }
          />
        </Field>
        {saveError ? (
          <p role="alert" className="text-sm text-app-danger-text">
            {saveError}
          </p>
        ) : null}
      </form>
    );

  return (
    <div className="space-y-5 text-sm">
      <dl className="grid grid-cols-2 gap-3">
        <Detail label="Type" value={question.type} />
        <Detail label="Options" value={String(question.blueprintCheckOptions.length)} />
      </dl>
      <Detail label="Question" value={question.question} />
      <Detail label="Explanation" value={question.explanation || "Not specified."} />
      <section>
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold text-app-text">Options</h3>
          {editable && question.type === "MULTIPLE_CHOICE" ? (
            <Button
              variant="secondary"
              size="sm"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => setIsAddingOption(true)}
            >
              Add option
            </Button>
          ) : null}
        </div>
        {isAddingOption ? (
          <form
            className="mt-3 space-y-3 rounded-lg bg-app-surface-muted p-3"
            onSubmit={(event) => void addOption(event)}
          >
            <Field label="Option" required>
              <Input
                value={optionLabel}
                onChange={(event) => setOptionLabel(event.target.value)}
                required
              />
            </Field>
            <label className="flex items-center gap-2 text-sm text-app-text">
              <input
                type="checkbox"
                checked={isCorrectOption}
                onChange={(event) => setIsCorrectOption(event.target.checked)}
              />{" "}
              Correct option
            </label>
            {optionError ? (
              <p role="alert" className="text-sm text-app-danger-text">
                {optionError}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsAddingOption(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" loading={isOptionSaving}>
                Add option
              </Button>
            </div>
          </form>
        ) : null}
        <ul className="mt-2 space-y-2">
          {question.blueprintCheckOptions.length ? (
            question.blueprintCheckOptions
              .toSorted((left, right) => left.position - right.position)
              .map((option) => (
                <li key={option.id} className="relative rounded-lg bg-app-surface-muted">
                  <button
                    type="button"
                    aria-label={`Edit option ${option.label}`}
                    className="absolute inset-0 cursor-pointer rounded-lg"
                    onClick={() => onEditOption(option)}
                  />
                  <div className="pointer-events-none relative flex items-center justify-between gap-3 p-3">
                    <span className="font-medium text-app-text">{option.label}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant={option.correct ? "success" : "neutral"}>
                        {option.correct ? "Correct" : "Incorrect"}
                      </Badge>
                      {editable ? (
                        <Button
                          aria-label={`Delete option ${option.label}`}
                          iconOnly
                          size="sm"
                          variant="dangerGhost"
                          className="pointer-events-auto relative"
                          onClick={(event) => {
                            event.stopPropagation();
                            void onRemoveOption(option);
                          }}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))
          ) : (
            <EmptyDetailListItem>No options have been added.</EmptyDetailListItem>
          )}
        </ul>
      </section>
    </div>
  );
}

function DetailList({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-app-text">{title}</h3>
        {action}
      </div>
      <ul className="mt-2 space-y-2">{children}</ul>
    </section>
  );
}

function EmptyDetailListItem({ children }: { children: ReactNode }) {
  return <li className="text-app-text-muted">{children}</li>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-app-surface-muted p-3">
      <dt className="text-xs text-app-text-muted">{label}</dt>
      <dd className="mt-1 font-medium whitespace-pre-wrap text-app-text">{value}</dd>
    </div>
  );
}
