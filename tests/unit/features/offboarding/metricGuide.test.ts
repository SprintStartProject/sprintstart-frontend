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
  it("goes through the ten metrics of the selection in order, then the score", () => {
    const steps = describeMetrics(file, map);

    expect(steps.map((step) => step.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, null]);
    expect(steps.map((step) => step.id)).toEqual([
      "E4",
      "A3 + A6 + E1",
      "C3",
      "C1 (A4)",
      "B6 + C6",
      "D1 + E3",
      "D2 (D7)",
      "D5",
      "C7",
      "C8",
      "Score",
    ]);
  });

  it("explains why the prototype uses every metric", () => {
    expect(describeMetrics(file, map).every((step) => step.why.length > 20)).toBe(true);
  });

  it("puts the numbers of the file into the departure simulation", () => {
    const step = describeMetrics(file, map).find((candidate) => candidate.number === 9);

    expect(step?.measured).toBe("Leaving: ada. 0.7 × 60% + 0.3 × 80% = 66%.");
  });

  it("says who still knows a file that hangs on one person", () => {
    const step = describeMetrics(file, map).find((candidate) => candidate.number === 3);

    expect(step?.measured).toContain("ben");
    expect(step?.value).toBe(0.75);
  });

  it("derives the fractal value from the effective number of knowers", () => {
    const step = describeMetrics(file, map).find((candidate) => candidate.number === 5);

    expect(step?.measured).toContain("FV 0.20, so 1.3 effective knowers");
  });

  it("names the knowledge model that was used", () => {
    const timeWeighted = {
      ...map,
      settings: {
        ...map.settings,
        knowledge: { model: "time-weighted" as const, knowsAtLeast: 1, foundingBonus: 3 },
      },
    };

    expect(describeMetrics(file, map)[1].how).toContain("uses authorship");
    expect(describeMetrics(file, timeWeighted)[1].how).toContain("reaches 1");
  });

  it("says plainly what was not measured instead of inventing a number", () => {
    const bare = { ...file, abandonedShare: null, hotspot: null, coupling: null, successors: [] };
    const steps = describeMetrics(bare, map);

    expect(steps.find((step) => step.number === 4)?.measured).toMatch(/never blamed/);
    expect(steps.find((step) => step.number === 7)?.measured).toMatch(/never read/);
    expect(steps.find((step) => step.number === 8)?.measured).toMatch(/No partner/);
    expect(steps.find((step) => step.number === 10)?.measured).toMatch(/Nobody/);
  });

  it("leaves out the metrics a stored map never measured", () => {
    const old = { ...file, concentration: null, placeholderScore: null };
    const ids = describeMetrics(old, map).map((step) => step.id);

    expect(ids).not.toContain("B6 + C6");
    expect(ids).not.toContain("Score");
  });

  it("recovers the relevance the placeholder score was scaled by", () => {
    const step = describeMetrics(file, map).find((candidate) => candidate.id === "Score");

    expect(step?.measured).toMatch(
      /^Knowledge at risk 6\d% × \(0\.25 \+ 0\.75 × relevance \d+%\) = 40%$/,
    );
  });
});
