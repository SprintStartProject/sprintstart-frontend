// ============================================================
// checkAnswers.ts
// ============================================================
// Answer-draft helpers shared by the phase check and the review
// check. Kept out of the component file so both modals can use
// them without breaking Fast Refresh.
// ============================================================

import type { PhaseCheckQuestionEndpoint, PhaseCheckAnswerSubmission } from "./types";

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
export function isAnswered(question: PhaseCheckQuestionEndpoint, draft: DraftAnswer): boolean {
  return question.type === "MULTIPLE_CHOICE"
    ? draft.selectedOptionIds.length > 0
    : draft.textAnswer.trim().length > 0;
}

/** Converts a draft into the payload shape the submit endpoints expect. */
export function toSubmission(
  question: PhaseCheckQuestionEndpoint,
  draft: DraftAnswer,
): PhaseCheckAnswerSubmission {
  return question.type === "MULTIPLE_CHOICE"
    ? { questionId: question.id, selectedOptionIds: draft.selectedOptionIds }
    : { questionId: question.id, textAnswer: draft.textAnswer.trim() };
}
