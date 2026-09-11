// ============================================================
// checkAnswers.ts
// ============================================================
// Answer-draft helpers for answering a single knowledge-check
// question. Kept out of the component file so the modal can use
// them without breaking Fast Refresh.
// ============================================================

import type { OnboardingQuestionEndpoint, QuestionAttemptSubmission } from "./types";

/** A user's in-progress answer to one question, before it is submitted. */
export interface DraftAnswer {
  selectedOptionIds: string[];
  textAnswer: string;
}

/** An empty draft, used for questions the user has not touched yet. */
export const emptyDraft: DraftAnswer = { selectedOptionIds: [], textAnswer: "" };

/**
 * Whether a draft counts as answered, which differs per question type: multiple
 * choice needs at least one option, short text needs non-whitespace input.
 */
export function isAnswered(question: OnboardingQuestionEndpoint, draft: DraftAnswer): boolean {
  return question.type === "MULTIPLE_CHOICE"
    ? draft.selectedOptionIds.length > 0
    : draft.textAnswer.trim().length > 0;
}

/** Converts a draft into the payload shape the submit endpoint expects. */
export function toSubmission(
  question: OnboardingQuestionEndpoint,
  draft: DraftAnswer,
): QuestionAttemptSubmission {
  return question.type === "MULTIPLE_CHOICE"
    ? { selectedOptionIds: draft.selectedOptionIds }
    : { textAnswer: draft.textAnswer.trim() };
}
