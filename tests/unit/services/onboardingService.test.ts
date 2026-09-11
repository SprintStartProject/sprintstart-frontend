import { describe, it, expect, vi, beforeEach } from "vitest";
import { onboardingService } from "../../../src/services/onboardingService";
import { http, HttpResponse } from "msw";
import { server } from "../../unit/setup/vitest.setup";
import type {
  OnboardingStepDetail,
  OnboardingTaskEndpoint,
} from "../../../src/features/onboarding/types";

describe("onboardingService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetchPath returns path endpoint", async () => {
    server.use(
      http.get("/api/v1/onboarding/me/path", () =>
        HttpResponse.json({
          id: "path1",
          userId: "user1",
          createdAt: new Date().toISOString(),
          phases: [],
        }),
      ),
    );

    const path = await onboardingService.fetchPath();
    expect(path.id).toBe("path1");
  });

  it("startStep sends PUT request to start endpoint", async () => {
    let captured = false;
    server.use(
      http.put("/api/v1/onboarding/me/steps/step1/start", () => {
        captured = true;
        return new HttpResponse(null, { status: 200 });
      }),
    );

    await onboardingService.startStep("step1");
    expect(captured).toBe(true);
  });

  it("personalizePath processes SSE stream events", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'data: {"type":"stage","name":"Analyzing skills","detail":"Checking JS"}\n\n',
          ),
        );
        controller.enqueue(
          encoder.encode(
            'data: {"type":"path","path":{"id":"path2","userId":"user1","createdAt":"2024-01-01","phases":[]}}\n\n',
          ),
        );
        controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
        controller.close();
      },
    });

    const requestedUrls: string[] = [];
    server.use(
      http.post("/api/v1/projects/proj-sel/onboarding/me/path/personalize", ({ request }) => {
        requestedUrls.push(request.url);
        return new HttpResponse(stream, {
          headers: { "Content-Type": "text/event-stream" },
        });
      }),
    );

    const handlers = {
      onStage: vi.fn(),
      onPath: vi.fn(),
      onDone: vi.fn(),
      onError: vi.fn(),
    };

    await onboardingService.personalizePath("proj-sel", handlers);

    // The selected project must be scoped into the request URL, since path
    // generation is project-scoped.
    expect(requestedUrls[0]).toContain("/api/v1/projects/proj-sel/onboarding/me/path/personalize");
    expect(handlers.onStage).toHaveBeenCalledWith("Analyzing skills", "Checking JS");
    expect(handlers.onPath).toHaveBeenCalledWith(expect.objectContaining({ id: "path2" }));
    expect(handlers.onDone).toHaveBeenCalled();
    expect(handlers.onError).not.toHaveBeenCalled();
  });

  it("skipStep posts a skip request", async () => {
    server.use(
      http.post("/api/v1/onboarding/me/steps/step1/skips", async ({ request }) => {
        const body = (await request.json()) as { reason: string };
        expect(body.reason).toBe("Too hard");
        return HttpResponse.json({
          id: "skip1",
          stepId: "step1",
          status: "PENDING",
          reason: "Too hard",
          reviewComment: null,
          createdAt: new Date().toISOString(),
        });
      }),
    );

    const step: OnboardingStepDetail = {
      id: "step1",
      phaseId: "phase1",
      position: 1,
      title: "Step 1",
      description: "",
      type: "TASK",
      estimatedMinutes: 10,
      expectedOutcomes: [],
      tasks: [],
      resources: [],
      status: "IN_PROGRESS",
      startedAt: null,
      completedAt: null,
      feedback: null,
      skip: null,
    };

    const res = await onboardingService.skipStep(step, "Too hard");
    expect(res.id).toBe("skip1");
  });

  it("updateTask updates finished state", async () => {
    let capturedBody: unknown = null;
    server.use(
      http.put("/api/v1/onboarding/me/tasks/task1", async ({ request }) => {
        capturedBody = await request.json();
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const task: OnboardingTaskEndpoint = {
      id: "task1",
      stepId: "step1",
      position: 1,
      title: "T1",
      description: "D1",
      finished: false,
    };
    await onboardingService.updateTask(task, true);

    expect(capturedBody).toEqual({
      position: 1,
      title: "T1",
      description: "D1",
      finished: true,
    });
  });

  it("submitQuestionAttempt posts a single answer and returns the grading result", async () => {
    let capturedBody: unknown = null;
    server.use(
      http.post("/api/v1/onboarding/me/questions/q1/attempts", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          attemptId: "attempt1",
          questionId: "q1",
          correct: true,
          createdAt: new Date().toISOString(),
          correctOptionIds: ["o1"],
          correctAnswer: null,
          explanation: "Right.",
          feedback: null,
          status: "PASSED",
          onboardingCompleted: false,
        });
      }),
    );

    const result = await onboardingService.submitQuestionAttempt("q1", {
      selectedOptionIds: ["o1"],
    });

    expect(capturedBody).toEqual({ selectedOptionIds: ["o1"] });
    expect(result.correct).toBe(true);
    expect(result.status).toBe("PASSED");
    // Correct answers are revealed in the submit result.
    expect(result.correctOptionIds).toEqual(["o1"]);
  });

  it("savePhaseQuestions sends a PUT with the questions payload", async () => {
    let capturedBody: unknown = null;
    server.use(
      http.put("/api/v1/onboarding/phases/phase1/questions", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ phaseId: "phase1", questions: [] });
      }),
    );

    await onboardingService.savePhaseQuestions("phase1", [
      { position: 0, type: "SHORT_TEXT", question: "cmd?", correctAnswer: "run" },
    ]);

    expect(capturedBody).toEqual({
      questions: [{ position: 0, type: "SHORT_TEXT", question: "cmd?", correctAnswer: "run" }],
    });
  });

  it("fetchPhaseQuestionsForEditing loads questions with correct answers", async () => {
    server.use(
      http.get("/api/v1/onboarding/phases/phase1/questions", () =>
        HttpResponse.json({
          phaseId: "phase1",
          questions: [
            {
              id: "q1",
              position: 0,
              type: "MULTIPLE_CHOICE",
              question: "Which one?",
              explanation: null,
              options: [
                { id: "o1", position: 0, label: "A", correct: true },
                { id: "o2", position: 1, label: "B", correct: false },
              ],
            },
          ],
        }),
      ),
    );

    const check = await onboardingService.fetchPhaseQuestionsForEditing("phase1");

    expect(check.phaseId).toBe("phase1");
    // Admin editing screens get the correct flag, unlike the user-facing path.
    expect(check.questions[0].options?.[0].correct).toBe(true);
  });

  it("fetchQuestionAttempts loads a user's attempts on one question for review", async () => {
    server.use(
      http.get("/api/v1/onboarding/users/user1/questions/q1/attempts", () =>
        HttpResponse.json({
          userId: "user1",
          questionId: "q1",
          attempts: [
            {
              id: "attempt1",
              correct: true,
              createdAt: new Date().toISOString(),
              selectedOptionIds: ["o1"],
              textAnswer: null,
            },
          ],
        }),
      ),
    );

    const review = await onboardingService.fetchQuestionAttempts("user1", "q1");

    expect(review.attempts).toHaveLength(1);
    expect(review.attempts[0].correct).toBe(true);
  });
});
