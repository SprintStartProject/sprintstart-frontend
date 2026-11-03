import { useMemo, useState } from "react";
import type { BlueprintGraphNode, BlueprintPhase } from "../types.ts";
import {
  EMPTY_QUESTION_METADATA,
  EMPTY_STEP_METADATA,
  isQuestionChanged,
  isStepChanged,
  questionMetadataOf,
  stepMetadataOf,
} from "./metadata.ts";

/**
 * Which node's details are open, and the fields being edited in them.
 *
 * Opening a node loads its stored values into the fields; "dirty" is those fields differing from
 * what is stored, which is what leaving the node has to ask about.
 */
export function useNodeSelection(phase: BlueprintPhase, nodes: BlueprintGraphNode[]) {
  const [nodeId, setNodeId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [stepMetadata, setStepMetadata] = useState(EMPTY_STEP_METADATA);
  const [questionMetadata, setQuestionMetadata] = useState(EMPTY_QUESTION_METADATA);
  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

  const node = nodeId ? nodeById.get(nodeId) : null;
  const question = node
    ? (phase.blueprintCheckQuestions.find((item) => item.id === node.id) ?? null)
    : null;
  const step = node ? (phase.blueprintSteps.find((item) => item.id === node.id) ?? null) : null;
  const dirty = isStepChanged(step, stepMetadata) || isQuestionChanged(question, questionMetadata);

  function open(target: BlueprintGraphNode) {
    setNodeId(target.id);
    const targetStep = phase.blueprintSteps.find((item) => item.id === target.id);
    if (targetStep) setStepMetadata(stepMetadataOf(targetStep));
    const targetQuestion = phase.blueprintCheckQuestions.find((item) => item.id === target.id);
    if (targetQuestion) setQuestionMetadata(questionMetadataOf(targetQuestion));
    setIsOpen(true);
  }

  return {
    nodeById,
    nodeId,
    isOpen,
    step,
    question,
    stepMetadata,
    questionMetadata,
    dirty,
    setStepMetadata,
    setQuestionMetadata,
    open,
    /** Hides the panel but remembers the node. */
    hide: () => setIsOpen(false),
    /** Hides the panel and forgets the node, as after it was deleted. */
    forget: () => {
      setIsOpen(false);
      setNodeId(null);
    },
    /** Puts the fields back to what is stored. */
    revert: () => {
      if (step) setStepMetadata(stepMetadataOf(step));
      if (question) setQuestionMetadata(questionMetadataOf(question));
    },
  };
}

export type NodeSelection = ReturnType<typeof useNodeSelection>;
