/**
 * Shared backend types for the onboarding module.
 *
 * These interfaces describe the shapes returned by the onboarding API
 * and make the page and detail views type-safe.
 */
// ============================================================
// types/onboarding.ts
// ============================================================
// Alle Interfaces für den Onboarding-Bereich.
// ============================================================



// ============================================================
//  Backend
// ============================================================


// ─── Onboarding Path List (GET /onboarding/paths) ───────────────────────────

/**
 * Metadata for a user's onboarding path summary.
 *
 * Used by list endpoints when showing an overview of available onboarding
 * journeys and completion progress.
 */
export interface OnboardingPathSummaryEndpoint {
  id: string;
  userId: string;
  createdAt: string;
  phaseCount: number;
  stepCount: number;
  finishedStepCount: number;
}

// ─── Full Path (GET /onboarding/{userId}/path) ───────────────────────────────

/**
 * Available states for an onboarding step.
 */
export type StepStatus = "WAITING" | "IN_PROGRESS" | "FINISHED" | "SKIPPED";

/**
 * Supported content types for an onboarding step.
 */
export type StepType = "VIDEO" | "DOCUMENT" | "TASK" | "LINK";

/**
 * Represents a single step within an onboarding phase.
 *
 * This is the lightweight step format used for phase overviews.
 */
export interface OnboardingStepEndpoint {
  id: string;
  phaseId: string;
  position: number;
  title: string;
  description: string;
  type: StepType;
  estimatedMinutes: number;
  status: StepStatus;
  completedAt: string | null;
  skipReason: string | null;
}

/**
 * A single onboarding phase containing multiple steps.
 */
export interface OnboardingPhaseEndpoint {
  id: string;
  pathId: string;
  position: number;
  title: string;
  description: string;
  steps: OnboardingStepEndpoint[];
}

/**
 * Full onboarding path returned for a specific user.
 */
export interface OnboardingPathEndpoint {
  id: string;
  userId: string;
  createdAt: string;
  phases: OnboardingPhaseEndpoint[];
}

// ─── Step Detail (GET /onboarding/steps/{stepId}) ────────────────────────────

/**
 * Represents a single task inside a detailed onboarding step.
 */
export interface OnboardingTaskEndpoint {
  id: string;
  stepId: string;
  position: number;
  title: string;
  description: string;
  finished: boolean;
}

/**
 * External learning resources or references attached to a step.
 */
export interface OnboardingResourceEndpoint {
  id: string;
  stepId: string;
  title: string;
  description: string;
  url: string;
}

/**
 * Detailed payload for a single onboarding step.
 *
 * Includes task and resource lists used by the step detail page.
 */
export interface OnboardingStepDetail extends OnboardingStepEndpoint {
  expectedOutcome?: string;
  tasks: OnboardingTaskEndpoint[];
  resources: OnboardingResourceEndpoint[];
}