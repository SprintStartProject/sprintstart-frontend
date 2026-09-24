import {
  ArrowLeft,
  Check,
  CircleHelp,
  FilePlus2,
  ListChecks,
  Minus,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertDialog } from "../../../components/ui/AlertDialog.tsx";
import { Badge } from "../../../components/ui/Badge.tsx";
import { Button } from "../../../components/ui/Button.tsx";
import { Field } from "../../../components/ui/Field.tsx";
import { Input } from "../../../components/ui/Input.tsx";
import { Select } from "../../../components/ui/Select.tsx";
import { Textarea } from "../../../components/ui/Textarea.tsx";
import { useToast } from "../../../context/useToast.ts";
import {
  BlueprintGraphCanvas,
  type BlueprintGraphCanvasNodeProps,
} from "./BlueprintGraphCanvas.tsx";
import { BlueprintNodeCard } from "./BlueprintNodeCard.tsx";
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
  /**
   * Asks the page to open a draft, on a version that cannot be edited, carrying the node it was
   * asked from — so the author lands back in front of it rather than on a graph with nothing open.
   *
   * Without it a published blueprint drew a details panel with no footer at all, which reads as
   * "this has no actions" rather than "not on this version".
   */
  onRequestDraft?: (node: BlueprintGraphNode) => void;
  /**
   * A node to open as soon as it is there, found by title.
   *
   * By title rather than by id: the one caller is a landing on a freshly opened draft, and a draft
   * is a copy, so every id in it is new while the titles are the ones the author just read.
   */
  openNodeTitle?: string | null;
  onOpenedNode?: () => void;
  onBack: () => void;
  onPositionChange: (node: BlueprintGraphNode, x: number, y: number) => Promise<void>;
  onAddBlocker: (node: BlueprintGraphNode, blockerId: string) => Promise<void>;
  onRemoveBlocker: (node: BlueprintGraphNode, blockerId: string) => Promise<void>;
  onCreateNode: (kind: "step" | "question", graphX: number, graphY: number) => Promise<void>;
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
  onRequestDraft,
  openNodeTitle = null,
  onOpenedNode,
  onBack,
  onPositionChange,
  onAddBlocker,
  onRemoveBlocker,
  onCreateNode,
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
  const [isQuestionSaving, setIsQuestionSaving] = useState(false);
  const [questionSaveError, setQuestionSaveError] = useState<string | null>(null);
  const [questionMetadata, setQuestionMetadata] = useState<BlueprintQuestionMetadata>({
    title: "",
    type: "MULTIPLE_CHOICE",
    question: "",
    explanation: null,
    correctAnswer: null,
  });
  const [isStepSaving, setIsStepSaving] = useState(false);
  const [stepSaveError, setStepSaveError] = useState<string | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDiscardConfirmOpen, setIsDiscardConfirmOpen] = useState(false);
  /** Where the author was on their way to when the unsaved-changes question stopped them. */
  const [nodeAfterDiscard, setNodeAfterDiscard] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const toast = useToast();
  const [stepMetadata, setStepMetadata] = useState<BlueprintStepMetadata>({
    title: "",
    description: "",
    type: "DOCUMENT",
    aiAssisted: false,
    estimatedMinutes: 0,
    expectedOutcome: "",
  });
  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

  /** Each entity as it is stored, which is what "changed" is measured against. */
  function stepMetadataOf(step: BlueprintStep): BlueprintStepMetadata {
    return {
      title: step.title,
      description: step.description,
      type: step.type,
      aiAssisted: step.aiAssisted,
      estimatedMinutes: step.estimatedMinutes,
      expectedOutcome: step.expectedOutcome,
    };
  }

  function questionMetadataOf(question: BlueprintQuestion): BlueprintQuestionMetadata {
    return {
      title: question.title,
      type: question.type,
      question: question.question,
      explanation: question.explanation,
      correctAnswer: question.correctAnswer,
    };
  }

  function openNodeDetails(node: BlueprintGraphNode) {
    setDetailsNodeId(node.id);
    setQuestionSaveError(null);
    setStepSaveError(null);

    const step = phase.blueprintSteps.find((item) => item.id === node.id);
    if (step) setStepMetadata(stepMetadataOf(step));
    const question = phase.blueprintCheckQuestions.find((item) => item.id === node.id);
    if (question) setQuestionMetadata(questionMetadataOf(question));

    setIsDetailsOpen(true);
  }

  // Asked for from somewhere else — a draft opened from inside this very node. Cleared through the
  // callback, so it opens once rather than every time the phase is reloaded.
  useEffect(() => {
    if (!openNodeTitle) return;
    const match = nodes.find((node) => node.title === openNodeTitle);
    if (!match) return;
    // Deferred to a microtask: React 19's lint rejects a synchronous setState in an effect body,
    // and this is the pattern the repo already passes with.
    queueMicrotask(() => {
      openNodeDetails(match);
      onOpenedNode?.();
    });
    // `openNodeDetails` reads this render's phase, which is what its metadata has to come from.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, onOpenedNode, openNodeTitle]);

  /**
   * Steps from the open node to one of its neighbours.
   *
   * Through the same question closing asks, because it is the same risk: leaving a node with
   * unsaved fields loses them, and it makes no difference whether it was left through the way out
   * or through the way onward.
   */
  function goToNode(id: string) {
    const node = nodeById.get(id);
    if (!node) return;
    if ((detailsStep && isStepDirty) || (detailsQuestion && isQuestionDirty)) {
      setNodeAfterDiscard(id);
      setIsDiscardConfirmOpen(true);
      return;
    }
    openNodeDetails(node);
  }

  function closeNodeDetails() {
    setIsDetailsOpen(false);
    setDetailsNodeId(null);
  }

  const detailsNode = detailsNodeId ? nodeById.get(detailsNodeId) : null;
  const detailsQuestion = detailsNode
    ? (phase.blueprintCheckQuestions.find((question) => question.id === detailsNode.id) ?? null)
    : null;
  const detailsStep = detailsNode
    ? (phase.blueprintSteps.find((step) => step.id === detailsNode.id) ?? null)
    : null;

  /**
   * Deletes whichever of the two the details panel is showing, once it has been confirmed.
   *
   * The panel closes after the request, not before: closing first said "gone" before anybody knew,
   * and left a failure with nowhere to appear.
   */
  async function deleteDetailsNode() {
    const target = detailsStep ?? detailsQuestion;
    if (!target) return;
    const isStep = detailsStep !== null;
    const { title } = target;

    setIsDeleting(true);
    setDeleteError(null);
    try {
      if (detailsStep) await onDeleteStep(detailsStep);
      else if (detailsQuestion) await onDeleteQuestion(detailsQuestion);
      setIsDeleteConfirmOpen(false);
      closeNodeDetails();
      toast.success(`${isStep ? "Step" : "Knowledge check"} "${title}" deleted`);
    } catch (reason) {
      setDeleteError(
        reason instanceof Error
          ? reason.message
          : `The ${isStep ? "step" : "knowledge check"} could not be deleted.`,
      );
    } finally {
      setIsDeleting(false);
    }
  }

  /** Whether what is on screen differs from what is stored, per entity. */
  const isStepDirty =
    detailsStep !== null &&
    JSON.stringify(stepMetadata) !== JSON.stringify(stepMetadataOf(detailsStep));
  const isQuestionDirty =
    detailsQuestion !== null &&
    JSON.stringify(questionMetadata) !== JSON.stringify(questionMetadataOf(detailsQuestion));

  async function saveStepMetadata(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detailsStep) return;
    setIsStepSaving(true);
    setStepSaveError(null);
    try {
      await onUpdateStep(detailsStep, stepMetadata);
      toast.success("Step saved");
    } catch (reason) {
      setStepSaveError(
        reason instanceof Error ? reason.message : "Step metadata could not be saved.",
      );
    } finally {
      setIsStepSaving(false);
    }
  }

  async function saveQuestionMetadata(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detailsQuestion) return;
    setIsQuestionSaving(true);
    setQuestionSaveError(null);
    try {
      await onUpdateQuestion(detailsQuestion, questionMetadata);
      toast.success("Knowledge check saved");
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
        emptyTitle="No steps or knowledge checks on the canvas yet"
        createKinds={[
          { id: "step", label: "New step" },
          { id: "question", label: "New check" },
        ]}
        editable={editable}
        onNodeClick={openNodeDetails}
        onPositionChange={onPositionChange}
        onAddBlocker={onAddBlocker}
        onRemoveBlocker={onRemoveBlocker}
        onCreateNode={(kindId, graphX, graphY) =>
          onCreateNode(kindId === "question" ? "question" : "step", graphX, graphY)
        }
        renderNode={(node, graphNodeProps) => <SubGraphNodeCard node={node} {...graphNodeProps} />}
        openNodeId={isDetailsOpen ? detailsNodeId : null}
        onNavigateNodeDetail={goToNode}
        onCloseNodeDetail={() => {
          // Without the mode there is no Cancel, so stepping back out is the only way to walk away
          // from an edit — and it has to say so rather than dropping the work on the floor.
          if ((detailsStep && isStepDirty) || (detailsQuestion && isQuestionDirty)) {
            setIsDiscardConfirmOpen(true);
            return;
          }
          setIsDetailsOpen(false);
        }}
        renderNodeDetail={(node) => ({
          title: node.title,
          body: (
            <SubGraphNodeDetails
              node={node}
              phase={phase}
              editable={editable}
              isQuestionEditing={editable}
              questionMetadata={questionMetadata}
              questionSaveError={questionSaveError}
              onQuestionMetadataChange={setQuestionMetadata}
              onQuestionSubmit={saveQuestionMetadata}
              onAddOption={onAddOption}
              onRemoveOption={onRemoveOption}
              isStepEditing={editable}
              stepSaveError={stepSaveError}
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
          ),
          footer:
            (detailsStep || detailsQuestion) && editable ? (
              /*
                No edit mode, and so nothing to cancel: the fields are live and the footer says
                whether what is on screen has reached the server. Pressing Edit to change a field and
                Cancel to stop was two decisions about a mode on top of the one real decision.
              */
              <div className="flex items-center justify-between gap-3">
                <Button
                  variant="dangerSoft"
                  icon={<Trash2 className="h-4 w-4" />}
                  onClick={() => {
                    setDeleteError(null);
                    setIsDeleteConfirmOpen(true);
                  }}
                >
                  Delete
                </Button>
                {(detailsStep && isStepDirty) || (detailsQuestion && isQuestionDirty) ? (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      type="button"
                      onClick={() => {
                        if (detailsStep) setStepMetadata(stepMetadataOf(detailsStep));
                        if (detailsQuestion)
                          setQuestionMetadata(questionMetadataOf(detailsQuestion));
                      }}
                    >
                      Discard
                    </Button>
                    <Button
                      variant="primary"
                      type="submit"
                      form={detailsStep ? "edit-blueprint-step" : "edit-blueprint-question"}
                      loading={detailsStep ? isStepSaving : isQuestionSaving}
                    >
                      Save changes
                    </Button>
                  </div>
                ) : (
                  <p className="flex items-center gap-1.5 text-sm text-app-text-muted">
                    <Check className="h-4 w-4 text-app-success-solid" aria-hidden="true" />
                    Saved
                  </p>
                )}
              </div>
            ) : onRequestDraft ? (
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-app-text-muted">
                  This version is published, so it is read-only.
                </p>
                <Button
                  variant="primary"
                  icon={<FilePlus2 className="h-4 w-4" />}
                  onClick={() => onRequestDraft(node)}
                >
                  Edit as draft
                </Button>
              </div>
            ) : undefined,
        })}
      />
      <AlertDialog
        isOpen={isDeleteConfirmOpen}
        title={
          detailsStep
            ? `Delete step "${detailsStep.title}"?`
            : detailsQuestion
              ? `Delete knowledge check "${detailsQuestion.title}"?`
              : "Delete this node?"
        }
        description={
          <>
            <p>
              {detailsStep
                ? "Its tasks, resources and every prerequisite pointing at it go with it."
                : "Its answer options and every prerequisite pointing at it go with it."}{" "}
              Hires who already have a path built from this blueprint keep theirs.
            </p>
            <p className="mt-2">This cannot be undone from here.</p>
          </>
        }
        confirmLabel={detailsStep ? "Delete step" : "Delete knowledge check"}
        variant="danger"
        isLoading={isDeleting}
        loadingLabel="Deleting…"
        errorMessage={deleteError ?? undefined}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={() => void deleteDetailsNode()}
      />
      <AlertDialog
        isOpen={isDiscardConfirmOpen}
        title="Discard your changes?"
        description={
          <p>
            This {detailsStep ? "step" : "knowledge check"} has edits that have not been saved.
            {nodeAfterDiscard ? " Discarding them moves on to the next one." : ""}
          </p>
        }
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        variant="danger"
        onClose={() => {
          setIsDiscardConfirmOpen(false);
          setNodeAfterDiscard(null);
        }}
        onConfirm={() => {
          if (detailsStep) setStepMetadata(stepMetadataOf(detailsStep));
          if (detailsQuestion) setQuestionMetadata(questionMetadataOf(detailsQuestion));
          setIsDiscardConfirmOpen(false);
          const next = nodeAfterDiscard ? nodeById.get(nodeAfterDiscard) : null;
          setNodeAfterDiscard(null);
          if (next) {
            openNodeDetails(next);
            return;
          }
          setIsDetailsOpen(false);
        }}
      />
    </>
  );
}

