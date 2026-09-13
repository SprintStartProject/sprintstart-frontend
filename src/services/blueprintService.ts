import { apiClient } from "./apiClient.ts";
import type {
  BlueprintPath,
  BlueprintPathOverview,
  BlueprintGraph,
  BlueprintQuestion,
  BlueprintStep,
  BlueprintPhase,
  BlueprintPhaseRequirement,
  BlueprintPhaseType,
  BlueprintQuestionType,
  BlueprintRequirementType,
  BlueprintStepType,
} from "../features/blueprints/types.ts";

type PathInput = { title: string; description: string };
type OrderedContentInput = {
  position: number;
  title: string;
  description: string | null;
};
type PhaseInput = OrderedContentInput & {
  aiPrompt: string | null;
  type: BlueprintPhaseType;
  graphX?: number;
  graphY?: number;
};
type StepInput = OrderedContentInput & {
  type: BlueprintStepType;
  estimatedMinutes: number;
  expectedOutcome: string;
  graphX?: number;
  graphY?: number;
};
type TaskInput = OrderedContentInput;
type ResourceInput = { title: string; description: string; url: string };
type QuestionInput = {
  position: number;
  title: string;
  type: BlueprintQuestionType;
  question: string;
  explanation: string | null;
  correctAnswer: string | null;
  graphX?: number;
  graphY?: number;
};
type OptionInput = { position: number; label: string; correct: boolean };
type TaskUpdateInput = TaskInput & { revision: number };
type OptionUpdateInput = OptionInput & { revision: number };
type ResourceUpdateInput = ResourceInput & { revision: number };
export type PositionUpdate = { id: string; revision: number; position: number };
type GraphPositionUpdate = { revision: number; graphX: number; graphY: number };
type BlockerUpdate = { revision: number; blockerIds: string[] };
type NodeRevisionUpdate = { id: string; revision: number };
type GraphNodePositionRemoval = { changedNodes: NodeRevisionUpdate[] };
type SubGraphNodePositionRemoval = { updatedNodes: NodeRevisionUpdate[] };
type PhaseDeletion = { updatedPhases: NodeRevisionUpdate[] };
type StepDeletion = { updatedSteps: NodeRevisionUpdate[] };
type QuestionDeletion = { updatedQuestions: NodeRevisionUpdate[] };
type RequirementInput = { referenceId: string; type: BlueprintRequirementType };
type RequirementResponse = {
  revision: number;
  requirements: BlueprintPhaseRequirement[];
};
export type BlueprintRequirementCatalogItem = { id: string; name: string };
export type BlueprintScope = { kind: "project"; projectId: string } | { kind: "global" };

/** Backend phase reads name the requirement collection differently from the authoring UI. */
type BackendBlueprintPath = Omit<BlueprintPath, "blueprintPhases"> & {
  blueprintPhases: Array<
    Omit<BlueprintPhase, "requirements" | "blockerIds" | "graphX" | "graphY"> & {
      blueprintPhaseRequirements?: BlueprintPhaseRequirement[];
      blockerIds?: string[];
      graphX?: number | null;
      graphY?: number | null;
    }
  >;
};

function toBlueprintPhase(phase: BackendBlueprintPath["blueprintPhases"][number]): BlueprintPhase {
  return {
    ...phase,
    requirements: phase.blueprintPhaseRequirements ?? [],
    blockerIds: phase.blockerIds ?? [],
    graphX: phase.graphX ?? null,
    graphY: phase.graphY ?? null,
  };
}

function toBlueprintPath(path: BackendBlueprintPath): BlueprintPath {
  return {
    ...path,
    blueprintPhases: path.blueprintPhases.map(toBlueprintPhase),
  };
}

function blueprintBase(scope: BlueprintScope) {
  return scope.kind === "global"
    ? "/api/v1/onboarding/blueprints"
    : `/api/v1/projects/${encodeURIComponent(scope.projectId)}/onboarding/blueprints`;
}

