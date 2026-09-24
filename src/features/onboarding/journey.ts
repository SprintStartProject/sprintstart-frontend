// ============================================================
// features/onboarding/journey.ts
// ============================================================
// The shared vocabulary of the onboarding views: what state an
// item or a phase is in, how far along a phase is, and how an
// item is reached. The hire's page and the PM's member view both
// read a path through these, so they never disagree about it.
// ============================================================

import { isPhaseOpen } from "./activePhase";
import { orderByGraph } from "./graph/layout";
import type {
  OnboardingPathEndpoint,
  OnboardingPhaseEndpoint,
  OnboardingQuestionEndpoint,
  OnboardingStepEndpoint,
} from "./types";

/** A node of a phase graph: one step or one knowledge-check question. */
export type PhaseItem =
  | {
      kind: "step";
      id: string;
      title: string;
      blockerIds: string[];
      graphX: number | null;
      graphY: number | null;
      position: number;
      step: OnboardingStepEndpoint;
    }
  | {
      kind: "question";
      id: string;
      title: string;
      blockerIds: string[];
      graphX: number | null;
      graphY: number | null;
      position: number;
      question: OnboardingQuestionEndpoint;
    };

/**
 * - `done` / `skipped`: behind the member.
 * - `active`: started and not finished.
 * - `open`: reachable now.
 * - `retry`: a question answered wrong at least once, still open.
 * - `locked`: waits on something unfinished, or its phase does.
 */
export type ItemState = "done" | "skipped" | "active" | "open" | "retry" | "locked";

/**
 * - `done`: every step finished or skipped, every question passed. An empty phase is done too --
 *   the backend unlocks what waits on it, so nothing here may treat it as still to do.
 * - `active`: open, and the member has already started on it.
 * - `open`: reachable, not started yet -- one of the phases the member can pick next.
 * - `locked`: waits on a phase that is not done.
 */
export type PhaseState = "done" | "active" | "open" | "locked";

export type Progress = { completed: number; total: number; percentage: number };

const percent = (completed: number, total: number) =>
  total > 0 ? Math.round((completed / total) * 100) : 0;

/** Steps before questions, each in position order -- the input order layout breaks ties with. */
export function phaseItems(phase: OnboardingPhaseEndpoint): PhaseItem[] {
  const steps = [...phase.steps]
    .sort((left, right) => left.position - right.position)
    .map<PhaseItem>((step) => ({
      kind: "step",
      id: step.id,
      title: step.title,
      blockerIds: step.blockerIds ?? [],
      graphX: step.graphX ?? null,
      graphY: step.graphY ?? null,
      position: step.position,
      step,
    }));
  const questions = [...(phase.questions ?? [])]
    .sort((left, right) => left.position - right.position)
    .map<PhaseItem>((question) => ({
      kind: "question",
      id: question.id,
      title: question.title || question.question,
      blockerIds: question.blockerIds ?? [],
      graphX: question.graphX ?? null,
      graphY: question.graphY ?? null,
      position: question.position,
      question,
    }));
  return [...steps, ...questions];
}

/** The DOM id of a step or question row, which a link from the buddy scrolls to. */
export function linkedCardId(itemId: string): string {
  return `onboarding-item-${itemId}`;
}

/** A phase's items in the order its graph reads, top to bottom -- the list view's order. */
export function orderedPhaseItems(phase: OnboardingPhaseEndpoint): PhaseItem[] {
  return orderByGraph(phaseItems(phase));
}

export function itemState(item: PhaseItem, phaseLocked: boolean): ItemState {
  if (item.kind === "step") {
    const { status, locked } = item.step;
    if (status === "FINISHED") return "done";
    if (status === "SKIPPED") return "skipped";
    if (status === "IN_PROGRESS") return "active";
    return locked || phaseLocked ? "locked" : "open";
  }
  const { status } = item.question;
  if (status === "PASSED") return "done";
  if (status === "LOCKED" || phaseLocked) return "locked";
  return status === "RETRY" ? "retry" : "open";
}

export const isItemComplete = (state: ItemState) => state === "done" || state === "skipped";

export function phaseProgress(phase: OnboardingPhaseEndpoint): Progress {
  const items = phaseItems(phase);
  const completed = items.filter((item) => isItemComplete(itemState(item, false))).length;
  return { completed, total: items.length, percentage: percent(completed, items.length) };
}

