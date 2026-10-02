import type { FAQOverview } from "../../faq/types";
import type { KnowledgeGapOverview } from "../../knowledge-gaps/types";
import type { KnowledgeRequest } from "../../knowledge-request/types";
import type { ProjectAttention, ProjectOnboardingMetrics } from "../../onboarding-metrics/types";
import type { TeamOverviewUser } from "../../team-management/types";
import type { OnboardingFeedback } from "../../../services/teamManagementService";
import {
  AT_RISK_AFTER_DAYS,
  daysOnStep,
  memberName,
  memberStage,
  waitingOn,
} from "../memberStatus";
import { isUnread } from "../useMemberOpenItems";

/**
 * How much a finding asks of the manager. `good` is news worth knowing that asks nothing — a
 * clear inbox is part of the picture, not the absence of one.
 */
export type FindingSeverity = "critical" | "warning" | "info" | "good";

/** The part of the project a finding is about — and so the PM section it leads to. */
export type FindingArea =
  "team" | "onboarding" | "escalations" | "questions" | "gaps" | "ingestion" | "industry";

export type Finding = {
  id: string;
  severity: FindingSeverity;
  area: FindingArea;
  title: string;
  detail: string;
  /** Where the finding can be acted on. */
  to?: string;
};

/** One connected source, reduced to what the analysis reads off it. */
export type AnalysisSource = {
  name: string;
  errors: number;
  lastRunAt: string | null;
  /** The backend's connection state: `FAILED`, `OUT_OF_DATE`, `DISABLED`, … */
  backendStatus?: string;
};

export type AnalysisIndustry = {
  industry: string;
  confidence: "high" | "medium" | "low" | null;
  custom: boolean;
  /** Set when this run re-evaluated it: what it was before. */
  previous?: string | null;
};

/**
 * Everything one analysis read. Each part is `null` when its read failed — a finding is then
 * simply not made, rather than made from nothing (an empty inbox that could not be loaded is not
 * a clear inbox).
 */
