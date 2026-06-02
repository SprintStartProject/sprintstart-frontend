// ============================================================
// types/onboarding.ts
// ============================================================
// Alle Interfaces für den Onboarding-Bereich.
// ============================================================

export interface OnBoardingStep {
  id: string;
  title: string;
  completed: boolean;
}

export interface OnBoardingTask {
  id: string;
  title: string;
  description: string;
  motivation: string[];
  steps: OnBoardingStep[];
  finalTask: string;
  artifactUrl?: string;
}

export interface OnBoardingItem {
  id: string;
  title: string;
  description: string;
  type: 'document' | 'video' | 'link' | 'task';
  completed: boolean;
  duration?: string;
  artifactUrl?: string;
  task?: OnBoardingTask;
}

export interface OnBoardingPhase {
  id: string;
  title: string;
  description: string;
  period: string;
  items: OnBoardingItem[];
}

export interface OnBoardingPath {
  userId: string;
  role: string;
  generatedAt: string;
  phases: OnBoardingPhase[];
}

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

export interface OnboardingStepEndpoint {
  id: string;
  phaseId: string;
  position: number;
  title: string;
  description: string;
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

export type StepType = "VIDEO" | "DOCUMENT" | "TASK" | "LINK";

export interface OnboardingStepDetail extends OnboardingStepEndpoint {
    type?: StepType;        // ← kommt nicht vom GET zurück, daher optional
    expectedOutcome?: string;
    tasks: OnboardingTaskEndpoint[];
    resources: OnboardingResourceEndpoint[];
}