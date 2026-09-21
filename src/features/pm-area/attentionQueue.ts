import type { AttentionItem } from "../onboarding-metrics/types";
import type { TeamOverviewUser } from "../team-management/types";
import { daysOnStep, isAtRisk, memberName } from "./memberStatus";

export type AttentionReasonKind = "skip" | "feedback" | "waiting-review" | "drifting" | "stuck";

export type AttentionReason = {
  kind: AttentionReasonKind;
  text: string;
};

export type AttentionEntry = {
  userId: string;
  name: string;
  member: TeamOverviewUser | null;
  reasons: AttentionReason[];
};

/**
 * How pressing each reason is. Lower sorts first. The two things only the manager can resolve
 * lead; the stalls that are about a conversation, not a click, follow.
 */
const REASON_RANK: Record<AttentionReasonKind, number> = {
  skip: 0,
  feedback: 1,
  "waiting-review": 2,
  drifting: 3,
  stuck: 4,
};

/**
 * One queue of people who need the manager, from the two places that know: the team overview
 * (skip requests, unread feedback, a step that has run long) and the metrics' attention list
 * (waiting on a review, drifting).
 *
 * One row per person, with every reason on it. The dashboard used to show these as three
 * separate widgets, so the same hire could appear three times in three different shapes —
 * and a manager could not tell whether three flags meant three people or one.
 */
export function buildAttentionQueue(
  roster: readonly TeamOverviewUser[],
  attention: readonly AttentionItem[],
): AttentionEntry[] {
  const entries = new Map<string, AttentionEntry>();

  const entryFor = (userId: string, name: string, member: TeamOverviewUser | null) => {
    const existing = entries.get(userId);
    if (existing) return existing;

    const created: AttentionEntry = { userId, name, member, reasons: [] };
    entries.set(userId, created);
    return created;
  };

  for (const member of roster) {
    const name = memberName(member);

    if (member.currentStep?.skip?.status === "PENDING") {
      entryFor(member.userId, name, member).reasons.push({
        kind: "skip",
        text: `Asked to skip “${member.currentStep.title}”`,
      });
    }

    if (member.hasFeedback) {
      entryFor(member.userId, name, member).reasons.push({
        kind: "feedback",
        text: "Left feedback to read",
      });
    }
  }

  for (const item of attention) {
    const member = roster.find((candidate) => candidate.userId === item.hireId) ?? null;
    entryFor(item.hireId, member ? memberName(member) : item.hireName, member).reasons.push({
      kind: item.severity === "BLOCKED" ? "waiting-review" : "drifting",
      text: item.reason,
    });
  }

  for (const member of roster) {
    if (!isAtRisk(member)) continue;
    // A long step is already explained by any other reason on the same person.
    if (entries.has(member.userId)) continue;

    entryFor(member.userId, memberName(member), member).reasons.push({
      kind: "stuck",
      text: `${daysOnStep(member)} days on “${member.currentStep?.title ?? "the same step"}”`,
    });
  }

  const rankOf = (entry: AttentionEntry) =>
    Math.min(...entry.reasons.map((reason) => REASON_RANK[reason.kind]));

  return [...entries.values()]
    .map((entry) => ({
      ...entry,
      reasons: [...entry.reasons].sort((a, b) => REASON_RANK[a.kind] - REASON_RANK[b.kind]),
    }))
    .sort((a, b) => rankOf(a) - rankOf(b) || a.name.localeCompare(b.name));
}

/**
 * Whether the person is waiting on an answer only the manager can give — a skip to decide,
 * feedback to read. The same set the "Waiting on you" figure and filter count.
 *
 * Everybody else in the queue is worth a check-in (a review nobody picked up, a hire drifting,
 * a step that has run long) but is not blocked on the manager. That split is the whole
 * difference between "Needs you" and "Waiting on you": the second is the first half of the first.
 */
export function isWaitingOnAnswer(entry: AttentionEntry): boolean {
  return entry.reasons.some((reason) => reason.kind === "skip" || reason.kind === "feedback");
}
