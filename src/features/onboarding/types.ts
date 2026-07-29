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

// Why the backend considers a phase locked (see OnboardingPhaseEndpoint.unlockReason)
export type PhaseUnlockReason =
  | "PREVIOUS_PHASE_INCOMPLETE"
  | "PREVIOUS_PHASE_CHECK_NOT_PASSED";

// Compact knowledge check state embedded into each phase of GET /onboarding/me/path
export interface PhaseCheckSummaryEndpoint {
  required: boolean;
  questionCount: number;
  passed: boolean;
  latestAttemptId: string | null;
  latestAttemptAt: string | null;
}

export interface OnboardingPhaseEndpoint {
  id: string;
  pathId: string;
  position: number;
  title: string;
  description: string;
  locked: boolean;
  unlockReason: PhaseUnlockReason | null;
  checkSummary: PhaseCheckSummaryEndpoint;
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

// ─── Phase Knowledge Checks (GET/POST /onboarding/me/phases/{phaseId}/checks…) ─

export type CheckQuestionType = "MULTIPLE_CHOICE" | "SHORT_TEXT";

export interface PhaseCheckOptionEndpoint {
  id: string;
  position: number;
  label: string;
}

export interface PhaseCheckQuestionEndpoint {
  id: string;
  position: number;
  type: CheckQuestionType;
  question: string;
  // Only present for MULTIPLE_CHOICE questions
  options?: PhaseCheckOptionEndpoint[];
  // True for questions from the review pool. A phase check never returns these; they
  // only appear in the standalone review check (see ReviewCheckEndpoint).
  review?: boolean;
  reviewSourcePhaseTitle?: string | null;
}

// GET /onboarding/me/phases/{phaseId}/checks — never contains correct answers
export interface PhaseCheckEndpoint {
  phaseId: string;
  required: boolean;
  passed: boolean;
  latestAttemptId: string | null;
  questions: PhaseCheckQuestionEndpoint[];
}

export interface PhaseCheckAnswerSubmission {
  questionId: string;
  selectedOptionIds?: string[];
  textAnswer?: string;
}

export interface PhaseCheckAnswerResult {
  questionId: string;
  correct: boolean;
  correctOptionIds: string[];
  correctAnswer: string | null;
  explanation: string | null;
  // AI feedback for short-text answers; null for multiple choice.
  feedback: string | null;
  // True when this result is for a question from the review pool.
  review?: boolean;
  reviewSourcePhaseTitle?: string | null;
}

// POST /onboarding/me/phases/{phaseId}/checks/attempts — reveals correct answers
export interface PhaseCheckAttemptResult {
  attemptId: string;
  phaseId: string;
  passed: boolean;
  createdAt: string;
  // How many questions were correct, out of how many, and the pass threshold (percent).
  correctCount: number;
  questionCount: number;
  requiredPercent: number;
  phaseCheckSummary: PhaseCheckSummaryEndpoint;
  nextPhaseUnlocked: boolean;
  // Questions waiting in the review pool after this attempt, including any collected from
  // it. Passing the final phase check does not finish onboarding while this is > 0.
  openReviewCount: number;
  // True when this attempt completed the entire onboarding journey.
  onboardingCompleted: boolean;
  results: PhaseCheckAnswerResult[];
}

// ─── Review Check (GET/POST /onboarding/me/review-check) ──────────────────────

/**
 * The user's review pool: questions they answered incorrectly in earlier phases and
 * still have to answer correctly once. Asked separately from the phase checks, where
 * they would be off-topic, and cleared before onboarding counts as finished.
 */
export interface ReviewCheckEndpoint {
  openCount: number;
  questions: PhaseCheckQuestionEndpoint[];
}

/**
 * Result of answering review questions. There is no pass threshold: correct answers
 * leave the pool for good, wrong ones stay open for another try.
 */
export interface ReviewCheckResult {
  answeredCount: number;
  correctCount: number;
  remainingCount: number;
  // True when clearing the pool completed the entire onboarding journey.
  onboardingCompleted: boolean;
  results: PhaseCheckAnswerResult[];
}

// ─── Phase Check Admin (GET/PUT /onboarding/phases/{phaseId}/checks) ──────────

export interface AdminPhaseCheckOptionEndpoint {
  id: string;
  position: number;
  label: string;
  correct: boolean;
}

export interface AdminPhaseCheckQuestionEndpoint {
  id: string;
  position: number;
  type: CheckQuestionType;
  question: string;
  explanation: string | null;
  correctAnswer?: string | null;
  options?: AdminPhaseCheckOptionEndpoint[];
}

export interface AdminPhaseCheckEndpoint {
  phaseId: string;
  questions: AdminPhaseCheckQuestionEndpoint[];
}

export interface UpsertPhaseCheckQuestion {
  position: number;
  type: CheckQuestionType;
  question: string;
  explanation?: string | null;
  // SHORT_TEXT only
  correctAnswer?: string | null;
  // MULTIPLE_CHOICE only
  options?: {
    position: number;
    label: string;
    correct: boolean;
  }[];
}

// GET /onboarding/users/{userId}/phases/{phaseId}/checks/attempts
export interface PhaseCheckAttemptsReviewEndpoint {
  userId: string;
  phaseId: string;
  attempts: {
    id: string;
    passed: boolean;
    createdAt: string;
    correctAnswerCount: number;
    questionCount: number;
    answers: {
      questionId: string;
      selectedOptionIds: string[];
      textAnswer: string | null;
      correct: boolean;
    }[];
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
