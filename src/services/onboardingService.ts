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

export const onboardingService = {

    // ── PATH ─────────────────────────────────────────────────

    async fetchPath(userId: string): Promise<OnboardingPathEndpoint> {
        const res = await fetch(`${BASE_URL}/onboarding/${userId}/path`);
        if (!res.ok) throw new Error(`Error loading onboarding path: ${res.statusText}`);
        return res.json() as Promise<OnboardingPathEndpoint>;
    },

    // ── STEP ─────────────────────────────────────────────────

    async fetchStep(stepId: string): Promise<OnboardingStepDetail> {
        const res = await fetch(`${BASE_URL}/onboarding/steps/${stepId}`);
        if (!res.ok) throw new Error(`Step: HTTP ${res.status}`);
        return res.json() as Promise<OnboardingStepDetail>;
    },

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

    // ── TASKS ─────────────────────────────────────────────────

    async fetchTasks(stepId: string): Promise<OnboardingTaskEndpoint[]> {
        const res = await fetch(`${BASE_URL}/onboarding/steps/${stepId}/tasks`);
        if (!res.ok) throw new Error(`Tasks: HTTP ${res.status}`);
        return res.json() as Promise<OnboardingTaskEndpoint[]>;
    },

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

    async fetchResources(stepId: string): Promise<OnboardingResourceEndpoint[]> {
        const res = await fetch(`${BASE_URL}/onboarding/steps/${stepId}/resources`);
        if (!res.ok) throw new Error(`Resources: HTTP ${res.status}`);
        return res.json() as Promise<OnboardingResourceEndpoint[]>;
    },
};