import type { TeamOverviewUser } from "../team-management/types";

/**
 * Where a member stands, read off one team-overview row.
 *
 * Every PM surface used to derive this on its own, and they disagreed: the team card multiplied
 * `progressPercentage` by 100 (it is a fraction, `done / total` on the backend) while the
 * dashboard's team widget compared it against 100 — so nobody was ever counted as finished there.
 * One module, one reading.
 */

/** Days on the same step after which a member is flagged, on every PM surface alike. */
export const AT_RISK_AFTER_DAYS = 5;

export type MemberStage = "not-started" | "underway" | "done";

export type WaitingKind = "skip" | "feedback";

const DAY_MS = 1000 * 60 * 60 * 24;

export function memberName(member: Pick<TeamOverviewUser, "firstname" | "lastname">): string {
  return `${member.firstname} ${member.lastname}`.trim() || "Unnamed member";
}

/** 0–100, rounded, for display. */
export function progressPercent(member: Pick<TeamOverviewUser, "progressPercentage">): number {
  return Math.min(100, Math.max(0, Math.round(member.progressPercentage * 100)));
}

export function memberStage(member: Pick<TeamOverviewUser, "progressPercentage">): MemberStage {
  if (member.progressPercentage >= 1) return "done";
  return member.progressPercentage > 0 ? "underway" : "not-started";
}

export const STAGE_LABEL: Record<MemberStage, string> = {
  "not-started": "Not started",
  underway: "Underway",
  done: "Done",
};

/** Whole days on the current step, or null when there is no current step. */
export function daysOnStep(member: Pick<TeamOverviewUser, "currentStep">): number | null {
  const startedAt = member.currentStep?.startedAt;
  if (!startedAt) return null;

  return Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / DAY_MS));
}

export function isAtRisk(member: Pick<TeamOverviewUser, "currentStep">): boolean {
  const days = daysOnStep(member);
  return days !== null && days > AT_RISK_AFTER_DAYS;
}

/**
 * What a member is waiting on the manager for, most blocking first: a skip request holds them
 * on a step, unread feedback only waits to be read.
 */
export function waitingOn(member: TeamOverviewUser): WaitingKind[] {
  const kinds: WaitingKind[] = [];
  if (member.currentStep?.skip?.status === "PENDING") kinds.push("skip");
  if (member.hasFeedback) kinds.push("feedback");
  return kinds;
}

export function formatDays(days: number): string {
  if (days <= 0) return "today";
  return days === 1 ? "1 day" : `${days} days`;
}
