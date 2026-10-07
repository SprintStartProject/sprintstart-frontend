import { describe, it, expect } from "vitest";
import {
  buildFindings,
  healthScore,
  pointsLostByArea,
  scoreVerdict,
  type AnalysisInput,
  type Finding,
} from "../../../../../src/features/pm-area/analysis/findings";
import type { TeamOverviewUser } from "../../../../../src/features/team-management/types";

const DAY = 24 * 60 * 60 * 1000;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

function member(overrides: Partial<TeamOverviewUser> = {}): TeamOverviewUser {
  return {
    userId: "u1",
    firstname: "Ada",
    lastname: "Lovelace",
    projects: [],
    roles: [{ id: "r1", name: "Backend", description: "" }],
    skills: [],
    progressPercentage: 0.5,
    currentPhase: { id: "p1", title: "Setup" },
    currentStep: { id: "s1", title: "Set up CI", startedAt: ago(1 * DAY), skip: null },
    hasFeedback: false,
    ...overrides,
  };
}

function input(overrides: Partial<AnalysisInput> = {}): AnalysisInput {
  return {
    roster: null,
    feedbackByUser: {},
    metrics: null,
    attention: null,
    escalations: null,
    faq: null,
    gaps: null,
    sources: null,
    industry: null,
    ...overrides,
  };
}

const ids = (findings: Finding[]) => findings.map((finding) => finding.id);

describe("buildFindings", () => {
  it("calls out skip requests, unread feedback and members stuck on a step", () => {
    const findings = buildFindings(
      input({
        roster: [
          member({
            currentStep: {
              id: "s1",
              title: "Set up CI",
              startedAt: ago(1 * DAY),
              skip: {
                id: "k1",
                stepId: "s1",
                reason: "Done it before",
                status: "PENDING",
                reviewComment: null,
                reviewedAt: null,
              },
            },
          }),
          member({
            userId: "u2",
            firstname: "Ben",
            hasFeedback: true,
            currentStep: { id: "s2", title: "Read docs", startedAt: ago(12 * DAY), skip: null },
          }),
        ],
        feedbackByUser: {
          u2: [{ id: "f1", message: "Outdated", helpful: false, read: false }],
        },
      }),
    );

    expect(ids(findings)).toEqual(
      expect.arrayContaining(["team-skips", "team-feedback", "team-stuck"]),
    );
    const stuck = findings.find((finding) => finding.id === "team-stuck");
    // Twelve days is more than twice the limit: critical, and it leads the list.
    expect(stuck?.severity).toBe("critical");
    expect(findings[0].id).toBe("team-stuck");
    expect(findings.find((finding) => finding.id === "team-feedback")?.severity).toBe("warning");
    // One person with a skip request goes straight to their profile.
    expect(findings.find((finding) => finding.id === "team-skips")?.to).toBe("/team/u1");
  });

  it("says so when nothing is waiting, rather than saying nothing", () => {
    const findings = buildFindings(input({ roster: [member()], escalations: [], sources: [] }));

    expect(ids(findings)).toContain("team-nothing-waiting");
    expect(ids(findings)).toContain("escalations-clear");
    // No sources at all is a problem, not a clear bill of health.
    expect(findings.find((finding) => finding.id === "ingestion-none")?.severity).toBe("warning");
  });

  it("makes no finding from a read that failed", () => {
    // `null` is a failed read: an inbox that could not be loaded is not a clear inbox.
    expect(buildFindings(input())).toEqual([]);
  });

  it("reads failing, never-synced and stale sources apart", () => {
    const findings = buildFindings(
      input({
        sources: [
          { name: "api", errors: 2, lastRunAt: ago(1 * DAY), backendStatus: "CONNECTED" },
          { name: "web", errors: 0, lastRunAt: null, backendStatus: "CONNECTED" },
          { name: "docs", errors: 0, lastRunAt: ago(20 * DAY), backendStatus: "CONNECTED" },
        ],
      }),
    );

    expect(ids(findings)).toEqual(["ingestion-errors", "ingestion-never", "ingestion-stale"]);
  });

  it("ranks documentation gaps by severity and notices the ones nobody owns", () => {
    const gap = (id: string, severity: "high" | "medium" | "low" | "covered") => ({
      id,
      component: id,
      missingTypes: severity === "covered" ? [] : ["readme"],
      lastIngested: ago(DAY),
      refreshedAt: ago(DAY),
      owners: [],
      severity,
    });
    const findings = buildFindings(
      input({
        gaps: { gaps: [gap("billing", "high"), gap("auth", "medium"), gap("docs", "covered")] },
      }),
    );

    expect(ids(findings)).toEqual(["gaps-high", "gaps-medium", "gaps-unowned"]);
    expect(findings[0].to).toBe("/insights/knowledge-gaps/billing");
  });

  it("notices gaps computed before the latest import", () => {
    const behind = buildFindings(
      input({
        gaps: { gaps: [], refreshedAt: ago(2 * DAY) },
        sources: [{ name: "api", errors: 0, lastRunAt: ago(1 * DAY) }],
      }),
    );
    expect(ids(behind)).toContain("gaps-behind");

    const current = buildFindings(
      input({
        gaps: { gaps: [], refreshedAt: ago(1 * DAY) },
        sources: [{ name: "api", errors: 0, lastRunAt: ago(2 * DAY) }],
      }),
    );
    expect(ids(current)).not.toContain("gaps-behind");
  });

  it("does not guess about the gaps' age when the sources could not be read", () => {
    const findings = buildFindings(input({ gaps: { gaps: [], refreshedAt: ago(30 * DAY) } }));
    expect(ids(findings)).not.toContain("gaps-behind");
  });

  it("reports a re-evaluated industry only when it changed", () => {
    const changed = buildFindings(
      input({
        industry: { industry: "Fintech", confidence: "high", custom: false, previous: "Retail" },
      }),
    );
    const same = buildFindings(
      input({
        industry: { industry: "Fintech", confidence: "high", custom: false, previous: "Fintech" },
      }),
    );

    expect(ids(changed)).toEqual(["industry-changed"]);
    expect(same).toEqual([]);
  });
});

