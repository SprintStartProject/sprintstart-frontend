// ============================================================
// types/onboarding.ts
// ============================================================
// Alle Interfaces für den Onboarding-Bereich.
// ============================================================



// ============================================================
//  Backend
// ============================================================


// ─── Onboarding Path List (GET /onboarding/paths) ───────────────────────────

export interface OnboardingPathSummaryEndpoint {
  id: string;
  userId: string;
  createdAt: string;
  phaseCount: number;
  stepCount: number;
  finishedStepCount: number;
}

// ─── Full Path (GET /onboarding/{userId}/path) ───────────────────────────────

export type StepStatus = "WAITING" | "IN_PROGRESS" | "FINISHED" | "SKIPPED";
export type StepType = "VIDEO" | "DOCUMENT" | "TASK" | "LINK";

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

export interface OnboardingPhaseEndpoint {
  id: string;
  pathId: string;
  position: number;
  title: string;
  description: string;
  steps: OnboardingStepEndpoint[];
}

export interface OnboardingPathEndpoint {
  id: string;
  userId: string;
  createdAt: string;
  phases: OnboardingPhaseEndpoint[];
}

// ─── Step Detail (GET /onboarding/steps/{stepId}) ────────────────────────────

export interface OnboardingTaskEndpoint {
  id: string;
  stepId: string;
  position: number;
  title: string;
  description: string;
  finished: boolean;
}

export interface OnboardingResourceEndpoint {
  id: string;
  stepId: string;
  title: string;
  description: string;
  url: string;
}

export interface OnboardingStepDetail extends OnboardingStepEndpoint {
    expectedOutcome?: string;
    tasks: OnboardingTaskEndpoint[];
    resources: OnboardingResourceEndpoint[];
}