import {
  BUDDY_PATH_ACTIONS,
  type BuddyStreamHandlers,
  type HireActionProposal,
  type ProposedAction,
  type StoredActionProposal,
} from "../types";
import { changesBoard } from "./boardActions";

type ActionEvent = Parameters<NonNullable<BuddyStreamHandlers["onActionProposal"]>>[0];
type StoredEvent = Parameters<NonNullable<BuddyStreamHandlers["onStoredProposal"]>>[0];

/** A hire's offer as it arrived, given a local id and waiting for an answer. */
export function hireProposal(id: string, event: ActionEvent): HireActionProposal {
  return {
    id,
    action: event.action,
    label: event.label,
    question: event.question,
    taskId: event.taskId,
    title: event.title,
    attesterId: event.attesterId,
    githubLogin: event.githubLogin,
    competencyKey: event.competencyKey,
    level: event.level,
    checklistTitle: event.checklistTitle,
    checklistItems: event.checklistItems,
    cardId: event.cardId,
    noteText: event.noteText,
    lineBefore: event.lineBefore,
    lineAfter: event.lineAfter,
    stepId: event.stepId,
    questionId: event.questionId,
    phaseId: event.phaseId,
    onboardingTaskId: event.onboardingTaskId,
    answer: event.answer,
    optionIds: event.optionIds,
    description: event.description,
    reason: event.reason,
    waitsOnIds: event.waitsOnIds,
    unlocksIds: event.unlocksIds,
    linkUrl: event.linkUrl,
    linkLabel: event.linkLabel,
    cardIds: event.cardIds,
    cardNames: event.cardNames,
    preview: event.preview,
    status: "idle",
  };
}

/** A manager's offer as it arrived: only the stored id is trusted to come back. */
export function storedProposal(id: string, event: StoredEvent): StoredActionProposal {
  return {
    id,
    proposalId: event.proposalId,
    label: event.label,
    preview: event.preview,
    risk: event.risk,
    status: "idle",
  };
}

/** What a hire offer sends back to be carried out: its payload, and nothing about how it looked. */
export function actionExtras(action: HireActionProposal) {
  return {
    question: action.question,
    taskId: action.taskId,
    title: action.title,
    attesterId: action.attesterId,
    githubLogin: action.githubLogin,
    competencyKey: action.competencyKey,
    level: action.level,
    checklistTitle: action.checklistTitle,
    checklistItems: action.checklistItems,
    cardId: action.cardId,
    noteText: action.noteText,
    lineBefore: action.lineBefore,
    lineAfter: action.lineAfter,
    stepId: action.stepId,
    questionId: action.questionId,
    phaseId: action.phaseId,
    onboardingTaskId: action.onboardingTaskId,
    answer: action.answer,
    optionIds: action.optionIds,
    description: action.description,
    reason: action.reason,
    waitsOnIds: action.waitsOnIds,
    unlocksIds: action.unlocksIds,
    linkUrl: action.linkUrl,
    linkLabel: action.linkLabel,
    cardIds: action.cardIds,
  };
}

/** Whether the offer is a stored one, confirmed by id, rather than a hire's echoed payload. */
export function isStored(action: ProposedAction): action is StoredActionProposal {
  return "proposalId" in action;
}

/**
 * Whether pressing confirm does anything.
 *
 * An offer can be confirmed while it waits or after it failed to reach the server — and a hire
 * offer that was refused can be asked again, since a refusal ("not now") is not final. A stored
 * offer that was refused is final: the backend has decided.
 */
export function mayConfirm(action: ProposedAction): boolean {
  const retryableRefusal = action.status === "resolved" && action.ok === false && !isStored(action);

  return action.status === "idle" || action.status === "error" || retryableRefusal;
}

/** Whether a stored offer can still be turned down. */
export function mayDismissStored(action: ProposedAction): boolean {
  return action.status === "idle" || action.status === "error";
}

/** Whether carrying this out moved the hire along their onboarding path. */
export function movesPath(action: ProposedAction): boolean {
  return !isStored(action) && BUDDY_PATH_ACTIONS.includes(action.action);
}

/** Whether carrying this out changed cards on the board. */
export function touchesBoard(action: ProposedAction): boolean {
  return !isStored(action) && changesBoard(action.action);
}
