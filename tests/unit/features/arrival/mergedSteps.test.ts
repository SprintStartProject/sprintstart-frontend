import { describe, it, expect } from "vitest";
import { mergedStepCount } from "../../../../src/features/arrival/mergedSteps";
import type { ArrivalStep } from "../../../../src/features/arrival/types";

const step = (key: string, projectId: string | null): ArrivalStep => ({
  key,
  projectId,
  projectName: null,
  title: key,
  description: null,
  href: null,
  position: 0,
  settledBy: "DECLARED",
  selfConfirmable: true,
  settled: false,
  settledAt: null,
  rigor: null,
});

describe("mergedStepCount", () => {
  it("is 0 for two empty lists", () => {
    expect(mergedStepCount([], [])).toBe(0);
  });

  it("treats null lists like empty ones", () => {
    expect(mergedStepCount(null, null)).toBe(0);
  });

  it("counts company and project steps together when their keys differ", () => {
    const company = [step("vpn", null), step("github-account", null)];
    const project = [step("staging", "p1")];

    expect(mergedStepCount(company, project)).toBe(3);
  });

  it("counts a project override as one step, not two", () => {
    const company = [step("vpn", null), step("github-account", null)];
    const project = [step("vpn", "p1")];

    expect(mergedStepCount(company, project)).toBe(2);
  });

  it("counts every project step even if every company step is overridden", () => {
    const company = [step("vpn", null)];
    const project = [step("vpn", "p1"), step("staging", "p1")];

    expect(mergedStepCount(company, project)).toBe(2);
  });
});