export type AnalysisInput = {
  roster: TeamOverviewUser[] | null;
  /** Each flagged member's feedback, by user id. */
  feedbackByUser: Record<string, OnboardingFeedback[]>;
  metrics: ProjectOnboardingMetrics | null;
  attention: ProjectAttention | null;
  escalations: KnowledgeRequest[] | null;
  faq: FAQOverview | null;
  gaps: KnowledgeGapOverview | null;
  sources: AnalysisSource[] | null;
  industry: AnalysisIndustry | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;
/** A source that has not synced for this long is behind what the team is doing. */
export const STALE_SOURCE_DAYS = 7;
/** First reviews slower than this, for the slowest tenth, keep hires waiting. */
export const SLOW_REVIEW_HOURS = 48;

function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

function names(people: string[], limit = 3): string {
  if (people.length <= limit) return people.join(", ");
  return `${people.slice(0, limit).join(", ")} and ${people.length - limit} more`;
}

function teamFindings(
  roster: TeamOverviewUser[],
  feedbackByUser: Record<string, OnboardingFeedback[]>,
) {
  const findings: Finding[] = [];

  const skips = roster.filter((member) => waitingOn(member).includes("skip"));
  if (skips.length > 0) {
    findings.push({
      id: "team-skips",
      severity: "warning",
      area: "team",
      title: `${plural(skips.length, "skip request")} waiting for your answer`,
      detail: `${names(skips.map(memberName))} ${skips.length === 1 ? "is" : "are"} held on a step until you decide.`,
      to: skips.length === 1 ? `/team/${skips[0].userId}` : "/team-management?filter=attention",
    });
  }

  const withFeedback = roster.filter((member) => member.hasFeedback);
  const unreadCount = withFeedback.reduce(
    (sum, member) =>
      sum + Math.max(1, (feedbackByUser[member.userId] ?? []).filter(isUnread).length),
    0,
  );
  const thumbsDown = withFeedback.reduce(
    (sum, member) =>
      sum +
      (feedbackByUser[member.userId] ?? []).filter(
        (item) => isUnread(item) && item.helpful === false,
      ).length,
    0,
  );
  if (unreadCount > 0) {
    findings.push({
      id: "team-feedback",
      severity: thumbsDown > 0 ? "warning" : "info",
      area: "team",
      title: `${plural(unreadCount, "piece")} of unread feedback`,
      detail:
        thumbsDown > 0
          ? `${plural(thumbsDown, "step")} marked as not helpful — worth fixing before the next hire meets ${thumbsDown === 1 ? "it" : "them"}.`
          : `From ${names(withFeedback.map(memberName))}.`,
      to:
        withFeedback.length === 1
          ? `/team/${withFeedback[0].userId}`
          : "/team-management?filter=attention",
    });
  }

  const stuck = roster
    .filter((member) => memberStage(member) === "underway")
    .map((member) => ({ member, days: daysOnStep(member) }))
    .filter(
      (entry): entry is { member: TeamOverviewUser; days: number } =>
        entry.days !== null && entry.days > AT_RISK_AFTER_DAYS,
    )
    .sort((a, b) => b.days - a.days);
  if (stuck.length > 0) {
    findings.push({
      id: "team-stuck",
      severity: stuck[0].days > AT_RISK_AFTER_DAYS * 2 ? "critical" : "warning",
      area: "team",
      title: `${plural(stuck.length, "member")} stuck on a step for over ${AT_RISK_AFTER_DAYS} days`,
      detail: stuck
        .slice(0, 3)
        .map(({ member, days }) => `${memberName(member)} (${days} days)`)
        .join(", "),
      to: stuck.length === 1 ? `/team/${stuck[0].member.userId}` : "/team-management",
    });
  }

  const notStarted = roster.filter((member) => memberStage(member) === "not-started");
  if (notStarted.length > 0) {
    findings.push({
      id: "team-not-started",
      severity: "info",
      area: "team",
      title: `${plural(notStarted.length, "member")} ${notStarted.length === 1 ? "hasn't" : "haven't"} started onboarding`,
      detail: names(notStarted.map(memberName)),
      to: "/team-management",
    });
  }

  const noRole = roster.filter((member) => member.roles.length === 0);
  if (noRole.length > 0) {
    findings.push({
      id: "team-no-role",
      severity: "info",
      area: "team",
      title: `${plural(noRole.length, "member")} without a role`,
      detail: `A role decides which skills and steps a path is built from. ${names(noRole.map(memberName))}.`,
      to: noRole.length === 1 ? `/team/${noRole[0].userId}` : "/team-management",
    });
  }

  const done = roster.filter((member) => memberStage(member) === "done");
  if (done.length > 0) {
    findings.push({
      id: "team-done",
      severity: "good",
      area: "team",
      title: `${plural(done.length, "member")} through onboarding`,
      detail: `${Math.round((done.length / roster.length) * 100)}% of the team has finished the path.`,
      to: "/team-management",
    });
  }

  if (skips.length === 0 && unreadCount === 0 && roster.length > 0) {
    findings.push({
      id: "team-nothing-waiting",
      severity: "good",
      area: "team",
      title: "Nobody is waiting on you",
      detail: "No open skip requests and no unread feedback.",
    });
  }

  return findings;
}

function onboardingFindings(
  metrics: ProjectOnboardingMetrics | null,
  attention: ProjectAttention | null,
) {
  const findings: Finding[] = [];

  const blocked = attention?.items.filter((item) => item.severity === "BLOCKED") ?? [];
  const stalled = metrics?.hires.filter((hire) => hire.stalled) ?? [];
  const stalledNames = [
    ...new Set([
      ...blocked.map((item) => item.hireName),
      ...stalled.map((hire) => hire.displayName),
    ]),
  ];
  if (stalledNames.length > 0) {
    findings.push({
      id: "onboarding-stalled",
      severity: "critical",
      area: "onboarding",
      title: `${plural(stalledNames.length, "hire")} stalled`,
      detail: blocked[0]?.reason
        ? `${names(stalledNames)} — ${blocked[0].reason.charAt(0).toLowerCase()}${blocked[0].reason.slice(1)}.`
        : names(stalledNames),
      to: "/insights/onboarding",
    });
  }

  if (metrics && metrics.waitingOnResponseCount > 0) {
    findings.push({
      id: "onboarding-waiting-review",
      severity: "warning",
      area: "onboarding",
      title: `${plural(metrics.waitingOnResponseCount, "contribution")} waiting on a review`,
      detail: "A first contribution left waiting is the slowest part of most onboardings.",
      to: "/insights/onboarding",
    });
  }

  if (
    metrics?.p90HoursToFirstResponse !== null &&
    metrics?.p90HoursToFirstResponse !== undefined &&
    metrics.p90HoursToFirstResponse > SLOW_REVIEW_HOURS
  ) {
    findings.push({
      id: "onboarding-slow-review",
      severity: "info",
      area: "onboarding",
      title: "First reviews are slow in the tail",
      detail: `The slowest tenth of first reviews took over ${Math.round(metrics.p90HoursToFirstResponse / 24)} days.`,
      to: "/insights/onboarding",
    });
  }

  if (metrics && metrics.unattributableMemberCount > 0) {
    findings.push({
      id: "onboarding-unattributable",
      severity: "info",
      area: "onboarding",
      title: `${plural(metrics.unattributableMemberCount, "member")} without a GitHub login`,
      detail: "Their pull requests cannot be counted towards their onboarding.",
      to: "/insights/onboarding",
    });
  }

  if (metrics && metrics.hiresWithAcceptedContribution > 0) {
    findings.push({
      id: "onboarding-accepted",
      severity: "good",
      area: "onboarding",
      title: `${plural(metrics.hiresWithAcceptedContribution, "hire")} had work accepted`,
      detail: `Out of ${plural(metrics.memberCount, "hire")} on the project.`,
      to: "/insights/onboarding",
    });
  }

  return findings;
}

function escalationFindings(escalations: KnowledgeRequest[]) {
  if (escalations.length === 0) {
    return [
      {
        id: "escalations-clear",
        severity: "good",
        area: "escalations",
        title: "Escalation inbox is clear",
        detail: "Every question the buddy could not answer has been answered.",
      } satisfies Finding,
    ];
  }

  const oldest = [...escalations].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )[0];
  const waitedDays = Math.floor((Date.now() - new Date(oldest.createdAt).getTime()) / DAY_MS);

  return [
    {
      id: "escalations-open",
      severity: waitedDays >= 1 ? "warning" : "info",
      area: "escalations",
      title: `${plural(escalations.length, "question")} waiting for a person`,
      detail:
        waitedDays >= 1
          ? `The oldest has waited ${plural(waitedDays, "day")}: “${oldest.question}”`
          : `Asked today: “${oldest.question}”`,
      to: "/insights/knowledge-requests",
    } satisfies Finding,
  ];
}