export function pathProgress(path: OnboardingPathEndpoint): Progress & {
  phasesDone: number;
  stepsDone: number;
} {
  let completed = 0;
  let total = 0;
  let phasesDone = 0;
  let stepsDone = 0;
  for (const phase of path.phases) {
    const progress = phaseProgress(phase);
    completed += progress.completed;
    total += progress.total;
    if (phaseState(phase) === "done") phasesDone += 1;
    stepsDone += phase.steps.filter((step) => step.status === "FINISHED").length;
  }
  return { completed, total, percentage: percent(completed, total), phasesDone, stepsDone };
}

/** Phases in position order. */
export function sortedPhases(path: OnboardingPathEndpoint): OnboardingPhaseEndpoint[] {
  return [...path.phases].sort((left, right) => left.position - right.position);
}

/** Whether the member has touched anything in a phase: a step begun or behind them, a question tried. */
export function isPhaseStarted(phase: OnboardingPhaseEndpoint): boolean {
  return (
    phase.steps.some((step) => step.status !== "WAITING") ||
    (phase.questions ?? []).some(
      (question) => question.status === "PASSED" || question.status === "RETRY",
    )
  );
}

export function phaseState(phase: OnboardingPhaseEndpoint): PhaseState {
  if (!isPhaseOpen(phase)) return "done";
  if (phase.locked) return "locked";
  return isPhaseStarted(phase) ? "active" : "open";
}

/** When the member last did something in a phase, as epoch millis; 0 when never. */
export function lastActivityAt(phase: OnboardingPhaseEndpoint): number {
  return phase.steps.reduce((latest, step) => {
    const times = [step.startedAt, step.completedAt]
      .map((value) => (value ? Date.parse(value) : 0))
      .filter((value) => Number.isFinite(value));
    return Math.max(latest, ...times);
  }, 0);
}

/** The phases a phase still waits on, by name -- "why is this locked", for a whole phase. */
export function blockingPhases(
  phase: OnboardingPhaseEndpoint,
  phases: readonly OnboardingPhaseEndpoint[],
): OnboardingPhaseEndpoint[] {
  const byId = new Map(phases.map((candidate) => [candidate.id, candidate]));
  return (phase.blockerIds ?? [])
    .map((id) => byId.get(id))
    .filter(
      (blocker): blocker is OnboardingPhaseEndpoint => !!blocker && phaseState(blocker) !== "done",
    );
}

/** Phases that wait on this one directly. */
export function phasesUnlockedBy(
  phase: OnboardingPhaseEndpoint,
  phases: readonly OnboardingPhaseEndpoint[],
): OnboardingPhaseEndpoint[] {
  return phases.filter((candidate) => (candidate.blockerIds ?? []).includes(phase.id));
}

/** Titles of the unfinished items an item still waits on -- "why is this locked", in words. */
export function waitingOn(item: PhaseItem, items: readonly PhaseItem[]): PhaseItem[] {
  const byId = new Map(items.map((candidate) => [candidate.id, candidate]));
  return item.blockerIds
    .map((id) => byId.get(id))
    .filter(
      (blocker): blocker is PhaseItem => !!blocker && !isItemComplete(itemState(blocker, false)),
    );
}

/** Items that wait on this one directly. */
export function unlockedBy(item: PhaseItem, items: readonly PhaseItem[]): PhaseItem[] {
  return items.filter((candidate) => candidate.blockerIds.includes(item.id));
}

/**
 * A skip request nobody has answered yet.
 *
 * `accepted` is an explicit `null` while a request is open, but treating an *absent* one as
 * answered is how the same skip came to be counted in one place, left out of a second and
 * unanswerable in a third. One predicate, used everywhere a pending skip is counted or acted on.
 */
export function isSkipPending(skip: { accepted?: boolean | null } | null | undefined): boolean {
  return !!skip && (skip.accepted === null || skip.accepted === undefined);
}

/**
 * Where a step's skip request stands, if it has one: waiting on the PM, or turned down. A granted
 * request needs no flag -- the step is simply skipped.
 */
export function skipRequestOf(item: PhaseItem): "pending" | "declined" | null {
  if (item.kind !== "step" || !item.step.skip) return null;
  if (item.step.status === "SKIPPED") return null;
  if (isSkipPending(item.step.skip)) return "pending";
  return item.step.skip.accepted === false ? "declined" : null;
}

/** What the member said about a step, if anything. */
export function feedbackOf(item: PhaseItem): "helpful" | "unhelpful" | "comment" | null {
  if (item.kind !== "step" || !item.step.feedback) return null;
  if (item.step.feedback.helpful === true) return "helpful";
  if (item.step.feedback.helpful === false) return "unhelpful";
  return "comment";
}

export function formatMinutes(minutes?: number | null): string {
  if (!minutes || minutes <= 0) return "No estimate";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours}h ${rest}m` : `${hours}h`;
}
