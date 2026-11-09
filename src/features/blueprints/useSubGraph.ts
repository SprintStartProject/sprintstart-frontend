import { useState } from "react";
import { blueprintService, type BlueprintScope } from "../../services/blueprintService.ts";
import {
  keepingHeldGraph,
  questionNode,
  stepNode,
  withCreatedQuestion,
  withCreatedStep,
  withNodeChange,
  withNodeChangeInList,
  type NodeChange,
  type Placement,
} from "./graphPathUpdates.ts";
import type { PathPageContext } from "./pathPageContext.ts";
import type {
  BlueprintGraphNode,
  BlueprintPhase,
  BlueprintQuestion,
  BlueprintStep,
} from "./types.ts";
import type {
  BlueprintQuestionMetadata,
  BlueprintStepMetadata,
} from "./components/BlueprintSubGraphEditor.tsx";

/** The fixed phase whose own graph is open, and the thin nodes it is drawn from. */
export function useSubGraphState(context: PathPageContext) {
  const { scope, pathId } = context;
  const [phaseId, setPhaseId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<BlueprintGraphNode[]>([]);

  async function open(phase: BlueprintPhase) {
    if (phase.type === "AI_ENHANCED") return;
    context.setPageError(null);
    try {
      const graph = await blueprintService.getSubGraph(scope, phase.id);
      setNodes(graph.nodes);
      setPhaseId(phase.id);
    } catch (reason) {
      context.setPageError(
        reason instanceof Error ? reason.message : "Phase graph could not be loaded.",
      );
    }
  }

  function clear() {
    setPhaseId(null);
    setNodes([]);
  }

  /** Refreshes both views so graph-node revisions stay aligned with the detailed authoring DTO. */
  async function refresh(forPhaseId: string | null | undefined) {
    if (!pathId || !forPhaseId) return;
    const [nextPath, graph] = await Promise.all([
      blueprintService.getPath(scope, pathId),
      blueprintService.getSubGraph(scope, forPhaseId),
    ]);
    context.setPath((current) => keepingHeldGraph(current, nextPath));
    setNodes(graph.nodes);
  }

  return { phaseId, nodes, setNodes, setPhaseId, open, clear, refresh };
}

export type SubGraphState = ReturnType<typeof useSubGraphState>;

/** Moving a node, changing its prerequisites and adding nodes, all without reloading the phase. */
export function useSubGraphNodeEdits(context: PathPageContext, sub: SubGraphState) {
  const { scope } = context;

  /** Writes what the server reported onto the node, and onto the step or question it stands for. */
  function applyChange(node: BlueprintGraphNode, change: NodeChange) {
    const phaseId = node.blueprintPhaseId ?? sub.phaseId;
    sub.setNodes((current) => withNodeChangeInList(current, node.id, change));
    if (!phaseId) return;
    context.setPath((current) =>
      current ? withNodeChange(current, phaseId, node.id, change) : current,
    );
  }

  async function savePosition(node: BlueprintGraphNode, graphX: number, graphY: number) {
    sub.setNodes((current) =>
      current.map((item) => (item.id === node.id ? { ...item, graphX, graphY } : item)),
    );
    try {
      const response = await blueprintService.updateSubGraphNodePosition(scope, node.id, {
        revision: node.revision,
        graphX,
        graphY,
      });
      applyChange(node, response);
    } catch (reason) {
      sub.setNodes((current) =>
        current.map((item) =>
          item.id === node.id ? { ...item, graphX: node.graphX, graphY: node.graphY } : item,
        ),
      );
      throw reason;
    }
  }

  async function addBlocker(node: BlueprintGraphNode, blockerId: string) {
    const response = await blueprintService.addSubGraphNodeBlocker(
      scope,
      node.id,
      blockerId,
      node.revision,
    );
    applyChange(node, response);
  }

  async function removeBlocker(node: BlueprintGraphNode, blockerId: string) {
    const response = await blueprintService.removeSubGraphNodeBlocker(
      scope,
      node.id,
      blockerId,
      node.revision,
    );
    applyChange(node, response);
  }

  /** Adds a newly created canvas step to both its detailed phase and the thin graph state. */
  function appendStep(step: BlueprintStep, place: Placement) {
    sub.setNodes((current) => [...current, stepNode(step, place)]);
    context.setPath((current) => (current ? withCreatedStep(current, step, place) : current));
  }

  /** Adds a newly created canvas knowledge check to both its detailed phase and thin graph state. */
  function appendQuestion(question: BlueprintQuestion, place: Placement) {
    sub.setNodes((current) => [...current, questionNode(question, place)]);
    context.setPath((current) =>
      current ? withCreatedQuestion(current, question, place) : current,
    );
  }

  return { savePosition, addBlocker, removeBlocker, appendStep, appendQuestion };
}

/** Changing a question or step from the phase graph's side panel, then refreshing the phase. */
export function useSubGraphContentEdits(context: PathPageContext, sub: SubGraphState) {
  const scope: BlueprintScope = context.scope;

  async function updateQuestion(question: BlueprintQuestion, metadata: BlueprintQuestionMetadata) {
    await blueprintService.updateQuestion(scope, question.id, {
      revision: question.revision,
      position: question.position,
      ...metadata,
    });
    await sub.refresh(question.blueprintPhaseId);
  }

  async function addOption(question: BlueprintQuestion, label: string, correct: boolean) {
    await blueprintService.createOption(scope, question.id, {
      position: question.blueprintCheckOptions.length,
      label,
      correct,
    });
    await sub.refresh(question.blueprintPhaseId);
  }

  async function updateStep(step: BlueprintStep, metadata: BlueprintStepMetadata) {
    await blueprintService.updateStep(scope, step.id, {
      revision: step.revision,
      position: step.position,
      ...metadata,
    });
    await sub.refresh(step.blueprintPhaseId);
  }

  return { updateQuestion, addOption, updateStep };
}
