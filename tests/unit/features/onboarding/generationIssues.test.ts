import { describe, expect, it } from "vitest";
import {
  groupIssues,
  issueStatusLabel,
  retryCouldHelp,
} from "../../../../src/features/onboarding/generationIssues";
import type { OnboardingGenerationIssueEndpoint } from "../../../../src/features/onboarding/types";

function issue(
  title: string,
  status: OnboardingGenerationIssueEndpoint["status"],
): OnboardingGenerationIssueEndpoint {
  return { phaseId: title, title, status };
}

describe("groupIssues", () => {
  it("gathers phases by what happened to them", () => {
    const groups = groupIssues([
      issue("Architecture", "FAILED"),
      issue("Deployment", "FAILED"),
      issue("Meetings", "SKIPPED"),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0].titles).toEqual(["Architecture", "Deployment"]);
    expect(groups[1].titles).toEqual(["Meetings"]);
  });

  it("reads what is broken before what is merely missing", () => {
    const groups = groupIssues([issue("A", "SKIPPED"), issue("B", "FAILED")]);

    expect(groups.map((group) => group.status)).toEqual(["FAILED", "SKIPPED"]);
  });

  it("leaves out an outcome nothing landed on", () => {
    const groups = groupIssues([issue("A", "TIMED_OUT")]);

    expect(groups.map((group) => group.status)).toEqual(["TIMED_OUT"]);
  });

  it("has nothing to say about nothing", () => {
    expect(groupIssues([])).toEqual([]);
  });
});

describe("retryCouldHelp", () => {
  it("is true when something could not be reached", () => {
    expect(retryCouldHelp([issue("A", "FAILED")])).toBe(true);
  });

  it("is true when something ran out of time", () => {
    expect(retryCouldHelp([issue("A", "TIMED_OUT")])).toBe(true);
  });

  it("is false when the project simply has no material for it", () => {
    // Re-running assembly against the same corpus produces the same answer, and offering it as
    // the obvious next action sends somebody round a loop that cannot end.
    expect(retryCouldHelp([issue("A", "SKIPPED"), issue("B", "EMPTY")])).toBe(false);
  });

  it("is true when one of several is worth another run", () => {
    expect(retryCouldHelp([issue("A", "SKIPPED"), issue("B", "FAILED")])).toBe(true);
  });
});

describe("issueStatusLabel", () => {
  it("keeps the four apart in a word", () => {
    const labels = (["FAILED", "TIMED_OUT", "EMPTY", "SKIPPED"] as const).map(issueStatusLabel);

    expect(new Set(labels).size).toBe(4);
  });
});
