// ============================================================
// features/onboarding/types.ts
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
// Matches the backend SkipStatus enum (CreateOnboardingSkipResponse.status etc.)
export type SkipStatus = "PENDING" | "ACCEPTED" | "DENIED";

export interface OnboardingStepFeedback {
  id: string;
  stepId: string;
  helpful: boolean | null;
  comment: string;
  createdAt: string;
}

export interface OnboardingStepSkip {
  id: string;
  stepId: string;
  reason: string;
  accepted: boolean | null;
  reviewComment: string | null;
  reviewedAt: string | null;
}

export interface OnboardingStepEndpoint {
  id: string;
  phaseId: string;
  position: number;
  isAiAssisted?: boolean;
  title: string;
  description: string;
  type: StepType;
  estimatedMinutes: number;
  expectedOutcomes: string[];
  tasks: OnboardingTaskEndpoint[];
  resources: OnboardingResourceEndpoint[];
  status: StepStatus;
  startedAt: string | null;
  completedAt: string | null;
  feedback: OnboardingStepFeedback | null;
  skip: OnboardingStepSkip | null;
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

export interface OnboardingSkipEndpoint {
  id: string;
  stepId: string;
  status: SkipStatus;
  reason: string;
  reviewComment: string | null;
  createdAt: string;
  resolvedAt?: string | null;
  reviewedAt?: string | null;
}

export interface OnboardingStepDetail extends OnboardingStepEndpoint {
    tasks: OnboardingTaskEndpoint[];
    resources: OnboardingResourceEndpoint[];
}

// ─── AI Path Generation (POST /onboarding/me/path/personalize, SSE) ──────────

export interface OnboardingPersonalizeEvent {
  type: "stage" | "path" | "done" | "error";
  name?: string;
  detail?: string;
  path?: OnboardingPathEndpoint;
  message?: string;
}

export interface OnboardingPersonalizeHandlers {
  onStage?: (name: string, detail?: string) => void;
  onPath: (path: OnboardingPathEndpoint) => void;
  onDone: () => void;
  onError?: (message: string) => void;
}
