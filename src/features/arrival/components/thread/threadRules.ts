import type { ArrivalScope, ArrivalStep } from "../../types";

const EMPTY_SET = new Set<string>();

/**
 * Below this, two rows swapping on every pointer-move frame would fight each other — the same
 * fix the board grid uses for the same kind of edge-docking jitter.
 */
export const MOVE_COOLDOWN_MS = 160;

export type StepEntry = {
  step: ArrivalStep;
  scope: ArrivalScope;
  /** A company step a project override shadows: kept in place, but off the count. */
  replaced: boolean;
  /** A project step that reuses a company step's key. */
  isOverride: boolean;
  /** Null for a replaced step — it never had a place of its own to count. */
  number: number | null;
  canMoveUp: boolean;
  canMoveDown: boolean;
};

export function sameKeys(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((key, index) => key === b[index]);
}

/**
 * Re-reads a list in a given key order; falls back to the original if the two disagree, which
 * only happens for a moment while a fresh load is still in flight.
 */
export function reorderByKeys(steps: ArrivalStep[], keys: string[]): ArrivalStep[] {
  if (keys.length !== steps.length) return steps;
  const byKey = new Map(steps.map((step) => [step.key, step]));
  const reordered = keys.map((key) => byKey.get(key));
  return reordered.every((step): step is ArrivalStep => step !== undefined) ? reordered : steps;
}

/**
 * A company step and the project step that overrides it share one key, so the key alone does not
 * identify a row — everything that addresses a single row goes through the scoped id instead.
 */
export function rowId(scope: ArrivalScope, key: string): string {
  return `${scope}:${key}`;
}

function centerOf(element: HTMLElement): { x: number; y: number } {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function contains(element: HTMLElement, x: number, y: number): boolean {
  const rect = element.getBoundingClientRect();
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

/**
 * Which other row in the same section the one in hand now sits over — by its measured center, not
 * by whichever element the pointer happens to be over. Null when it is over none, or when it has
 * not been measured.
 */
export function targetKeyUnder(
  order: string[],
  draggedKey: string,
  scope: ArrivalScope,
  elements: ReadonlyMap<string, HTMLElement>,
): string | null {
  const dragged = elements.get(rowId(scope, draggedKey));
  if (!dragged) return null;

  const { x, y } = centerOf(dragged);
  for (const candidateKey of order) {
    if (candidateKey === draggedKey) continue;
    const candidate = elements.get(rowId(scope, candidateKey));
    if (candidate && contains(candidate, x, y)) return candidateKey;
  }
  return null;
}

/** The company keys a project override shadows. Nothing is shadowed without a project. */
function overriddenKeysOf(projectSteps: ArrivalStep[], hasProject: boolean): Set<string> {
  return hasProject ? new Set(projectSteps.map((step) => step.key)) : EMPTY_SET;
}

type NumberingInput = {
  companySteps: ArrivalStep[];
  projectSteps: ArrivalStep[];
  overriddenKeys: Set<string>;
  hasProject: boolean;
};

/**
 * The numbers the hire sees, straight through both sections. A replaced company step carries none:
 * the project's own version, further down, is what counts.
 */
function numbering(input: NumberingInput): Map<string, number | null> {
  const numberByKey = new Map<string, number | null>();
  let running = 0;

  for (const step of input.companySteps) {
    numberByKey.set(step.key, input.overriddenKeys.has(step.key) ? null : ++running);
  }
  if (input.hasProject) {
    for (const step of input.projectSteps) {
      numberByKey.set(step.key, ++running);
    }
  }
  return numberByKey;
}

type EntriesInput = {
  /** The rows in the live order, which follows the pointer while a drag is in progress. */
  companySteps: ArrivalStep[];
  projectSteps: ArrivalStep[];
  /** The keys the server has, to tell an override from a step that only exists in one scope. */
  serverCompanyKeys: Set<string>;
  overriddenKeys: Set<string>;
  numberByKey: Map<string, number | null>;
  hasProject: boolean;
};

function companyEntriesOf(input: EntriesInput): StepEntry[] {
  const { companySteps, overriddenKeys, numberByKey } = input;

  return companySteps.map((step, index) => {
    const replaced = overriddenKeys.has(step.key);
    return {
      step,
      scope: "company",
      replaced,
      isOverride: false,
      number: numberByKey.get(step.key) ?? null,
      canMoveUp: !replaced && index > 0,
      canMoveDown: !replaced && index < companySteps.length - 1,
    };
  });
}

function projectEntriesOf(input: EntriesInput): StepEntry[] {
  if (!input.hasProject) return [];
  const { projectSteps, serverCompanyKeys, numberByKey } = input;

  return projectSteps.map((step, index) => ({
    step,
    scope: "project" as const,
    replaced: false,
    isOverride: serverCompanyKeys.has(step.key),
    number: numberByKey.get(step.key) ?? null,
    canMoveUp: index > 0,
    canMoveDown: index < projectSteps.length - 1,
  }));
}

type ModelInput = {
  /** What the server has. */
  companySteps: ArrivalStep[];
  projectSteps: ArrivalStep[];
  /** The rows in the live order, which follows the pointer while a drag is in progress. */
  liveCompanySteps: ArrivalStep[];
  liveProjectSteps: ArrivalStep[];
  draggingScope: ArrivalScope | null;
  hasProject: boolean;
};

/**
 * Both sections' rows as the thread draws them.
 *
 * Row *position* follows the live order the whole time a drag is in progress, so the section
 * reorders in real time as the pointer crosses other rows. The *numbers* stay put until the
 * pointer is actually released: they are read from the order the server still has while that scope
 * is being dragged, and only pick up the live order again once the drag ends — by then the final
 * order is already what the local order holds, so the badges jump straight to it.
 */
export function threadModel(input: ModelInput): { company: StepEntry[]; project: StepEntry[] } {
  const { hasProject, draggingScope } = input;
  const overriddenKeys = overriddenKeysOf(input.projectSteps, hasProject);
  const numberByKey = numbering({
    companySteps: draggingScope === "company" ? input.companySteps : input.liveCompanySteps,
    projectSteps: draggingScope === "project" ? input.projectSteps : input.liveProjectSteps,
    overriddenKeys,
    hasProject,
  });
  const entries: EntriesInput = {
    companySteps: input.liveCompanySteps,
    projectSteps: input.liveProjectSteps,
    serverCompanyKeys: new Set(input.companySteps.map((step) => step.key)),
    overriddenKeys,
    numberByKey,
    hasProject,
  };

  return { company: companyEntriesOf(entries), project: projectEntriesOf(entries) };
}
