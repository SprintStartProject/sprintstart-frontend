import type { ArrivalStep } from "./types";

/**
 * How many distinct steps a hire actually sees once a project's overrides replace their
 * company-wide counterpart in place.
 *
 * A step a project overrides is still one entry on the hire's list, not two — it is a
 * replacement, not an addition. Shared by the arrival authoring screen and the Hire Setup
 * overview so the two never drift apart on what "one step" means.
 */
export function mergedStepCount(
  company: ArrivalStep[] | null,
  project: ArrivalStep[] | null,
): number {
  const companySteps = company ?? [];
  const projectSteps = project ?? [];
  const overriddenKeys = new Set(projectSteps.map((step) => step.key));
  return companySteps.filter((step) => !overriddenKeys.has(step.key)).length + projectSteps.length;
}
