import type { ArrivalStep } from "./types";

/** One scope's steps: `projectName` is null for the company-wide block. */
export type ArrivalScopeGroup = {
  projectName: string | null;
  steps: ArrivalStep[];
};

/**
 * Splits a hire's arrival list into scope blocks, preserving the order it arrived in.
 *
 * This must never sort. The backend already decided the order, and a second opinion about
 * it would drift the first time either side changed. Grouping *consecutive runs* rather than
 * collecting by key is the same rule: if the server sends a scope in two pieces, two headings is
 * the honest rendering of what it sent.
 *
 * @param steps The hire's steps, in server order.
 * @returns One group per consecutive run of the same scope. Empty in, empty out.
 */
export function groupByScope(steps: ArrivalStep[]): ArrivalScopeGroup[] {
  const groups: ArrivalScopeGroup[] = [];

  for (const step of steps) {
    const last = groups[groups.length - 1];
    if (last && last.projectName === step.projectName) {
      last.steps.push(step);
    } else {
      groups.push({ projectName: step.projectName, steps: [step] });
    }
  }

  return groups;
}
