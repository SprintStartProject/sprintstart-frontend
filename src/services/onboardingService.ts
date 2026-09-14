import { apiClient } from "./apiClient";
import { parseSSEStream } from "./sse";
import keycloak from "../config/keycloak";
import type {
  OnboardingPathEndpoint,
  OnboardingStepDetail,
  OnboardingSkipEndpoint,
  OnboardingTaskEndpoint,
  OnboardingResourceEndpoint,
  OnboardingPersonalizeEvent,
  OnboardingPersonalizeHandlers,
  StepStatus,
  QuestionAttemptSubmission,
  QuestionAttemptResult,
  AdminPhaseQuestionsEndpoint,
  UpsertQuestion,
  QuestionAttemptsReviewEndpoint,
} from "../features/onboarding/types";
import onboardingStepMock from "../mocks/onboardingStepMock.json";

/**
 * Onboarding path, step, question and task CRUD.
 * Streams AI path generation over SSE; falls back to mock data on fetch
 * failures. Questions are answered one at a time and own their attempt history.
 */
export const onboardingService = {
  // ── PATH ─────────────────────────────────────────────────

  /**
   * Fetches the personalized onboarding path for the current authenticated user from the backend.
   */
  async fetchPath(): Promise<OnboardingPathEndpoint> {
    return await apiClient.fetch<OnboardingPathEndpoint>(`/api/v1/onboarding/me/path`);
  },

  /**
   * Triggers AI generation of the current user's onboarding path and streams
   * progress over SSE. Replaces any existing path once the `path` event arrives.
   *
   * `projectId` is interpolated into the URL because path generation is
   * project-scoped: the path is copied from the active blueprint of the project
   * the user has selected. Hook it to the selected project so the generated
   * path matches the project the user is looking at.
   */
  async personalizePath(projectId: string, handlers: OnboardingPersonalizeHandlers): Promise<void> {
    try {
      if (keycloak.authenticated) {
        await keycloak.updateToken(30);
      }
    } catch (error) {
      console.error("Failed to refresh Keycloak token for onboarding personalize", error);
      void keycloak.login();
      return;
    }

    const res = await fetch(`/api/v1/projects/${projectId}/onboarding/me/path/personalize`, {
      method: "POST",
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
      throw new Error("No response stream");
    }

    for await (const event of parseSSEStream<OnboardingPersonalizeEvent>(stream)) {
      switch (event.type) {
        case "stage":
          handlers.onStage?.(event.name ?? "", event.detail);
          break;
        case "path":
          if (event.path) {
            handlers.onPath(event.path);
          }
          break;
        case "done":
          handlers.onDone();
          return;
        case "error":
          handlers.onError?.(event.message ?? "Unknown error");
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
      method: "PUT",
    });
  },

  async updateStepStatus(step: OnboardingStepDetail, newStatus: StepStatus): Promise<void> {
    if (newStatus === "FINISHED") {
      await apiClient.fetch(`/api/v1/onboarding/me/steps/${step.id}/complete`, {
        method: "PUT",
      });
      return;
    }

    await apiClient.fetch(`/api/v1/onboarding/me/steps/${step.id}`, {
      method: "PUT",
      body: JSON.stringify({
        position: step.position,
        title: step.title,
        description: step.description,
        type: step.type ?? "TASK",
        estimatedMinutes: step.estimatedMinutes,
        expectedOutcome: step.expectedOutcomes?.[0] ?? "",
        status: newStatus,
        skip: step.skip ?? null,
      }),
    });
  },

  /**
   * Marks an onboarding step as skipped with a provided reason on the backend.
   */
  async skipStep(step: OnboardingStepDetail, reason: string): Promise<OnboardingSkipEndpoint> {
    return await apiClient.fetch<OnboardingSkipEndpoint>(
      `/api/v1/onboarding/me/steps/${step.id}/skips`,
      {
        method: "POST",
        body: JSON.stringify({
          reason,
        }),
      },
    );
  },

  // ── KNOWLEDGE-CHECK QUESTIONS ───────────────────────────

  /**
   * Submits the user's answer to one question. The result says whether it was correct
   * and reveals the correct answer, explanation, and (for short text) AI feedback.
   */
  async submitQuestionAttempt(
    questionId: string,
    answer: QuestionAttemptSubmission,
  ): Promise<QuestionAttemptResult> {
    return await apiClient.fetch<QuestionAttemptResult>(
      `/api/v1/onboarding/me/questions/${questionId}/attempts`,
      {
        method: "POST",
        body: JSON.stringify(answer),
      },
    );
  },

  /**
   * Loads a phase's questions for admin editing screens, including correct answers.
   * Requires ADMIN/PM/HR role.
   */
  async fetchPhaseQuestionsForEditing(phaseId: string): Promise<AdminPhaseQuestionsEndpoint> {
    return await apiClient.fetch<AdminPhaseQuestionsEndpoint>(
      `/api/v1/onboarding/phases/${phaseId}/questions`,
    );
  },

  /**
   * Replaces all knowledge-check questions of a phase. Requires ADMIN/PM/HR role.
   */
  async savePhaseQuestions(
    phaseId: string,
    questions: UpsertQuestion[],
  ): Promise<AdminPhaseQuestionsEndpoint> {
    return await apiClient.fetch<AdminPhaseQuestionsEndpoint>(
      `/api/v1/onboarding/phases/${phaseId}/questions`,
      {
        method: "PUT",
        body: JSON.stringify({ questions }),
      },
    );
  },

  /**
   * Loads a user's attempts on one question so admins, PMs, or HR can review how the
   * answer was reached. Requires ADMIN/PM/HR role.
   */
  async fetchQuestionAttempts(
    userId: string,
    questionId: string,
  ): Promise<QuestionAttemptsReviewEndpoint> {
    return await apiClient.fetch<QuestionAttemptsReviewEndpoint>(
      `/api/v1/onboarding/users/${userId}/questions/${questionId}/attempts`,
    );
  },

  // ── FEEDBACK ──────────────────────────────────────────────

  async submitFeedback(stepId: string, helpful: boolean, message: string): Promise<void> {
    await apiClient.fetch(`/api/v1/onboarding/me/feedback`, {
      method: "POST",
      body: JSON.stringify({ stepId, helpful, message }),
    });
  },

  // ── TASKS ─────────────────────────────────────────────────

  async fetchTasks(stepId: string): Promise<OnboardingTaskEndpoint[]> {
    return await apiClient.fetch<OnboardingTaskEndpoint[]>(
      `/api/v1/onboarding/me/steps/${stepId}/tasks`,
    );
  },

  async updateTask(task: OnboardingTaskEndpoint, finished: boolean): Promise<void> {
    await apiClient.fetch(`/api/v1/onboarding/me/tasks/${task.id}`, {
      method: "PUT",
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
    return await apiClient.fetch<OnboardingResourceEndpoint[]>(
      `/api/v1/onboarding/me/steps/${stepId}/resources`,
    );
  },
};
