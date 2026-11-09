import { ArrowLeft } from "lucide-react";
import { Button } from "../../../components/ui/Button.tsx";
import { BlueprintGraphCanvas } from "./BlueprintGraphCanvas.tsx";
import { NodeDetailFooter } from "../subgraph/NodeDetailFooter.tsx";
import { DeleteNodeDialog, DiscardChangesDialog } from "../subgraph/SubGraphDialogs.tsx";
import { SubGraphNodeCard } from "../subgraph/SubGraphNodeCard.tsx";
import { SubGraphNodeDetails } from "../subgraph/SubGraphNodeDetails.tsx";
import { useSubGraphDetails } from "../subgraph/useSubGraphDetails.ts";
import type { BlueprintQuestionMetadata, BlueprintStepMetadata } from "../subgraph/metadata.ts";
import type {
  BlueprintGraphNode,
  BlueprintOption,
  BlueprintPhase,
  BlueprintQuestion,
  BlueprintStep,
} from "../../../services/blueprintTypes.ts";

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
  onUpdateStep,
  ...actions
}: Props) {
  const { selection, saving, guard, deletion, openNode } = useSubGraphDetails({
    phase,
    nodes,
    openNodeTitle,
    onOpenedNode,
    onUpdateStep,
    onUpdateQuestion,
    onDeleteStep,
    onDeleteQuestion,
  });
  const { step, question } = selection;
  const hasEntity = step !== null || question !== null;
  const hasFooter = (hasEntity && editable) || onRequestDraft !== undefined;
  const fields = {
    stepMetadata: selection.stepMetadata,
    stepSaveError: saving.stepError,
    onStepMetadataChange: selection.setStepMetadata,
    onStepSubmit: saving.saveStep,
    questionMetadata: selection.questionMetadata,
    questionSaveError: saving.questionError,
    onQuestionMetadataChange: selection.setQuestionMetadata,
    onQuestionSubmit: saving.saveQuestion,
  };

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
        onNodeClick={openNode}
        onPositionChange={onPositionChange}
        onAddBlocker={onAddBlocker}
        onRemoveBlocker={onRemoveBlocker}
        onCreateNode={(kindId, graphX, graphY) =>
          onCreateNode(kindId === "question" ? "question" : "step", graphX, graphY)
        }
        renderNode={(node, graphNodeProps) => <SubGraphNodeCard node={node} {...graphNodeProps} />}
        openNodeId={selection.isOpen ? selection.nodeId : null}
        onNavigateNodeDetail={guard.goTo}
        onCloseNodeDetail={guard.requestClose}
        renderNodeDetail={(node) => ({
          title: node.title,
          body: (
            <SubGraphNodeDetails
              node={node}
              phase={phase}
              editable={editable}
              fields={fields}
              actions={actions}
            />
          ),
          footer: hasFooter ? (
            <NodeDetailFooter
              node={node}
              isStep={step !== null}
              hasEntity={hasEntity}
              editable={editable}
              dirty={selection.dirty}
              saving={step ? saving.isStepSaving : saving.isQuestionSaving}
              onDelete={deletion.ask}
              onDiscard={selection.revert}
              onRequestDraft={onRequestDraft}
            />
          ) : undefined,
        })}
      />
      <DeleteNodeDialog step={step} question={question} deletion={deletion} />
      <DiscardChangesDialog isStep={step !== null} guard={guard} />
    </>
  );
}
