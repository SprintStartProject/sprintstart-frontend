import { apiClient } from './apiClient';
import { parseSSEStream } from './sse';
import keycloak from '../config/keycloak';
import type {
    OnboardingPathEndpoint,
    OnboardingStepDetail,
    OnboardingSkipEndpoint,
    OnboardingTaskEndpoint,
    OnboardingResourceEndpoint,
    OnboardingPersonalizeEvent,
    OnboardingPersonalizeHandlers,
    StepStatus,
    PhaseCheckEndpoint,
    PhaseCheckAnswerSubmission,
    PhaseCheckAttemptResult,
    ReviewCheckEndpoint,
    ReviewCheckResult,
    AdminPhaseCheckEndpoint,
    UpsertPhaseCheckQuestion,
    PhaseCheckAttemptsReviewEndpoint,
} from '../features/onboarding/types';
import onboardingStepMock from '../mocks/onboardingStepMock.json';

export const onboardingService = {

    // ── PATH ─────────────────────────────────────────────────

    async fetchPath(): Promise<OnboardingPathEndpoint> {
        return await apiClient.fetch<OnboardingPathEndpoint>(`/api/v1/onboarding/me/path`);
    },

    /**
     * Triggers AI generation of the current user's onboarding path and streams
     * progress over SSE. Replaces any existing path once the `path` event arrives.
     */
    async personalizePath(handlers: OnboardingPersonalizeHandlers): Promise<void> {
        try {
            if (keycloak.authenticated) {
                await keycloak.updateToken(30);
            }
        } catch (error) {
            console.error('Failed to refresh Keycloak token for onboarding personalize', error);
            void keycloak.login();
            return;
        }

        const res = await fetch(`/api/v1/onboarding/me/path/personalize`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${keycloak.token}`,
            },
        });

        if (!res.ok) {
            handlers.onError?.(`HTTP error! status: ${res.status}`);
            return;
        }

        const stream = res.body;
        if (!stream) {
            throw new Error('No response stream');
        }

        for await (const event of parseSSEStream<OnboardingPersonalizeEvent>(stream)) {
            switch (event.type) {
                case 'stage':
                    handlers.onStage?.(event.name ?? '', event.detail);
                    break;
                case 'path':
                    if (event.path) {
                        handlers.onPath(event.path);
                    }
                    break;
                case 'done':
                    handlers.onDone();
                    return;
                case 'error':
                    handlers.onError?.(event.message ?? 'Unknown error');
                    return;
            }
        }

        handlers.onDone();
    },

    // ── STEP ─────────────────────────────────────────────────

    async fetchStep(stepId: string): Promise<OnboardingStepDetail> {
        try {
            return await apiClient.fetch<OnboardingStepDetail>(`/api/v1/onboarding/me/steps/${stepId}`);
        } catch (error) {
            console.error(`Error fetching onboarding step with ID ${stepId}:`, error);
            return onboardingStepMock as OnboardingStepDetail;
        }
    },

    /**
     * Marks a step as in progress on the backend and records its start timestamp.
     * Safe to call again on an already started step (the backend keeps the original
     * startedAt).
     */
    async startStep(stepId: string): Promise<void> {
        await apiClient.fetch(`/api/v1/onboarding/me/steps/${stepId}/start`, {
            method: 'PUT',
        });
    },

    async updateStepStatus(step: OnboardingStepDetail, newStatus: StepStatus): Promise<void> {
        if (newStatus === 'FINISHED') {
            await apiClient.fetch(`/api/v1/onboarding/me/steps/${step.id}/complete`, {
                method: 'PUT',
            });
            return;
        }

        await apiClient.fetch(`/api/v1/onboarding/me/steps/${step.id}`, {
            method: 'PUT',
            body: JSON.stringify({
                position: step.position,
                title: step.title,
                description: step.description,
                type: step.type ?? 'TASK',
                estimatedMinutes: step.estimatedMinutes,
expectedOutcome: step.expectedOutcomes?.[0] ?? '',
                status: newStatus,
                skip: step.skip ?? null,
            }),
        });
    },

    /**
     * Marks an onboarding step as skipped with a provided reason on the backend.
     */
    async skipStep(step: OnboardingStepDetail, reason: string): Promise<OnboardingSkipEndpoint> {
        return await apiClient.fetch<OnboardingSkipEndpoint>(`/api/v1/onboarding/me/steps/${step.id}/skips`, {
            method: 'POST',
            body: JSON.stringify({
                reason,
            }),
        });
    },

    // ── PHASE KNOWLEDGE CHECKS ────────────────────────────────

    /**
     * Loads the knowledge check of a phase for the current user.
     * Never contains correct answers — those only come back from submitPhaseCheck.
     */
    async fetchPhaseCheck(phaseId: string): Promise<PhaseCheckEndpoint> {
        return await apiClient.fetch<PhaseCheckEndpoint>(`/api/v1/onboarding/me/phases/${phaseId}/checks`);
    },

    /**
     * Submits the user's answers for a phase knowledge check. The result says
     * whether the attempt passed and reveals the correct answers per question.
     */
    async submitPhaseCheck(
        phaseId: string,
        answers: PhaseCheckAnswerSubmission[],
    ): Promise<PhaseCheckAttemptResult> {
        return await apiClient.fetch<PhaseCheckAttemptResult>(
            `/api/v1/onboarding/me/phases/${phaseId}/checks/attempts`,
            {
                method: 'POST',
                body: JSON.stringify({ answers }),
            },
        );
    },

    // ── REVIEW CHECK ──────────────────────────────────────────

    /**
     * Loads the current user's review pool: questions they got wrong in earlier phases
     * and still have to answer correctly once. Never contains correct answers.
     */
    async fetchReviewCheck(): Promise<ReviewCheckEndpoint> {
        return await apiClient.fetch<ReviewCheckEndpoint>('/api/v1/onboarding/me/review-check');
    },

    /**
     * Submits answers for the review pool. Correctly answered questions leave the pool
     * permanently, wrong ones stay open. Answering only some open questions is allowed,
     * so the pool can be worked through in several sittings.
     */
    async submitReviewCheck(answers: PhaseCheckAnswerSubmission[]): Promise<ReviewCheckResult> {
        return await apiClient.fetch<ReviewCheckResult>('/api/v1/onboarding/me/review-check/attempts', {
            method: 'POST',
            body: JSON.stringify({ answers }),
        });
    },

    /**
     * Loads a phase check for admin editing screens, including correct answers.
     * Requires ADMIN/PM/HR role.
     */
    async fetchPhaseCheckForEditing(phaseId: string): Promise<AdminPhaseCheckEndpoint> {
        return await apiClient.fetch<AdminPhaseCheckEndpoint>(`/api/v1/onboarding/phases/${phaseId}/checks`);
    },

    /**
     * Replaces all knowledge check questions of a phase. Requires ADMIN/PM/HR role.
     */
    async savePhaseCheck(
        phaseId: string,
        questions: UpsertPhaseCheckQuestion[],
    ): Promise<AdminPhaseCheckEndpoint> {
        return await apiClient.fetch<AdminPhaseCheckEndpoint>(`/api/v1/onboarding/phases/${phaseId}/checks`, {
            method: 'PUT',
            body: JSON.stringify({ questions }),
        });
    },

    /**
     * Loads a user's open review pool so admins, PMs, or HR can see which earlier
     * questions still keep that user from finishing onboarding. Never contains correct
     * answers — use fetchPhaseCheckForEditing for those. Requires ADMIN/PM/HR role.
     */
    async fetchUserReviewCheck(userId: string): Promise<ReviewCheckEndpoint> {
        return await apiClient.fetch<ReviewCheckEndpoint>(
            `/api/v1/onboarding/users/${userId}/review-check`,
        );
    },

    /**
     * Loads a user's submitted check attempts for a phase so admins, PMs, or HR
     * can review the results. Requires ADMIN/PM/HR role.
     */
    async fetchPhaseCheckAttempts(
        userId: string,
        phaseId: string,
    ): Promise<PhaseCheckAttemptsReviewEndpoint> {
        return await apiClient.fetch<PhaseCheckAttemptsReviewEndpoint>(
            `/api/v1/onboarding/users/${userId}/phases/${phaseId}/checks/attempts`,
        );
    },

    // ── FEEDBACK ──────────────────────────────────────────────

    async submitFeedback(stepId: string, helpful: boolean, message: string): Promise<void> {
        await apiClient.fetch(`/api/v1/onboarding/me/feedback`, {
            method: 'POST',
            body: JSON.stringify({ stepId, helpful, message }),
        });
    },

    // ── TASKS ─────────────────────────────────────────────────

    async fetchTasks(stepId: string): Promise<OnboardingTaskEndpoint[]> {
        return await apiClient.fetch<OnboardingTaskEndpoint[]>(`/api/v1/onboarding/me/steps/${stepId}/tasks`);
    },

    async updateTask(task: OnboardingTaskEndpoint, finished: boolean): Promise<void> {
        await apiClient.fetch(`/api/v1/onboarding/me/tasks/${task.id}`, {
            method: 'PUT',
            body: JSON.stringify({
                position: task.position,
                title: task.title,
                description: task.description,
                finished,
            }),
        });
    },

    // ── RESOURCES ─────────────────────────────────────────────

    async fetchResources(stepId: string): Promise<OnboardingResourceEndpoint[]> {
        return await apiClient.fetch<OnboardingResourceEndpoint[]>(`/api/v1/onboarding/me/steps/${stepId}/resources`);
    },
};
