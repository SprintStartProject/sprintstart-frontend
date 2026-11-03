import { useEffect, useRef } from "react";
import type {
  BlueprintGraphNode,
  BlueprintPhase,
  BlueprintQuestion,
  BlueprintStep,
} from "../types.ts";
import type { BlueprintQuestionMetadata, BlueprintStepMetadata } from "./metadata.ts";
import { useMetadataSaving } from "./useMetadataSaving.ts";
import { useNodeDeletion } from "./useNodeDeletion.ts";
import { useNodeSelection } from "./useNodeSelection.ts";
import { useUnsavedGuard } from "./useUnsavedGuard.ts";

type Args = {
  phase: BlueprintPhase;
  nodes: BlueprintGraphNode[];
  /**
   * A node to open as soon as it is there, found by title. By title rather than by id: the one
   * caller is a landing on a freshly opened draft, and a draft is a copy, so every id in it is new
   * while the titles are the ones the author just read.
   */
  openNodeTitle: string | null;
  onOpenedNode?: () => void;
  onUpdateStep: (step: BlueprintStep, metadata: BlueprintStepMetadata) => Promise<void>;
  onUpdateQuestion: (
    question: BlueprintQuestion,
    metadata: BlueprintQuestionMetadata,
  ) => Promise<void>;
  onDeleteStep: (step: BlueprintStep) => Promise<void>;
  onDeleteQuestion: (question: BlueprintQuestion) => Promise<void>;
};

/** Opens a node asked for from somewhere else, once, and tells the asker it did. */
function useOpenByTitle(
  nodes: BlueprintGraphNode[],
  title: string | null,
  open: (node: BlueprintGraphNode) => void,
  onOpened?: () => void,
) {
  // The latest `open`, which reads this render's phase -- the phase its metadata has to come from.
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  });

  // Cleared through the callback, so it opens once rather than every time the phase is reloaded.
  useEffect(() => {
    if (!title) return;
    const match = nodes.find((node) => node.title === title);
    if (!match) return;
    // Deferred to a microtask: React 19's lint rejects a synchronous setState in an effect body.
    queueMicrotask(() => {
      openRef.current(match);
      onOpened?.();
    });
  }, [nodes, onOpened, title]);
}

/** Everything the open node's panel needs: what is open, its fields, saving, deleting, leaving. */
export function useSubGraphDetails({
  phase,
  nodes,
  openNodeTitle,
  onOpenedNode,
  onUpdateStep,
  onUpdateQuestion,
  onDeleteStep,
  onDeleteQuestion,
}: Args) {
  const selection = useNodeSelection(phase, nodes);
  const saving = useMetadataSaving({
    step: selection.step,
    question: selection.question,
    stepMetadata: selection.stepMetadata,
    questionMetadata: selection.questionMetadata,
    onUpdateStep,
    onUpdateQuestion,
  });
  const { clearErrors } = saving;
  const { open } = selection;

  const openNode = (node: BlueprintGraphNode) => {
    clearErrors();
    open(node);
  };
  const guard = useUnsavedGuard(selection, openNode);
  const deletion = useNodeDeletion({
    step: selection.step,
    question: selection.question,
    onDeleteStep,
    onDeleteQuestion,
    onDeleted: selection.forget,
  });
  useOpenByTitle(nodes, openNodeTitle, openNode, onOpenedNode);

  return { selection, saving, guard, deletion, openNode };
}