describe("healthScore", () => {
  const finding = (id: string, area: Finding["area"], severity: Finding["severity"]): Finding => ({
    id,
    area,
    severity,
    title: id,
    detail: "",
  });

  it("is 100 with nothing open, whatever the good news", () => {
    expect(healthScore([finding("a", "team", "good")])).toBe(100);
  });

  it("charges each area its worst finding, and a point for every further one", () => {
    expect(
      healthScore([
        finding("a", "team", "critical"),
        finding("b", "team", "warning"),
        finding("c", "team", "info"),
        finding("d", "gaps", "warning"),
      ]),
    ).toBe(100 - (12 + 2) - 6);
  });

  it("explains itself area by area, with nothing charged for good news", () => {
    const lost = pointsLostByArea([
      finding("a", "team", "critical"),
      finding("b", "team", "info"),
      finding("c", "gaps", "warning"),
      finding("d", "ingestion", "good"),
    ]);

    expect(Object.fromEntries(lost)).toEqual({ team: 13, gaps: 6 });
  });

  it("never goes below zero", () => {
    const areas = [
      "team",
      "onboarding",
      "escalations",
      "questions",
      "gaps",
      "ingestion",
      "industry",
    ] as const;
    const many = Array.from({ length: 100 }, (_, index) =>
      finding(`f${index}`, areas[index % areas.length], "critical"),
    );
    expect(healthScore(many)).toBe(0);
  });

  it("puts the score into words", () => {
    expect(scoreVerdict(92)).toBe("In great shape");
    expect(scoreVerdict(70)).toBe("Mostly on track");
    expect(scoreVerdict(50)).toBe("Needs your attention");
    expect(scoreVerdict(10)).toBe("Needs you now");
  });
});
