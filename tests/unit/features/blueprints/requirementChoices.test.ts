import { describe, expect, it } from "vitest";
import { availableRequirementChoices } from "../../../../src/features/blueprints/requirementChoices.ts";
import { mapPhase } from "../../../../src/features/blueprints/pathTransforms.ts";
import type { BlueprintPath, BlueprintPhase } from "../../../../src/features/blueprints/types.ts";

const catalog = {
  skills: [
    { id: "s1", name: "Kotlin" },
    { id: "s2", name: "SQL" },
  ],
  projectRoles: [
    { id: "r1", name: "Reviewer" },
    { id: "r2", name: "Lead" },
  ],
};

function phaseWith(...requirements: { referenceId: string; type: "SKILL" | "PROJECT_ROLE" }[]) {
  return { id: "ph", requirements } as unknown as BlueprintPhase;
}

describe("availableRequirementChoices", () => {
  it("offers every skill when the phase requires none", () => {
    expect(availableRequirementChoices(phaseWith(), "SKILL", catalog)).toEqual(catalog.skills);
  });

  it("leaves out the skills the phase already requires", () => {
    const phase = phaseWith({ referenceId: "s1", type: "SKILL" });
    expect(availableRequirementChoices(phase, "SKILL", catalog)).toEqual([catalog.skills[1]]);
  });

  it("offers project roles when asked, minus the ones already required", () => {
    const phase = phaseWith({ referenceId: "r2", type: "PROJECT_ROLE" });
    expect(availableRequirementChoices(phase, "PROJECT_ROLE", catalog)).toEqual([
      catalog.projectRoles[0],
    ]);
  });

  it("does not confuse a skill with a role that shares its id", () => {
    const phase = phaseWith({ referenceId: "s1", type: "PROJECT_ROLE" });
    expect(availableRequirementChoices(phase, "SKILL", catalog)).toEqual(catalog.skills);
  });

  it("offers nothing before the catalog has loaded or without a phase", () => {
    expect(availableRequirementChoices(phaseWith(), "SKILL", null)).toEqual([]);
    expect(availableRequirementChoices(phaseWith(), "PROJECT_ROLE", null)).toEqual([]);
    expect(availableRequirementChoices(undefined, "SKILL", catalog)).toEqual(catalog.skills);
  });

  it("treats a phase without a requirements list as having none", () => {
    const phase = { id: "ph" } as unknown as BlueprintPhase;
    expect(availableRequirementChoices(phase, "SKILL", catalog)).toEqual(catalog.skills);
  });
});

describe("mapPhase", () => {
  const path = {
    id: "p",
    title: "T",
    blueprintPhases: [
      { id: "a", title: "A" },
      { id: "b", title: "B" },
    ],
  } as unknown as BlueprintPath;

  it("changes only the named phase", () => {
    const next = mapPhase(path, "b", (phase) => ({ ...phase, title: "B2" }));
    expect(next.blueprintPhases.map((phase) => phase.title)).toEqual(["A", "B2"]);
    expect(next.blueprintPhases[0]).toBe(path.blueprintPhases[0]);
    expect(next.title).toBe("T");
  });

  it("leaves the path alone when no phase has that id", () => {
    const next = mapPhase(path, "zzz", (phase) => ({ ...phase, title: "X" }));
    expect(next.blueprintPhases.map((phase) => phase.title)).toEqual(["A", "B"]);
  });
});