function questionFindings(faq: FAQOverview) {
  const rising = faq.groups.filter((group) => group.trend === "RISING");
  if (rising.length === 0) {
    return faq.groups.length > 0
      ? [
          {
            id: "questions-steady",
            severity: "good",
            area: "questions",
            title: "No question is on the rise",
            detail: `${plural(faq.groups.length, "recurring question")} tracked, none asked noticeably more often lately.`,
            to: "/insights/faq",
          } satisfies Finding,
        ]
      : [];
  }

  const top = [...rising].sort((a, b) => (b.recentCount ?? 0) - (a.recentCount ?? 0))[0];
  return [
    {
      id: "questions-rising",
      severity: rising.length > 2 ? "warning" : "info",
      area: "questions",
      title: `${plural(rising.length, "question")} asked more and more`,
      detail: `Top: “${top.title}”${top.recentCount ? ` — ${top.recentCount} times lately` : ""}. A doc could answer it once.`,
      to: `/insights/faq/${top.groupId}`,
    } satisfies Finding,
  ];
}

function gapFindings(overview: KnowledgeGapOverview) {
  const gaps = overview.gaps.filter((gap) => gap.severity !== "covered");
  const findings: Finding[] = [];
  const high = gaps.filter((gap) => gap.severity === "high");
  const medium = gaps.filter((gap) => gap.severity === "medium");

  if (high.length > 0) {
    findings.push({
      id: "gaps-high",
      severity: "critical",
      area: "gaps",
      title: `${plural(high.length, "component")} barely documented`,
      detail: high
        .slice(0, 3)
        .map((gap) => `${gap.component} (missing ${gap.missingTypes.join(", ")})`)
        .join("; "),
      to: high.length === 1 ? `/insights/knowledge-gaps/${high[0].id}` : "/insights/knowledge-gaps",
    });
  }
  if (medium.length > 0) {
    findings.push({
      id: "gaps-medium",
      severity: "warning",
      area: "gaps",
      title: `${plural(medium.length, "component")} with documentation missing`,
      detail: names(medium.map((gap) => gap.component)),
      to: "/insights/knowledge-gaps",
    });
  }

  const unowned = gaps.filter((gap) => gap.owners.length === 0);
  if (unowned.length > 0) {
    findings.push({
      id: "gaps-unowned",
      severity: "info",
      area: "gaps",
      title: `${plural(unowned.length, "gap")} without an owner`,
      detail: "Nobody is named to close them yet.",
      to: "/insights/knowledge-gaps",
    });
  }

  if (gaps.length === 0 && overview.gaps.length > 0) {
    findings.push({
      id: "gaps-none",
      severity: "good",
      area: "gaps",
      title: "Every component is documented",
      detail: "The scan found nothing missing.",
      to: "/insights/knowledge-gaps",
    });
  }

  return findings;
}

