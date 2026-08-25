import { describe, it, expect } from "vitest";
import { groupByScope } from "../../../../src/features/arrival/scopeGroups";
import type { ArrivalStep } from "../../../../src/features/arrival/types";

const step = (key: string, projectName: string | null): ArrivalStep => ({
  key,
  projectId: projectName === null ? null : `id-${projectName}`,
  projectName,
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

describe("groupByScope", () => {
  it("splits company steps from each project", () => {
    const groups = groupByScope([
      step("vpn", null),
      step("github", null),
      step("staging", "Apollo"),
      step("runbook", "Orion"),
    ]);

    expect(groups.map((group) => group.projectName)).toEqual([null, "Apollo", "Orion"]);
    expect(groups[0].steps.map((one) => one.key)).toEqual(["vpn", "github"]);
  });

  /**
   * The server already ordered this list — company first, then each project by name, position
   * within a scope. Re-deriving that here would give the card its own opinion, and the two would
   * drift the first time either changed.
   */
  it("preserves the order it was given rather than sorting", () => {
    const groups = groupByScope([
      step("runbook", "Orion"),
      step("vpn", null),
      step("staging", "Apollo"),
    ]);

    expect(groups.map((group) => group.projectName)).toEqual(["Orion", null, "Apollo"]);
  });

  it("is empty for an empty list", () => {
    expect(groupByScope([])).toEqual([]);
  });

  it("keeps one group when everything is company-wide", () => {
    const groups = groupByScope([step("vpn", null), step("github", null)]);

    expect(groups).toHaveLength(1);
    expect(groups[0].projectName).toBeNull();
  });
});
