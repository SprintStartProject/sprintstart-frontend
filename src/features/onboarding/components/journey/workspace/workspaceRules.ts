import { formatMinutes, isSkipPending } from "../../../journey";
import type {
  OnboardingSkipEndpoint,
  OnboardingStepDetail,
  OnboardingStepSkip,
  OnboardingTaskEndpoint,
} from "../../../types";

export type Drawer = "skip" | "feedback" | null;

export type Busy = "start" | "complete" | "skip" | "feedback" | null;

/** What the last read brought, so a re-read can tell the member's own typing from the server's text. */
export type LoadedStep = {
  stepId: string;
  buddyChanges: number;
  status: string;
  skipReason: string;
  comment: string;
};

export function minutesBetween(from: string, to: number): number {
  return Math.max(0, Math.floor((to - new Date(from).getTime()) / 60000));
}

/** A step the member is past: finished or skipped. */
export function isBehind(step: OnboardingStepDetail): boolean {
  return step.status === "FINISHED" || step.status === "SKIPPED";
}

/**
 * How long the member has been on the step, or took on it: "· on it for 12 min". Null before it
 * was started.
 */
export function workedLabel(step: OnboardingStepDetail, now: number): string | null {
  if (!step.startedAt) return null;

  const end = step.completedAt ? new Date(step.completedAt).getTime() : now;
  const minutes = Math.max(1, minutesBetween(step.startedAt, end));

  return `· ${isBehind(step) ? "took" : "on it for"} ${formatMinutes(minutes)}`;
}

export type SkipState = "pending" | "approved" | "declined" | null;

/**
 * Where a skip request stands, as the notice above the tasks tells it.
 *
 * The shared predicate decides "pending", not `accepted !== null`: an `accepted` the backend
 * omits is a request nobody has answered.
 */
export function skipStateOf(step: OnboardingStepDetail): SkipState {
  if (isSkipPending(step.skip)) return "pending";
  if (step.skip?.accepted === true) return "approved";
  if (step.skip && step.skip.accepted === false && step.status !== "SKIPPED") return "declined";
  return null;
}

export type TaskProgress = {
  done: number;
  total: number;
  allDone: boolean;
  percent: number;
};

export function taskProgress(tasks: readonly OnboardingTaskEndpoint[]): TaskProgress {
  const done = tasks.filter((task) => task.finished).length;

  return {
    done,
    total: tasks.length,
    allDone: done === tasks.length,
    percent: tasks.length === 0 ? 0 : Math.round((done / tasks.length) * 100),
  };
}

/** The label of the complete button while tasks are still open: "2 tasks to go". */
export function tasksToGoLabel(open: number): string {
  return `${open} ${open === 1 ? "task" : "tasks"} to go`;
}

export function sortedByPosition(
  tasks: readonly OnboardingTaskEndpoint[],
): OnboardingTaskEndpoint[] {
  return [...tasks].sort((left, right) => left.position - right.position);
}

/**
 * Whether the step has to be read again.
 *
 * The buddy's change is announced here and to the page at once; the page's refresh then moves
 * `stepStatus` to what the read for `buddyChanges` already brought, so that second move is not a
 * reason to read a second time.
 */
export function needsRead(
  last: LoadedStep | null,
  stepId: string,
  buddyChanges: number,
  stepStatus: string | undefined,
): boolean {
  return !(
    last?.stepId === stepId &&
    last.buddyChanges === buddyChanges &&
    last.status === stepStatus
  );
}

/**
 * What a text field shows after a re-read of the same step: what the member typed, when they typed
 * something other than the last server text, and the server's text otherwise. A re-read runs
 * whenever the buddy changes anything on the path and would wipe a half-written reason or comment.
 */
export function keepTyping(current: string, lastServerText: string | undefined, server: string) {
  return lastServerText !== undefined && current !== lastServerText ? current : server;
}

/** The skip request that was just created, in the shape the step carries it. */
export function pendingSkipOf(created: OnboardingSkipEndpoint): OnboardingStepSkip {
  return {
    id: created.id,
    stepId: created.stepId,
    reason: created.reason,
    accepted: null,
    reviewComment: created.reviewComment,
    reviewedAt: null,
  };
}

/** The message of a failure, or the fallback when it is not an error. */
export function failureMessage(reason: unknown, fallback: string): string {
  return reason instanceof Error ? reason.message : fallback;
}