function ingestionFindings(sources: AnalysisSource[]) {
  if (sources.length === 0) {
    return [
      {
        id: "ingestion-none",
        severity: "warning",
        area: "ingestion",
        title: "No sources connected",
        detail:
          "Without a repository or tracker the buddy has nothing project-specific to answer from.",
        to: "/data-ingestion",
      } satisfies Finding,
    ];
  }

  const findings: Finding[] = [];
  const failing = sources.filter(
    (source) => source.errors > 0 || source.backendStatus === "FAILED",
  );
  if (failing.length > 0) {
    findings.push({
      id: "ingestion-errors",
      severity: "critical",
      area: "ingestion",
      title: `${plural(failing.length, "source")} failing to sync`,
      detail: failing
        .map((source) =>
          source.errors > 0 ? `${source.name} (${plural(source.errors, "error")})` : source.name,
        )
        .join(", "),
      to: "/data-ingestion",
    });
  }

  const neverSynced = sources.filter((source) => source.lastRunAt === null);
  if (neverSynced.length > 0) {
    findings.push({
      id: "ingestion-never",
      severity: "warning",
      area: "ingestion",
      title: `${plural(neverSynced.length, "source")} never synced`,
      detail: names(neverSynced.map((source) => source.name)),
      to: "/data-ingestion",
    });
  }

  const stale = sources.filter(
    (source) =>
      source.lastRunAt !== null &&
      Date.now() - new Date(source.lastRunAt).getTime() > STALE_SOURCE_DAYS * DAY_MS,
  );
  if (stale.length > 0) {
    findings.push({
      id: "ingestion-stale",
      severity: "info",
      area: "ingestion",
      title: `${plural(stale.length, "source")} not synced for over a week`,
      detail: `${names(stale.map((source) => source.name))} — answers may be behind the code.`,
      to: "/data-ingestion",
    });
  }

  if (findings.length === 0) {
    findings.push({
      id: "ingestion-healthy",
      severity: "good",
      area: "ingestion",
      title: `All ${plural(sources.length, "source")} in sync`,
      detail: "The buddy is answering from current material.",
      to: "/data-ingestion",
    });
  }

  return findings;
}

