import { apiClient } from "../apiClient";
import type {
  OnboardingPhaseEndpoint,
  OnboardingPathEndpoint,
  OnboardingStepEndpoint,
  OnboardingTaskEndpoint,
  StepType,
} from "./featureTypes";

/**
 * One member's onboarding path, for a reviewer looking at it.
 *
 * The endpoint answers with the path *as its owner has it* — phases with their steps and their
 * questions, each carrying that member's own status — so the hydration below is a fallback for a
 * thin response.
 *
 * **Every phase is normalised before it leaves here**: three surfaces read `phase.questions`
 * because the type promises it, and a missing array would be a TypeError. A missing array is filled
 * at the boundary where untrusted JSON becomes a typed object — which is the only place a default
 * belongs, and the reason no caller downstream has to defend itself against the same thing again.
 *
 * @returns The path, or `null` when the path cannot be loaded at all (including when the user
 *   has none). A phase whose steps fail to load is returned with an empty step list.
 */
export async function getUserOnboardingPath(
  userId: string,
): Promise<OnboardingPathEndpoint | null> {
  try {
    const path = await apiClient.fetch<OnboardingPathEndpoint>(
      `/api/v1/onboarding/users/${userId}/path`,
    );

    const phases =
      path.phases?.length > 0
        ? path.phases
        : await apiClient.fetch<OnboardingPhaseEndpoint[]>(
            `/api/v1/onboarding/users/${userId}/path/phases`,
          );

    const hydratedPhases = await Promise.all(
      phases.map(async (phase) => {
        // Questions cannot be hydrated the way steps can: no endpoint hands out one member's
        // questions with their status. An empty list is the honest stand-in, and it keeps the page
        // standing instead of taking it down.
        const normalised = { ...phase, questions: phase.questions ?? [] };
        if (normalised.steps?.length > 0) return normalised;

        try {
          const steps = await apiClient.fetch<OnboardingStepEndpoint[]>(
            `/api/v1/onboarding/phases/${phase.id}/steps`,
          );

          return { ...normalised, steps };
        } catch {
          return { ...normalised, steps: [] };
        }
      }),
    );

    return {
      ...path,
      phases: hydratedPhases,
    };
  } catch {
    return null;
  }
}

export type CreateOnboardingStepRequest = {
  position: number;
  isAiAssisted?: boolean;
  title: string;
  description: string;
  type: StepType;
  estimatedMinutes: number;
  expectedOutcome?: string;
};

export type UpdateOnboardingStepRequest = CreateOnboardingStepRequest & {
  status?: string;
  skip?: unknown;
};

export type CreateOnboardingTaskRequest = {
  position: number;
  title: string;
  description: string;
  finished?: boolean;
};

/** Adds a step to a phase of a member's onboarding path. */
export async function createOnboardingStepForPhase(
  phaseId: string,
  request: CreateOnboardingStepRequest,
): Promise<OnboardingStepEndpoint> {
  return await apiClient.fetch<OnboardingStepEndpoint>(
    `/api/v1/onboarding/phases/${phaseId}/steps`,
    {
      method: "POST",
      body: JSON.stringify(request),
    },
  );
}

/** Replaces a step on a member's onboarding path, including its status and skip state. */
export async function updateOnboardingStep(
  stepId: string,
  request: UpdateOnboardingStepRequest,
): Promise<OnboardingStepEndpoint> {
  return await apiClient.fetch<OnboardingStepEndpoint>(`/api/v1/onboarding/steps/${stepId}`, {
    method: "PUT",
    body: JSON.stringify(request),
  });
}

/** Adds a task to a step of a member's onboarding path. */
export async function createOnboardingTaskForStep(
  stepId: string,
  request: CreateOnboardingTaskRequest,
): Promise<OnboardingTaskEndpoint> {
  return await apiClient.fetch<OnboardingTaskEndpoint>(`/api/v1/onboarding/steps/${stepId}/tasks`, {
    method: "POST",
    body: JSON.stringify(request),
  });
}

/** Deletes a step from a member's onboarding path. */
export async function deleteOnboardingStep(stepId: string): Promise<void> {
  await apiClient.fetch(`/api/v1/onboarding/steps/${stepId}`, {
    method: "DELETE",
  });
}

export type UpdateOnboardingTaskRequest = {
  position: number;
  title: string;
  description: string;
  finished: boolean;
};

/**
 * Updates an onboarding task, including its position. Used by the drag-and-drop
 * task reordering in the team member detail view. The backend automatically
 * shifts sibling tasks within the same step when the position changes.
 */
export async function updateOnboardingTask(
  taskId: string,
  request: UpdateOnboardingTaskRequest,
): Promise<OnboardingTaskEndpoint> {
  return await apiClient.fetch<OnboardingTaskEndpoint>(`/api/v1/onboarding/tasks/${taskId}`, {
    method: "PUT",
    body: JSON.stringify(request),
  });
}

/**
 * Loads the tasks of one step on a member's onboarding path.
 *
 * Never throws: when the request fails it returns an empty list, which looks the same as a step
 * without tasks.
 */
export async function getOnboardingTasksByStep(stepId: string): Promise<OnboardingTaskEndpoint[]> {
  try {
    return await apiClient.fetch<OnboardingTaskEndpoint[]>(
      `/api/v1/onboarding/steps/${stepId}/tasks`,
    );
  } catch {
    return [];
  }
}

/** Deletes a task from a member's onboarding path. */
export async function deleteOnboardingTask(taskId: string): Promise<void> {
  await apiClient.fetch(`/api/v1/onboarding/tasks/${taskId}`, {
    method: "DELETE",
  });
}
