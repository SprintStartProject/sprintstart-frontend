import { mapPhase } from "./pathTransforms.ts";
import { withGraphNodes } from "./withGraphNodes.ts";
import type {
  BlueprintGraphNode,
  BlueprintPath,
  BlueprintQuestion,
  BlueprintStep,
} from "./types.ts";

/** What the server reports about a node after it was moved or had an edge changed. */
export type NodeChange = {
  revision: number;
  graphX?: number;
  graphY?: number;
  blockerIds?: string[];
};

/** Where on the canvas a node was created, and the revision it was created at. */
export type Placement = { revision: number; graphX: number; graphY: number };

/**
 * The path with what the server reported about one node written onto it.
 *
 * A step takes every field reported; a question only has its revision kept, because its place and
 * edges live on the graph node, not on the nested question.
 */
export function withNodeChange(
  path: BlueprintPath,
  phaseId: string,
  nodeId: string,
  change: NodeChange,
): BlueprintPath {
  return mapPhase(path, phaseId, (phase) => ({
    ...phase,
    blueprintSteps: phase.blueprintSteps.map((step) =>
      step.id === nodeId ? { ...step, ...change } : step,
    ),
    blueprintCheckQuestions: phase.blueprintCheckQuestions.map((question) =>
      question.id === nodeId ? { ...question, revision: change.revision } : question,
    ),
  }));
}

/** The graph nodes with one node's change written onto it. */
export function withNodeChangeInList(
  nodes: BlueprintGraphNode[],
  nodeId: string,
  change: NodeChange,
): BlueprintGraphNode[] {
  return nodes.map((node) => (node.id === nodeId ? { ...node, ...change } : node));
}

function createdNode(
  item: { id: string; title: string; blueprintPhaseId: string },
  type: "STEP" | "QUESTION",
  place: Placement,
): BlueprintGraphNode {
  return {
    id: item.id,
    revision: place.revision,
    title: item.title,
    type,
    blueprintPhaseId: item.blueprintPhaseId,
    graphX: place.graphX,
    graphY: place.graphY,
    blockerIds: [],
  };
}

/** The thin graph node for a step that was just created on the canvas. */
export function stepNode(step: BlueprintStep, place: Placement): BlueprintGraphNode {
  return createdNode(step, "STEP", place);
}

/** The thin graph node for a question that was just created on the canvas. */
export function questionNode(question: BlueprintQuestion, place: Placement): BlueprintGraphNode {
  return createdNode(question, "QUESTION", place);
}

/** The path with a step that was just created on the canvas added to its phase. */
export function withCreatedStep(
  path: BlueprintPath,
  step: BlueprintStep,
  place: Placement,
): BlueprintPath {
  return mapPhase(path, step.blueprintPhaseId, (phase) => ({
    ...phase,
    blueprintSteps: [...phase.blueprintSteps, { ...step, ...place }],
  }));
}

/** The path with a question that was just created on the canvas added to its phase. */
export function withCreatedQuestion(
  path: BlueprintPath,
  question: BlueprintQuestion,
  place: Placement,
): BlueprintPath {
  return mapPhase(path, question.blueprintPhaseId, (phase) => ({
    ...phase,
    blueprintCheckQuestions: [
      ...phase.blueprintCheckQuestions,
      { ...question, revision: place.revision },
    ],
  }));
}

/**
 * A freshly fetched path with the phase coordinates and prerequisites already held written back.
 *
 * The nested DTO has no phase coordinates or prerequisites; keep the ones already loaded rather
 * than dropping them while the sub-graph editor is open. The revision is the one the server just
 * sent, not the one held here: `withGraphNodes` writes it back onto the phase, so carrying the
 * stale one over meant the next phase mutation sent a revision the server had already moved past
 * -- a 409 the page then reported as a success.
 */
export function keepingHeldGraph(
  held: BlueprintPath | null,
  fetched: BlueprintPath,
): BlueprintPath {
  if (!held) return fetched;
  const heldById = new Map(held.blueprintPhases.map((phase) => [phase.id, phase]));
  return withGraphNodes(
    fetched,
    fetched.blueprintPhases.map((phase): BlueprintGraphNode => {
      const before = heldById.get(phase.id);
      return {
        id: phase.id,
        revision: phase.revision,
        title: phase.title,
        graphX: before?.graphX ?? null,
        graphY: before?.graphY ?? null,
        blockerIds: before?.blockerIds ?? [],
      };
    }),
  );
}