function industryFindings(industry: AnalysisIndustry) {
  if (!industry.industry.trim()) {
    return [
      {
        id: "industry-missing",
        severity: "warning",
        area: "industry",
        title: "The project's industry is unknown",
        detail: "Paths and answers are tailored to it — set it by hand or let it be evaluated.",
      } satisfies Finding,
    ];
  }

  if (industry.previous !== undefined && industry.previous !== industry.industry) {
    return [
      {
        id: "industry-changed",
        severity: "info",
        area: "industry",
        title: `Industry re-evaluated: ${industry.industry}`,
        detail: industry.previous
          ? `It was “${industry.previous}” before.`
          : "It was not determined before.",
      } satisfies Finding,
    ];
  }

  if (!industry.custom && industry.confidence === "low") {
    return [
      {
        id: "industry-low-confidence",
        severity: "info",
        area: "industry",
        title: `Industry uncertain: ${industry.industry}`,
        detail: "The evaluation was not confident. Worth a look, or set it by hand.",
      } satisfies Finding,
    ];
  }

  return [];
}

const SEVERITY_RANK: Record<FindingSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
  good: 3,
};

/** Every finding the data supports, most pressing first. */
export function buildFindings(input: AnalysisInput): Finding[] {
  const findings = [
    ...(input.roster ? teamFindings(input.roster, input.feedbackByUser) : []),
    ...(input.metrics || input.attention ? onboardingFindings(input.metrics, input.attention) : []),
    ...(input.escalations ? escalationFindings(input.escalations) : []),
    ...(input.faq ? questionFindings(input.faq) : []),
    ...(input.gaps ? gapFindings(input.gaps) : []),
    ...(input.sources ? ingestionFindings(input.sources) : []),
    ...(input.industry ? industryFindings(input.industry) : []),
  ];

  return findings
    .map((finding, index) => ({ finding, index }))
    .sort(
      (a, b) =>
        SEVERITY_RANK[a.finding.severity] - SEVERITY_RANK[b.finding.severity] || a.index - b.index,
    )
    .map(({ finding }) => finding);
}

/** What the worst open finding of an area costs the score. Good news costs nothing. */
const AREA_PENALTY: Record<FindingSeverity, number> = {
  critical: 12,
  warning: 6,
  info: 2,
  good: 0,
};
/** What every further open finding in the same area adds on top. */
const EXTRA_PENALTY = 1;

/**
 * A 0–100 reading of how much the project needs its manager right now: 100 is nothing open.
 *
 * Counted per area rather than per finding: each area costs what its worst finding costs, plus a
 * point for every further one. Summing every finding at full weight sent a project with a few
 * ordinary loose ends straight to zero, where a score says nothing any more. Still simple enough
 * to explain — every point off is a finding on the list.
 */
export function healthScore(findings: readonly Finding[]): number {
  const penalty = [...pointsLostByArea(findings).values()].reduce((sum, points) => sum + points, 0);
  return Math.max(0, Math.min(100, 100 - penalty));
}

/**
 * What each area cost the score, by the rule {@link healthScore} documents — the explanation of
 * a score, area by area. Areas with nothing open are left out.
 */
export function pointsLostByArea(findings: readonly Finding[]): Map<FindingArea, number> {
  const byArea = new Map<FindingArea, Finding[]>();
  for (const finding of findings) {
    if (finding.severity === "good") continue;
    byArea.set(finding.area, [...(byArea.get(finding.area) ?? []), finding]);
  }

  const lost = new Map<FindingArea, number>();
  for (const [area, open] of byArea) {
    const worst = Math.max(...open.map((finding) => AREA_PENALTY[finding.severity]));
    lost.set(area, worst + (open.length - 1) * EXTRA_PENALTY);
  }
  return lost;
}

/** The one-line verdict shown next to a {@link healthScore}. */
export function scoreVerdict(score: number): string {
  if (score >= 85) return "In great shape";
  if (score >= 65) return "Mostly on track";
  if (score >= 40) return "Needs your attention";
  return "Needs you now";
}

export function countBySeverity(findings: readonly Finding[]): Record<FindingSeverity, number> {
  return findings.reduce(
    (counts, finding) => ({ ...counts, [finding.severity]: counts[finding.severity] + 1 }),
    { critical: 0, warning: 0, info: 0, good: 0 } as Record<FindingSeverity, number>,
  );
}
