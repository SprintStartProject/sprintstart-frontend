import { describe, expect, it } from "vitest";

import { describeMetrics } from "../../../../src/features/offboarding/metricGuide";
import type { FileRisk, RiskMap } from "../../../../src/services/offboardingTypes";

const file: FileRisk = {
  repository: "github:acme/app",
  path: "src/A.kt",
  level: "HOARDED",
  score: 0.7,
  departingShare: 0.6,
  sourceBreakdown: { commits: 0.6 },
  recentActivity: 0.8,
  fragmentation: 0.05,
  concentration: { effectiveKnowers: 1.25, island: "ben" },
  hotspot: 0.4,
  abandonedShare: 0.5,
  coupling: {
    sum: 1.2,
    partners: [{ repository: "github:acme/app", path: "src/B.kt", degree: 0.8 }],
  },
  successors: [{ person: "carol", score: 0.9 }],
  remainingKnowers: ["ben"],
  placeholderScore: 0.4,
  lastChangedAt: "2026-11-01T00:00:00Z",
};

const map: RiskMap = {
  asOf: "2026-11-24T00:00:00Z",
  settings: {
    halfLifeDays: 152,
    inactiveAfterDays: 365,
    authorThreshold: 0.75,
    knowledgeWeight: 0.7,
    activityWeight: 0.3,
    name: "default",
    sourceWeights: { commits: 1 },
  },
  departing: ["ada"],
  unknownDeparting: [],
  summary: { files: 10, orphaned: 0, hoarded: 1, alreadyOrphaned: 0, listed: 1 },
  files: [file],
};

describe("describeMetrics", () => {
  it("goes through every metric once, in order", () => {
    expect(describeMetrics(file, map).map((step) => step.id)).toEqual([
      "A1 / A3",
      "C3",
      "C7",
      "E4 / E5",
      "B6",
      "C6",
      "A4 / C1",
      "D2",
      "D5",
      "C8",
      "Selection",
    ]);
  });

  it("puts the numbers of the file into the departure score", () => {
    const step = describeMetrics(file, map).find((candidate) => candidate.id === "C7");

    expect(step?.measured).toBe("0.7 × 60% + 0.3 × 80% = 66%");
  });

  it("says who still knows a file that hangs on one person", () => {
    const step = describeMetrics(file, map).find((candidate) => candidate.id === "C3");

    expect(step?.measured).toContain("ben");
    expect(step?.value).toBe(0.75);
  });

  it("says plainly what was not measured instead of inventing a number", () => {
    const bare = { ...file, abandonedShare: null, hotspot: null, coupling: null, successors: [] };
    const steps = describeMetrics(bare, map);

    expect(steps.find((step) => step.id === "A4 / C1")?.measured).toMatch(/never blamed/);
    expect(steps.find((step) => step.id === "D2")?.measured).toMatch(/never read/);
    expect(steps.find((step) => step.id === "D5")?.measured).toMatch(/no partner/);
    expect(steps.find((step) => step.id === "C8")?.measured).toMatch(/Nobody/);
  });

  it("leaves out the metrics a stored map never measured", () => {
    const old = { ...file, concentration: null, placeholderScore: null };
    const ids = describeMetrics(old, map).map((step) => step.id);

    expect(ids).not.toContain("C6");
    expect(ids).not.toContain("Selection");
  });

  it("recovers the relevance the placeholder score was scaled by", () => {
    const step = describeMetrics(file, map).find((candidate) => candidate.id === "Selection");

    expect(step?.measured).toMatch(
      /^Knowledge at risk 6\d% × \(0\.25 \+ 0\.75 × relevance \d+%\) = 40%$/,
    );
  });
});
