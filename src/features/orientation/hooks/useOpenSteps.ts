import { useCallback, useState } from "react";
import type { OrientationStep } from "../types";

const STORAGE_PREFIX = "sprintstart.orientation.openSteps";

function storageKey(taskId: string): string {
  return `${STORAGE_PREFIX}.${taskId}`;
}

function readStored(taskId: string): OrientationStep[] | null {
  try {
    const raw = window.localStorage.getItem(storageKey(taskId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OrientationStep[]) : null;
  } catch {
    return null;
  }
}

function store(taskId: string, steps: OrientationStep[]) {
  try {
    window.localStorage.setItem(storageKey(taskId), JSON.stringify(steps));
  } catch {
    // Which sections are open is a convenience. Ignore storage failures.
  }
}

/**
 * Which orientation steps are expanded, remembered per task across visits.
 *
 * A hire returning on day three should not have to scroll past setup again, so
 * the *first* visit opens only the first step and everything after that is
 * whatever they left open. Keyed by task rather than globally: a different task
 * is a different problem, and its setup may genuinely need re-reading.
 *
 * @param taskId The task the packet belongs to.
 * @param firstStep The step to open on a first visit, when nothing is stored.
 */
export function useOpenSteps(taskId: string, firstStep: OrientationStep | undefined) {
  const [openSteps, setOpenSteps] = useState<OrientationStep[]>(
    () => readStored(taskId) ?? (firstStep ? [firstStep] : []),
  );

  const toggle = useCallback(
    (step: OrientationStep) => {
      setOpenSteps((current) => {
        const next = current.includes(step)
          ? current.filter((s) => s !== step)
          : [...current, step];
        store(taskId, next);
        return next;
      });
    },
    [taskId],
  );

  const isOpen = useCallback((step: OrientationStep) => openSteps.includes(step), [openSteps]);

  return { isOpen, toggle };
}