function SubGraphNodeCard({
  node,
  ...cardProps
}: { node: BlueprintGraphNode } & BlueprintGraphCanvasNodeProps) {
  const isQuestion = node.type === "QUESTION";

  return (
    <BlueprintNodeCard
      {...cardProps}
      title={node.title}
      kind={{
        label: isQuestion ? "Knowledge check" : "Step",
        icon: isQuestion ? CircleHelp : ListChecks,
      }}
      // Two kinds on one canvas, and the difference is what the hire is asked to *do*: work through
      // something, or answer for it. That is the distinction the colour carries here.
      accent={isQuestion ? "orange" : "brand"}
      // A diamond for a check, a circle for a step. Two kinds on one canvas have to stay apart for
      // a reader who cannot tell two small colours apart, and at the zoom where a whole phase fits
      // the outline is all there is left of either.
      glyph={isQuestion ? "diamond" : "round"}
    />
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
  stepSaveError,
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
  stepSaveError: string | null;
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
        saveError={stepSaveError}
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
  saveError,
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
  saveError: string | null;
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
  // Fields and lists both, always. They used to be two branches of an edit mode, so on a draft —
  // where the form is what you get — there was no way to reach the tasks or the resources at all.
  const form = (
    <form id="edit-blueprint-step" className="space-y-5" onSubmit={(event) => void onSubmit(event)}>
      <Field label="Title" required>
        <Input
          value={metadata.title}
          onChange={(event) =>
            onMetadataChange((current) => ({
              ...current,
              title: event.target.value,
            }))
          }
          required
        />
      </Field>
      <Field label="Description" required>
        <Textarea
          value={metadata.description}
          onChange={(event) =>
            onMetadataChange((current) => ({
              ...current,
              description: event.target.value,
            }))
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
          min="1"
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
            onMetadataChange((current) => ({
              ...current,
              expectedOutcome: event.target.value,
            }))
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
    <div className="space-y-6 text-sm">
      {isEditing ? (
        form
      ) : (
        <div className="space-y-5">
          <p className="text-app-text-muted">{step.description || "No description yet."}</p>
          <dl className="grid grid-cols-2 gap-3">
            <Detail label="Type" value={step.type} />
            <Detail label="Duration" value={`${step.estimatedMinutes} minutes`} />
          </dl>
          <Detail label="Expected outcome" value={step.expectedOutcome || "Not specified."} />
        </div>
      )}
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
              // The row inside the item, not instead of it: a `ul` whose children are
              // `role="button"` is announced as an empty list.
              <li key={task.id}>
                <div
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
                    <p className="mt-1 whitespace-pre-wrap text-app-text-muted">
                      {task.description}
                    </p>
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
              </li>
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
            <li key={resource.id}>
              <div
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
            </li>
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

  const form = (
    <form
      id="edit-blueprint-question"
      className="space-y-5"
      onSubmit={(event) => void onSubmit(event)}
    >
      <Field label="Title" required>
        <Input
          value={metadata.title}
          onChange={(event) =>
            onMetadataChange((current) => ({
              ...current,
              title: event.target.value,
            }))
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
            onMetadataChange((current) => ({
              ...current,
              question: event.target.value,
            }))
          }
          required
        />
      </Field>
      <Field label="Explanation">
        <Textarea
          value={metadata.explanation ?? ""}
          onChange={(event) =>
            onMetadataChange((current) => ({
              ...current,
              explanation: event.target.value,
            }))
          }
        />
      </Field>
      <Field label="Correct answer">
        <Input
          value={metadata.correctAnswer ?? ""}
          onChange={(event) =>
            onMetadataChange((current) => ({
              ...current,
              correctAnswer: event.target.value,
            }))
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
    <div className="space-y-6 text-sm">
      {isEditing ? (
        form
      ) : (
        <div className="space-y-5">
          <dl className="grid grid-cols-2 gap-3">
            <Detail label="Type" value={question.type.replace("_", " ")} />
            <Detail label="Options" value={String(question.blueprintCheckOptions.length)} />
          </dl>
          <Detail label="Question" value={question.question} />
          <Detail label="Explanation" value={question.explanation || "Not specified."} />
        </div>
      )}
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
