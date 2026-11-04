import type { LucideIcon } from "lucide-react";
import { MessageSquareText, ThumbsDown, ThumbsUp } from "lucide-react";
import type { DetailOnboardingStep, TaskDraft } from "./stepPanelTypes";

/** The skip request's state as the reviewer reads it: the stated status, else what the step implies. */
export function getSkipStatus(step: DetailOnboardingStep): string {
  if (step.skip?.status) {
    return step.skip.status.charAt(0) + step.skip.status.slice(1).toLowerCase();
  }
  if (step.skip?.accepted === true || step.status === "SKIPPED") return "Accepted";
  if (step.skip?.accepted === false) return "Denied";
  return "Pending";
}

type FeedbackRating = {
  label: string;
  Icon: LucideIcon;
  iconClassName: string;
  badgeClassName: string;
  cardClassName: string;
};

/** How a piece of feedback is labelled and coloured: helpful, not helpful, or unrated. */
export function getFeedbackRating(helpful?: boolean | null): FeedbackRating {
  if (helpful === true) {
    return {
      label: "Helpful",
      Icon: ThumbsUp,
      iconClassName: "bg-app-surface text-app-success-solid",
      badgeClassName: "bg-app-surface text-app-success-solid",
      cardClassName: "border-app-success-border bg-app-success-bg",
    };
  }
  if (helpful === false) {
    return {
      label: "Not helpful",
      Icon: ThumbsDown,
      iconClassName: "bg-app-surface text-app-danger-text",
      badgeClassName: "bg-app-surface text-app-danger-text",
      cardClassName: "border-app-danger-border bg-app-danger-bg",
    };
  }
  return {
    label: "Feedback",
    Icon: MessageSquareText,
    iconClassName: "bg-app-surface text-app-brand-text",
    badgeClassName: "bg-app-surface text-app-brand-text",
    cardClassName: "border-app-brand-border bg-app-brand-soft",
  };
}

/** Whether the new-task form is open at this position of this step. */
export function isInsertAt(draft: TaskDraft, position: number): boolean {
  return (
    draft.taskInsertTarget?.stepId === draft.stepId && draft.taskInsertTarget.position === position
  );
}

/** The task a move would swap with, or null at the edge of the list. */
export function neighbourFor<T>(tasks: T[], index: number, direction: "up" | "down"): T | null {
  return tasks[direction === "up" ? index - 1 : index + 1] ?? null;
}
