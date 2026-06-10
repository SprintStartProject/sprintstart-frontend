// ============================================================
// services/onboardingService.ts
// ============================================================

import type {
    OnboardingPathEndpoint,
    OnboardingStepDetail,
    OnboardingTaskEndpoint,
    OnboardingResourceEndpoint,
    StepStatus,
} from '../types/onboarding';

const BASE_URL = '/api/v1';

/**
 * Service responsible for managing onboarding paths, steps, and associated tasks.
 * Interacts with the backend onboarding module.
 */
export const onboardingService = {

    // ── PATH ─────────────────────────────────────────────────

    /**
     * Fetches the personalized onboarding path for a specific user.
     * 
     * @param userId - Unique identifier of the user.
     * @returns Promise resolving to the user's OnboardingPathEndpoint.
     * @throws Error if the path cannot be loaded.
     */
    async fetchPath(userId: string): Promise<OnboardingPathEndpoint> {
        const res = await fetch(`${BASE_URL}/onboarding/${userId}/path`);
        if (!res.ok) throw new Error(`Error loading onboarding path: ${res.statusText}`);
        return res.json() as Promise<OnboardingPathEndpoint>;
    },

    // ── STEP ─────────────────────────────────────────────────

    /**
     * Retrieves detailed information for a specific onboarding step.
     * 
     * @param stepId - The unique ID of the step.
     * @returns Promise resolving to the step details.
     * @throws Error if the step details fail to load.
     */
    async fetchStep(stepId: string): Promise<OnboardingStepDetail> {
        const res = await fetch(`${BASE_URL}/onboarding/steps/${stepId}`);
        if (!res.ok) throw new Error(`Step: HTTP ${res.status}`);
        return res.json() as Promise<OnboardingStepDetail>;
    },

    /**
     * Updates the completion status of a specific onboarding step.
     * 
     * @param step - The step object to update.
     * @param newStatus - The target status (e.g., 'IN_PROGRESS', 'DONE').
     * @throws Error if the update fails.
     */
    async updateStepStatus(step: OnboardingStepDetail, newStatus: StepStatus): Promise<void> {
        const res = await fetch(`${BASE_URL}/onboarding/steps/${step.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                position: step.position,
                title: step.title,
                description: step.description,
                type: step.type ?? 'TASK',
                estimatedMinutes: step.estimatedMinutes,
                expectedOutcome: step.expectedOutcome ?? '',
                status: newStatus,
                skipReason: step.skipReason ?? '',
            }),
        });
        if (!res.ok) throw new Error(`Step Update: HTTP ${res.status}`);
    },

    /**
     * Marks an onboarding step as skipped with a provided reason.
     * 
     * @param step - The step object to skip.
     * @param reason - Explanation for why the step is being bypassed.
     * @throws Error if the skip action fails.
     */
    async skipStep(step: OnboardingStepDetail, reason: string): Promise<void> {
        const res = await fetch(`${BASE_URL}/onboarding/steps/${step.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                position: step.position,
                title: step.title,
                description: step.description,
                type: step.type ?? 'TASK',
                estimatedMinutes: step.estimatedMinutes,
                expectedOutcome: step.expectedOutcome ?? '',
                status: 'SKIPPED',
                skipReason: reason,
            }),
        });
        if (!res.ok) throw new Error(`Step Skip: HTTP ${res.status}`);
    },

    // ── TASKS ─────────────────────────────────────────────────

    /**
     * Fetches all individual tasks associated with a specific onboarding step.
     * 
     * @param stepId - The ID of the parent step.
     * @returns Promise resolving to an array of tasks.
     * @throws Error if the tasks fail to load.
     */
    async fetchTasks(stepId: string): Promise<OnboardingTaskEndpoint[]> {
        const res = await fetch(`${BASE_URL}/onboarding/steps/${stepId}/tasks`);
        if (!res.ok) throw new Error(`Tasks: HTTP ${res.status}`);
        return res.json() as Promise<OnboardingTaskEndpoint[]>;
    },

    /**
     * Updates the completion state of a specific task within a step.
     * 
     * @param task - The task object to update.
     * @param finished - Boolean indicating whether the task is completed.
     * @throws Error if the task update fails.
     */
    async updateTask(task: OnboardingTaskEndpoint, finished: boolean): Promise<void> {
        const res = await fetch(`${BASE_URL}/onboarding/tasks/${task.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                position: task.position,
                title: task.title,
                description: task.description,
                finished,
            }),
        });
        if (!res.ok) throw new Error(`Task Update: HTTP ${res.status}`);
    },

    // ── RESOURCES ─────────────────────────────────────────────

    /**
     * Fetches all educational or technical resources linked to a specific step.
     * 
     * @param stepId - The ID of the parent step.
     * @returns Promise resolving to an array of resources.
     * @throws Error if the resources fail to load.
     */
    async fetchResources(stepId: string): Promise<OnboardingResourceEndpoint[]> {
        const res = await fetch(`${BASE_URL}/onboarding/steps/${stepId}/resources`);
        if (!res.ok) throw new Error(`Resources: HTTP ${res.status}`);
        return res.json() as Promise<OnboardingResourceEndpoint[]>;
    },
};