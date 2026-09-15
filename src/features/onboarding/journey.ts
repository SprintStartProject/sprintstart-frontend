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

export type PhaseState = "done" | "current" | "open" | "locked";

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
  remainingMinutes: number;
} {
  let completed = 0;
  let total = 0;
  let phasesDone = 0;
  let remainingMinutes = 0;
  for (const phase of path.phases) {
    const progress = phaseProgress(phase);
    completed += progress.completed;
    total += progress.total;
    if (progress.total > 0 && progress.completed === progress.total) phasesDone += 1;
    remainingMinutes += phase.steps
      .filter((step) => step.status !== "FINISHED" && step.status !== "SKIPPED")
      .reduce((sum, step) => sum + (step.estimatedMinutes || 0), 0);
  }
  return { completed, total, percentage: percent(completed, total), phasesDone, remainingMinutes };
}

/** Phases in position order. */
export function sortedPhases(path: OnboardingPathEndpoint): OnboardingPhaseEndpoint[] {
  return [...path.phases].sort((left, right) => left.position - right.position);
}

export function phaseState(phase: OnboardingPhaseEndpoint, currentPhaseId: string | null): PhaseState {
  if (!isPhaseOpen(phase) && (phase.steps.length > 0 || phase.questions.length > 0)) return "done";
  if (phase.locked) return "locked";
  return phase.id === currentPhaseId ? "current" : "open";
}

/** Titles of the unfinished items an item still waits on -- "why is this locked", in words. */
export function waitingOn(item: PhaseItem, items: readonly PhaseItem[]): PhaseItem[] {
  const byId = new Map(items.map((candidate) => [candidate.id, candidate]));
  return item.blockerIds
    .map((id) => byId.get(id))
    .filter((blocker): blocker is PhaseItem => !!blocker && !isItemComplete(itemState(blocker, false)));
}

/** Items that wait on this one directly. */
export function unlockedBy(item: PhaseItem, items: readonly PhaseItem[]): PhaseItem[] {
  return items.filter((candidate) => candidate.blockerIds.includes(item.id));
}

export function formatMinutes(minutes?: number | null): string {
  if (!minutes || minutes <= 0) return "No estimate";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours}h ${rest}m` : `${hours}h`;
}
