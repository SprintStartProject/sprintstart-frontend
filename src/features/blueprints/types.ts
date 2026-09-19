/** API models for the editable onboarding blueprint authoring surface. */
export type BlueprintStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
export type BlueprintPhaseType = "FIXED" | "AI_ENHANCED";
export type BlueprintStepType = "VIDEO" | "DOCUMENT" | "TASK";
export type BlueprintQuestionType = "MULTIPLE_CHOICE" | "SHORT_TEXT";
export type BlueprintRequirementType = "SKILL" | "PROJECT_ROLE";

/** A skill or project-role gate that must be met before a phase can start. */
export interface BlueprintPhaseRequirement {
  id: string;
  blueprintPhaseId: string;
  referenceId: string;
  type: BlueprintRequirementType;
  displayName: string;
}

export interface BlueprintOption {
  id: string;
  blueprintCheckQuestionId: string;
  revision: number;
  position: number;
  label: string;
  correct: boolean;
}

export interface BlueprintQuestion {
  id: string;
  blueprintPhaseId: string;
  revision: number;
  title: string;
  position: number;
  type: BlueprintQuestionType;
  question: string;
  explanation: string | null;
  correctAnswer: string | null;
  blueprintCheckOptions: BlueprintOption[];
}

/** A lightweight node returned by either the path graph or a phase subgraph endpoint. */
export interface BlueprintGraphNode {
  id: string;
  revision: number;
  title: string;
  graphX: number | null;
  graphY: number | null;
  blockerIds: string[];
  type?: "PHASE" | "STEP" | "QUESTION";
  blueprintPathId?: string;
  blueprintPhaseId?: string;
}

export interface BlueprintGraph {
  nodes: BlueprintGraphNode[];
}

export interface BlueprintResource {
  id: string;
  blueprintStepId: string;
  revision: number;
  title: string;
  description: string;
  url: string;
}

export interface BlueprintTask {
  id: string;
  blueprintStepId: string;
  revision: number;
  position: number;
  title: string;
  description: string;
}

export interface BlueprintStep {
  id: string;
  blueprintPhaseId: string;
  revision: number;
  position: number;
  title: string;
  description: string;
  type: BlueprintStepType;
  aiAssisted: boolean;
  estimatedMinutes: number;
  expectedOutcome: string;
  /** IDs of steps that must be completed before this step can start. */
  blockerIds: string[];
  /** Persisted canvas coordinates; null means the step is still in the library. */
  graphX: number | null;
  graphY: number | null;
  blueprintTasks: BlueprintTask[];
  blueprintResources: BlueprintResource[];
}

export interface BlueprintPhase {
  id: string;
  blueprintPathId: string;
  revision: number;
  position: number;
  title: string;
  description: string | null;
  aiPrompt: string | null;
  type: BlueprintPhaseType;
  /** IDs of phases that must be completed before this phase can start. */
  blockerIds: string[];
  /** Persisted path-graph coordinates; null means the phase is still in the library. */
  graphX: number | null;
  graphY: number | null;
  /** Omitted by older API responses; treated as an empty list by the authoring UI. */
  requirements?: BlueprintPhaseRequirement[];
  blueprintSteps: BlueprintStep[];
  blueprintCheckQuestions: BlueprintQuestion[];
}

export interface BlueprintPathOverview {
  id: string;
  blueprintKey: string;
  version: number;
  revision: number;
  title: string;
  description: string | null;
  status: BlueprintStatus;
}

export interface BlueprintPath extends BlueprintPathOverview {
  blueprintPhases: BlueprintPhase[];
}
