import { useEffect, useState } from "react";
import type {
  OnboardingPathEndpoint,
  OnboardingTaskEndpoint,
} from "../../services/onboardingTypes";
import { getOnboardingTasksByStep } from "../../services/teamManagementService";
import { taskCount, type TaskCount } from "./memberRules";

/**
 * Reads the tasks of every step of the path, settled rather than all-or-nothing: one step's
 * request failing blanked every count on the page, including the ones just read.
 */
async function readTasksByStep(stepIds: string[]) {
  const results = await Promise.allSettled(
    stepIds.map(async (stepId) => [stepId, await getOnboardingTasksByStep(stepId)] as const),
  );
  const failures = results.filter((result) => result.status === "rejected");
  if (failures.length > 0) {
    console.error(
      `Failed to load the tasks of ${failures.length} of ${stepIds.length} steps:`,
      failures[0].reason,
    );
  }

  return results.filter((result) => result.status === "fulfilled").map((result) => result.value);
}

/** The tasks of each step of the path and how many are done; re-read on every path change. */
export function useStepTasks(path: OnboardingPathEndpoint | null) {
  const [tasksById, setTasksById] = useState<Record<string, OnboardingTaskEndpoint[]>>({});
  const [counts, setCounts] = useState<Record<string, TaskCount>>({});

  useEffect(() => {
    // An older run finishing last must not win.
    let cancelled = false;

    async function load() {
      const steps = path?.phases.flatMap((phase) => phase.steps ?? []) ?? [];

      if (steps.length === 0) {
        // Cleared together: leaving the lists behind meant the previous member's tasks survived a
        // switch to a member with no steps at all.
        setCounts({});
        setTasksById({});
        return;
      }

      const entries = await readTasksByStep(steps.map((step) => step.id));
      if (cancelled) return;
      setTasksById(Object.fromEntries(entries));
      setCounts(Object.fromEntries(entries.map(([stepId, tasks]) => [stepId, taskCount(tasks)])));
    }

    void load().catch((error: unknown) => {
      console.error("Failed to load the member's task counts:", error);
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  /** Reads one step's tasks again, after an edit. */
  async function refreshStepTasks(stepId: string) {
    const next = await getOnboardingTasksByStep(stepId);

    setTasksById((current) => ({ ...current, [stepId]: next }));
    setCounts((current) => ({ ...current, [stepId]: taskCount(next) }));

    return next;
  }

  return { tasksById, setTasksById, counts, refreshStepTasks };
}

export type StepTasks = ReturnType<typeof useStepTasks>;