/** Communicates with the Blueprint authoring endpoints, which are separate from live onboarding paths. */
export const blueprintService = {
  /** Lists the latest Blueprint path for every Blueprint key. */
  getPaths: (scope: BlueprintScope) =>
    apiClient.fetch<BlueprintPathOverview[]>(blueprintBase(scope)),
  /** Loads a full Blueprint path and all its nested authoring content. */
  getPath: (scope: BlueprintScope, pathId: string) =>
    apiClient
      .fetch<BackendBlueprintPath>(`${blueprintBase(scope)}/paths/${pathId}`)
      .then(toBlueprintPath),
  /** Loads the lightweight phase nodes used by a path's top-level graph. */
  getGraph: (scope: BlueprintScope, pathId: string) =>
    apiClient.fetch<BlueprintGraph>(`${blueprintBase(scope)}/paths/${pathId}/graph`),
  /** Loads the lightweight step and question nodes belonging to one phase graph. */
  getSubGraph: (scope: BlueprintScope, phaseId: string) =>
    apiClient.fetch<BlueprintGraph>(`${blueprintBase(scope)}/phase/${phaseId}/graph`),
  /** Loads one phase and its authoring details on demand. */
  getPhase: (scope: BlueprintScope, phaseId: string) =>
    apiClient
      .fetch<BackendBlueprintPath["blueprintPhases"][number]>(
        `${blueprintBase(scope)}/phases/${phaseId}`,
      )
      .then(toBlueprintPhase),
  /** Loads one step and its authoring details on demand. */
  getStep: (scope: BlueprintScope, stepId: string) =>
    apiClient.fetch<BlueprintStep>(`${blueprintBase(scope)}/steps/${stepId}`),
  /** Loads one knowledge-check question and its options on demand. */
  getQuestion: (scope: BlueprintScope, questionId: string) =>
    apiClient.fetch<BlueprintQuestion>(`${blueprintBase(scope)}/checks/questions/${questionId}`),
  /** Lists all versions belonging to one stable Blueprint key. */
  getHistory: (scope: BlueprintScope, blueprintKey: string) =>
    apiClient
      .fetch<BackendBlueprintPath[]>(`${blueprintBase(scope)}/${blueprintKey}`)
      .then((paths) => paths.map(toBlueprintPath)),
  /** Starts a new Blueprint path in draft state. */
  createPath: (scope: BlueprintScope, input: PathInput) =>
    apiClient
      .fetch<BackendBlueprintPath>(`${blueprintBase(scope)}/paths`, {
        method: "POST",
        body: JSON.stringify(input),
      })
      .then(toBlueprintPath),
  /** Opens a separately editable draft from a published Blueprint path. */
  openDraft: (scope: BlueprintScope, blueprintKey: string) =>
    apiClient
      .fetch<BackendBlueprintPath>(`${blueprintBase(scope)}/${blueprintKey}/draft`, {
        method: "POST",
      })
      .then(toBlueprintPath),
  /** Publishes the selected Blueprint draft. */
  publishPath: (scope: BlueprintScope, pathId: string) =>
    apiClient
      .fetch<BackendBlueprintPath>(`${blueprintBase(scope)}/paths/${pathId}/publish`, {
        method: "POST",
      })
      .then(toBlueprintPath),
  /** Archives the active path and discards any unpublished draft for its blueprint. */
  archivePath: (scope: BlueprintScope, blueprintKey: string) =>
    apiClient.fetch<void>(`${blueprintBase(scope)}/${blueprintKey}/archive`, {
      method: "POST",
    }),
  /** Permanently deletes an unpublished Blueprint draft. */
  deleteDraft: (scope: BlueprintScope, pathId: string) =>
    apiClient.fetch<void>(`${blueprintBase(scope)}/paths/${pathId}`, {
      method: "DELETE",
    }),
  /** Restores an archived version as the active Blueprint path. */
  rollbackPath: (scope: BlueprintScope, blueprintKey: string, version: number) =>
    apiClient
      .fetch<BackendBlueprintPath>(`${blueprintBase(scope)}/${blueprintKey}/rollBack/${version}`, {
        method: "POST",
      })
      .then(toBlueprintPath),
  /** Adds a phase to a Blueprint path. */
  createPhase: (scope: BlueprintScope, pathId: string, input: PhaseInput) =>
    apiClient
      .fetch<BackendBlueprintPath["blueprintPhases"][number]>(
        `${blueprintBase(scope)}/path/${pathId}/phases`,
        {
          method: "POST",
          body: JSON.stringify(input),
        },
      )
      .then(toBlueprintPhase),
  updatePhase: (scope: BlueprintScope, phaseId: string, input: PhaseInput & { revision: number }) =>
    apiClient.fetch(`${blueprintBase(scope)}/phases/${phaseId}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  updatePhasePosition: (
    scope: BlueprintScope,
    phaseId: string,
    input: { revision: number; position: number },
  ) =>
    apiClient.fetch<PositionUpdate[]>(`${blueprintBase(scope)}/phases/${phaseId}/position`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  /** Deletes a phase and its nested Blueprint content. */
  deletePhase: (scope: BlueprintScope, phaseId: string, revision: number) =>
    apiClient.fetch<PhaseDeletion>(`${blueprintBase(scope)}/phases/${phaseId}`, {
      method: "DELETE",
      body: JSON.stringify({ revision }),
    }),
  /** Loads the skills and project roles that authors can use as phase requirements. */
  getRequirementCatalog: async (): Promise<{
    skills: BlueprintRequirementCatalogItem[];
    projectRoles: BlueprintRequirementCatalogItem[];
  }> => {
    const [skills, projectRoles] = await Promise.all([
      apiClient.fetch<BlueprintRequirementCatalogItem[]>("/api/v1/skills"),
      apiClient.fetch<BlueprintRequirementCatalogItem[]>("/api/v1/projectRoles"),
    ]);

    return { skills, projectRoles };
  },
  /** Adds one or more skill/project-role requirements to a phase. */
  addPhaseRequirements: (
    scope: BlueprintScope,
    phaseId: string,
    revision: number,
    requirements: RequirementInput[],
  ) =>
    apiClient.fetch<RequirementResponse>(`${blueprintBase(scope)}/phases/${phaseId}/requirements`, {
      method: "POST",
      body: JSON.stringify({ revision, requirements }),
    }),
  /** Removes one or more existing requirements from a phase. */
  deletePhaseRequirements: (
    scope: BlueprintScope,
    phaseId: string,
    revision: number,
    requirementIds: string[],
  ) =>
    apiClient.fetch<{ revision: number }>(
      `${blueprintBase(scope)}/phases/${phaseId}/requirements`,
      {
        method: "DELETE",
        body: JSON.stringify({ revision, requirementIds }),
      },
    ),
  /** Adds a step to a Blueprint phase. */
  createStep: (scope: BlueprintScope, phaseId: string, input: StepInput) =>
    apiClient.fetch<BlueprintStep>(`${blueprintBase(scope)}/phases/${phaseId}/steps`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateStep: (
    scope: BlueprintScope,
    stepId: string,
    input: StepInput & { revision: number; aiAssisted: boolean },
  ) =>
    apiClient.fetch(`${blueprintBase(scope)}/steps/${stepId}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  /** Deletes a Blueprint step and its nested task/resource content. */
  deleteStep: (scope: BlueprintScope, stepId: string, revision: number) =>
    apiClient.fetch<StepDeletion>(`${blueprintBase(scope)}/steps/${stepId}`, {
      method: "DELETE",
      body: JSON.stringify({ revision }),
    }),
  updateStepPosition: (
    scope: BlueprintScope,
    stepId: string,
    input: { revision: number; position: number },
  ) =>
    apiClient.fetch<PositionUpdate[]>(`${blueprintBase(scope)}/steps/${stepId}/position`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  /** Stores a step's graph-canvas coordinates. */
  updateStepGraphPosition: (scope: BlueprintScope, stepId: string, input: GraphPositionUpdate) =>
    apiClient.fetch<GraphPositionUpdate>(`${blueprintBase(scope)}/steps/${stepId}/graph-position`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  /** Removes a step from the graph canvas while preserving the step in its phase. */
  removeStepGraphPosition: (scope: BlueprintScope, stepId: string, revision: number) =>
    apiClient.fetch<{ revision: number }>(
      `${blueprintBase(scope)}/steps/${stepId}/graph-position`,
      {
        method: "DELETE",
        body: JSON.stringify({ revision }),
      },
    ),
  /** Stores a phase's top-level graph-canvas coordinates. */
  updateGraphNodePosition: (scope: BlueprintScope, nodeId: string, input: GraphPositionUpdate) =>
    apiClient.fetch<GraphPositionUpdate>(
      `${blueprintBase(scope).replace("/blueprints", "")}/blueprint/graph-nodes/${nodeId}/position`,
      { method: "PUT", body: JSON.stringify(input) },
    ),
  /** Removes a phase from the path graph without deleting the phase itself. */
  removeGraphNodePosition: (scope: BlueprintScope, nodeId: string, revision: number) =>
    apiClient.fetch<GraphNodePositionRemoval>(
      `${blueprintBase(scope).replace("/blueprints", "")}/blueprint/graph-nodes/${nodeId}/position`,
      { method: "DELETE", body: JSON.stringify({ revision }) },
    ),
  /** Creates a prerequisite edge between two phases in the path graph. */
  addGraphNodeBlocker: (
    scope: BlueprintScope,
    nodeId: string,
    blockerId: string,
    revision: number,
  ) =>
    apiClient.fetch<BlockerUpdate>(
      `${blueprintBase(scope).replace("/blueprints", "")}/blueprint/graph-nodes/${nodeId}/blockers/${blockerId}`,
      { method: "POST", body: JSON.stringify({ revision }) },
    ),
  /** Removes a prerequisite edge between two phases in the path graph. */
  removeGraphNodeBlocker: (
    scope: BlueprintScope,
    nodeId: string,
    blockerId: string,
    revision: number,
  ) =>
    apiClient.fetch<BlockerUpdate>(
      `${blueprintBase(scope).replace("/blueprints", "")}/blueprint/graph-nodes/${nodeId}/blockers/${blockerId}`,
      { method: "DELETE", body: JSON.stringify({ revision }) },
    ),
  /** Stores a step or question node position in its phase subgraph. */
  updateSubGraphNodePosition: (scope: BlueprintScope, nodeId: string, input: GraphPositionUpdate) =>
    apiClient.fetch<GraphPositionUpdate>(
      `${blueprintBase(scope)}/sub-graph-nodes/${nodeId}/position`,
      { method: "PUT", body: JSON.stringify(input) },
    ),
  /** Removes a step or question node from its phase subgraph. */
  removeSubGraphNodePosition: (scope: BlueprintScope, nodeId: string, revision: number) =>
    apiClient.fetch<SubGraphNodePositionRemoval>(
      `${blueprintBase(scope)}/sub-graph-nodes/${nodeId}/position`,
      {
        method: "DELETE",
        body: JSON.stringify({ revision }),
      },
    ),
  /** Creates a prerequisite edge inside a phase subgraph. */
  addSubGraphNodeBlocker: (
    scope: BlueprintScope,
    nodeId: string,
    blockerId: string,
    revision: number,
  ) =>
    apiClient.fetch<BlockerUpdate>(
      `${blueprintBase(scope)}/sub-graph-nodes/${nodeId}/blockers/${blockerId}`,
      { method: "POST", body: JSON.stringify({ revision }) },
    ),
  /** Removes a prerequisite edge inside a phase subgraph. */
  removeSubGraphNodeBlocker: (
    scope: BlueprintScope,
    nodeId: string,
    blockerId: string,
    revision: number,
  ) =>
    apiClient.fetch<BlockerUpdate>(
      `${blueprintBase(scope)}/sub-graph-nodes/${nodeId}/blockers/${blockerId}`,
      { method: "DELETE", body: JSON.stringify({ revision }) },
    ),
  /** Adds a prerequisite edge: the step cannot start until blockerId is complete. */
  addStepBlocker: (scope: BlueprintScope, stepId: string, blockerId: string, revision: number) =>
    apiClient.fetch<BlockerUpdate>(
      `${blueprintBase(scope)}/steps/${stepId}/blockers/${blockerId}`,
      {
        method: "POST",
        body: JSON.stringify({ revision }),
      },
    ),
  /** Removes a prerequisite edge from a step. */
  removeStepBlocker: (scope: BlueprintScope, stepId: string, blockerId: string, revision: number) =>
    apiClient.fetch<BlockerUpdate>(`${blueprintBase(scope)}/steps/${stepId}/blocker/${blockerId}`, {
      method: "DELETE",
      body: JSON.stringify({ revision }),
    }),
  /** Adds a task to a Blueprint step. */
  createTask: (scope: BlueprintScope, stepId: string, input: TaskInput) =>
    apiClient.fetch(`${blueprintBase(scope)}/steps/${stepId}/task`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  /** Deletes a task from a Blueprint step. */
  deleteTask: (scope: BlueprintScope, taskId: string, revision: number) =>
    apiClient.fetch<void>(`${blueprintBase(scope)}/tasks/${taskId}`, {
      method: "DELETE",
      body: JSON.stringify({ revision }),
    }),
  /** Updates a task without replacing its identity or ordering. */
  updateTask: (scope: BlueprintScope, taskId: string, input: TaskUpdateInput) =>
    apiClient.fetch(`${blueprintBase(scope)}/tasks/${taskId}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  updateTaskPosition: (
    scope: BlueprintScope,
    taskId: string,
    input: { revision: number; position: number },
  ) =>
    apiClient.fetch<PositionUpdate[]>(`${blueprintBase(scope)}/tasks/${taskId}/position`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  /** Adds a reference resource to a Blueprint step. */
  createResource: (scope: BlueprintScope, stepId: string, input: ResourceInput) =>
    apiClient.fetch(`${blueprintBase(scope)}/step/${stepId}/resources`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  /** Deletes a reference resource from a Blueprint step. */
  deleteResource: (scope: BlueprintScope, resourceId: string, revision: number) =>
    apiClient.fetch<void>(`${blueprintBase(scope)}/resources/${resourceId}`, {
      method: "DELETE",
      body: JSON.stringify({ revision }),
    }),
  /** Updates a reference resource without replacing its identity. */
  updateResource: (scope: BlueprintScope, resourceId: string, input: ResourceUpdateInput) =>
    apiClient.fetch(`${blueprintBase(scope)}/resources/${resourceId}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  /** Adds a knowledge-check question to a Blueprint phase. */
  createQuestion: (scope: BlueprintScope, phaseId: string, input: QuestionInput) =>
    apiClient.fetch<BlueprintQuestion>(
      `${blueprintBase(scope)}/phase/${phaseId}/checks/questions`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    ),
  updateQuestion: (
    scope: BlueprintScope,
    questionId: string,
    input: QuestionInput & { revision: number },
  ) =>
    apiClient.fetch(`${blueprintBase(scope)}/checks/question/${questionId}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  /** Deletes a Blueprint knowledge-check question and its answer options. */
  deleteQuestion: (scope: BlueprintScope, questionId: string, revision: number) =>
    apiClient.fetch<QuestionDeletion>(`${blueprintBase(scope)}/checks/question/${questionId}`, {
      method: "DELETE",
      body: JSON.stringify({ revision }),
    }),
  updateQuestionPosition: (
    scope: BlueprintScope,
    questionId: string,
    input: { revision: number; position: number },
  ) =>
    apiClient.fetch<PositionUpdate[]>(
      `${blueprintBase(scope)}/checks/question/${questionId}/position`,
      {
        method: "PUT",
        body: JSON.stringify(input),
      },
    ),
  /** Adds an answer option to a multiple-choice Blueprint question. */
  createOption: (scope: BlueprintScope, questionId: string, input: OptionInput) =>
    apiClient.fetch(`${blueprintBase(scope)}/checks/questions/${questionId}/options`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  /** Deletes an answer option from a Blueprint knowledge-check question. */
  deleteOption: (scope: BlueprintScope, optionId: string, revision: number) =>
    apiClient.fetch<void>(`${blueprintBase(scope)}/checks/options/${optionId}`, {
      method: "DELETE",
      body: JSON.stringify({ revision }),
    }),
  /** Updates an answer option without replacing its identity or ordering. */
  updateOption: (scope: BlueprintScope, optionId: string, input: OptionUpdateInput) =>
    apiClient.fetch(`${blueprintBase(scope)}/checks/options/${optionId}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  updateOptionPosition: (
    scope: BlueprintScope,
    optionId: string,
    input: { revision: number; position: number },
  ) =>
    apiClient.fetch<PositionUpdate[]>(
      `${blueprintBase(scope)}/checks/options/${optionId}/position`,
      {
        method: "PUT",
        body: JSON.stringify(input),
      },
    ),
};
