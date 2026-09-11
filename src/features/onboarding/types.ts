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
export type GenerationStatus =
  "NOT_APPLICABLE" | "GENERATED" | "EMPTY" | "SKIPPED" | "FAILED" | "TIMED_OUT";
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
  /** Persisted position copied from the blueprint phase subgraph. */
  graphX?: number | null;
  graphY?: number | null;
  /** IDs of prerequisite steps or knowledge-check questions in the same phase. */
  blockerIds?: string[];
  /** True when the phase or an in-phase blocker keeps this step out of reach. */
  locked?: boolean;
}

export interface OnboardingPhaseEndpoint {
  id: string;
  pathId: string;
  position: number;
  title: string;
  description: string;
  locked: boolean;
  steps: OnboardingStepEndpoint[];
  /** The phase's knowledge-check questions, first-class nodes alongside its steps. */
  questions: OnboardingQuestionEndpoint[];
  /** Persisted position copied from the blueprint path graph. */
  graphX?: number | null;
  graphY?: number | null;
  /** IDs of prerequisite phases in this onboarding path. */
  blockerIds?: string[];
  generationStatus?: GenerationStatus;
}

export interface OnboardingGenerationIssueEndpoint {
  phaseId: string;
  title: string;
  status: "EMPTY" | "SKIPPED" | "FAILED" | "TIMED_OUT";
}

export interface OnboardingPathEndpoint {
  id: string;
  userId: string;
  createdAt: string;
  phases: OnboardingPhaseEndpoint[];
  blueprintId?: string | null;
  /** AI phases retained for auditing but omitted from the visible journey. */
  generationIssues?: OnboardingGenerationIssueEndpoint[];
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

// ─── Knowledge-Check Questions (first-class onboarding nodes) ──────────────

export type CheckQuestionType = "MULTIPLE_CHOICE" | "SHORT_TEXT";

/** Availability of a question for the user, derived by the backend. */
export type QuestionStatus = "LOCKED" | "OPEN" | "RETRY" | "PASSED";

export interface OnboardingQuestionOptionEndpoint {
  id: string;
  position: number;
  label: string;
}

/** A knowledge-check question embedded in the user's path, alongside the phase's steps. */
export interface OnboardingQuestionEndpoint {
  id: string;
  phaseId: string;
  position: number;
  type: CheckQuestionType;
  question: string;
  // Only present for MULTIPLE_CHOICE questions
  options?: OnboardingQuestionOptionEndpoint[];
  status: QuestionStatus;
  /** Display title copied from the blueprint question. */
  title?: string;
  graphX?: number | null;
  graphY?: number | null;
  blockerIds?: string[];
}

// POST /onboarding/me/questions/{questionId}/attempts — reveals correct answers
export interface QuestionAttemptSubmission {
  selectedOptionIds?: string[];
  textAnswer?: string;
}

export interface QuestionAttemptResult {
  attemptId: string;
  questionId: string;
  correct: boolean;
  createdAt: string;
  correctOptionIds: string[];
  correctAnswer: string | null;
  explanation: string | null;
  // AI feedback for short-text answers; null for multiple choice.
  feedback: string | null;
  status: QuestionStatus;
  // True when this attempt completed the entire onboarding journey.
  onboardingCompleted: boolean;
}

// ─── Question Admin (GET/PUT /onboarding/phases/{phaseId}/questions) ───────

export interface AdminQuestionOptionEndpoint {
  id: string;
  position: number;
  label: string;
  correct: boolean;
}

export interface AdminQuestionEndpoint {
  id: string;
  position: number;
  type: CheckQuestionType;
  question: string;
  explanation: string | null;
  correctAnswer?: string | null;
  options?: AdminQuestionOptionEndpoint[];
}

export interface AdminPhaseQuestionsEndpoint {
  phaseId: string;
  questions: AdminQuestionEndpoint[];
}

export interface UpsertQuestion {
  /**
   * ID of an existing question, so it survives the update with its identity intact.
   * Omit for questions being created.
   *
   * Sending it back matters: stored attempts reference questions by ID, so a question
   * recreated instead of updated loses its whole history.
   */
  id?: string | null;
  position: number;
  type: CheckQuestionType;
  question: string;
  explanation?: string | null;
  // SHORT_TEXT only
  correctAnswer?: string | null;
  // MULTIPLE_CHOICE only
  options?: {
    /** ID of an existing option; omit for new ones. Stored attempts reference these. */
    id?: string | null;
    position: number;
    label: string;
    correct: boolean;
  }[];
}

// GET /onboarding/users/{userId}/questions/{questionId}/attempts
export interface QuestionAttemptsReviewEndpoint {
  userId: string;
  questionId: string;
  attempts: {
    id: string;
    correct: boolean;
    createdAt: string;
    selectedOptionIds: string[];
    textAnswer: string | null;
  }[];
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
