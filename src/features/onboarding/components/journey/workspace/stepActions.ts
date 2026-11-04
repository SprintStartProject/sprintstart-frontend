import type { Dispatch, SetStateAction } from "react";
import { onboardingService } from "../../../../../services/onboardingService";
import type { OnboardingStepDetail, OnboardingTaskEndpoint } from "../../../../../services/onboardingTypes";
import type { Drafts } from "./useStepData";
import { failureMessage, pendingSkipOf } from "./workspaceRules";
import type { Busy, Drawer } from "./workspaceRules";

type Toast = { error: (message: string) => void; success: (message: string) => void };

/** Everything the member's actions on a step read and write, handed in rather than closed over. */
export type ActionEnv = {
  step: OnboardingStepDetail;
  drafts: Drafts;
  setStep: (step: OnboardingStepDetail) => void;
  setTasks: Dispatch<SetStateAction<OnboardingTaskEndpoint[]>>;
  setBusy: (busy: Busy) => void;
  setDrawer: (drawer: Drawer) => void;
  setFeedbackSent: (sent: boolean) => void;
  /** Re-reads the path after anything that changes it: a start, a completion, a skip request. */
  onPathChanged: () => Promise<void> | void;
  toast: Toast;
  flyby: () => void;
};

/** Marks the step busy for the length of `run`, and says why when it fails. */
async function runBusy(env: ActionEnv, busy: Busy, fallback: string, run: () => Promise<void>) {
  env.setBusy(busy);
  try {
    await run();
  } catch (reason) {
    env.toast.error(failureMessage(reason, fallback));
  } finally {
    env.setBusy(null);
  }
}

export function startStep(env: ActionEnv): Promise<void> {
  return runBusy(env, "start", "Couldn't start the step.", async () => {
    await onboardingService.startStep(env.step.id);
    env.flyby();
    env.setStep({ ...env.step, status: "IN_PROGRESS", startedAt: new Date().toISOString() });
    await env.onPathChanged();
  });
}

export function completeStep(env: ActionEnv): Promise<void> {
  return runBusy(env, "complete", "Couldn't complete the step.", async () => {
    await onboardingService.completeStep(env.step.id);
    env.setStep({ ...env.step, status: "FINISHED", completedAt: new Date().toISOString() });
    await env.onPathChanged();
  });
}

/** Ticks a task at once and puts it back when the server refuses. */
export async function toggleTask(env: ActionEnv, task: OnboardingTaskEndpoint): Promise<void> {
  const finished = !task.finished;
  env.setTasks((current) =>
    current.map((candidate) => (candidate.id === task.id ? { ...candidate, finished } : candidate)),
  );

  try {
    await onboardingService.updateTask(task, finished);
  } catch (reason) {
    env.setTasks((current) =>
      current.map((candidate) => (candidate.id === task.id ? task : candidate)),
    );
    env.toast.error(failureMessage(reason, "Couldn't update the task."));
  }
}

export async function requestSkip(env: ActionEnv): Promise<void> {
  const reason = env.drafts.skipReason.trim();
  if (!reason) return;

  await runBusy(env, "skip", "Couldn't send the skip request.", async () => {
    const created = await onboardingService.skipStep(env.step, reason);
    env.setStep({ ...env.step, skip: pendingSkipOf(created) });
    env.setDrawer(null);
    env.toast.success("Skip request sent to your project manager");
    await env.onPathChanged();
  });
}

export async function sendFeedback(env: ActionEnv): Promise<void> {
  const { helpful, comment } = env.drafts;
  if (helpful === null || !comment.trim()) return;

  await runBusy(env, "feedback", "Couldn't send your feedback.", async () => {
    await onboardingService.submitFeedback(env.step.id, helpful, comment);
    env.setFeedbackSent(true);
    env.setDrawer(null);
    env.toast.success("Thanks for the feedback");
  });
}
