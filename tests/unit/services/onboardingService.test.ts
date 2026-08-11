import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onboardingService } from '../../../src/services/onboardingService';
import { http, HttpResponse } from 'msw';
import { server } from '../../unit/setup/vitest.setup';
import type {
    OnboardingStepDetail,
    OnboardingTaskEndpoint,
} from '../../../src/features/onboarding/types';

describe('onboardingService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('fetchPath returns path endpoint', async () => {
        server.use(
            http.get('/api/v1/onboarding/me/path', () =>
                HttpResponse.json({ id: 'path1', userId: 'user1', createdAt: new Date().toISOString(), phases: [] }),
            ),
        );

        const path = await onboardingService.fetchPath();
        expect(path.id).toBe('path1');
    });

    it('startStep sends PUT request to start endpoint', async () => {
        let captured = false;
        server.use(
            http.put('/api/v1/onboarding/me/steps/step1/start', () => {
                captured = true;
                return new HttpResponse(null, { status: 200 });
            }),
        );

        await onboardingService.startStep('step1');
        expect(captured).toBe(true);
    });

    it('personalizePath processes SSE stream events', async () => {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(
                    encoder.encode('data: {"type":"stage","name":"Analyzing skills","detail":"Checking JS"}\n\n'),
                );
                controller.enqueue(
                    encoder.encode('data: {"type":"path","path":{"id":"path2","userId":"user1","createdAt":"2024-01-01","phases":[]}}\n\n'),
                );
                controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
                controller.close();
            },
        });

        server.use(
            http.post('/api/v1/onboarding/me/path/personalize', () => {
                return new HttpResponse(stream, {
                    headers: { 'Content-Type': 'text/event-stream' },
                });
            }),
        );

        const handlers = {
            onStage: vi.fn(),
            onPath: vi.fn(),
            onDone: vi.fn(),
            onError: vi.fn(),
        };

        await onboardingService.personalizePath(handlers);

        expect(handlers.onStage).toHaveBeenCalledWith('Analyzing skills', 'Checking JS');
        expect(handlers.onPath).toHaveBeenCalledWith(expect.objectContaining({ id: 'path2' }));
        expect(handlers.onDone).toHaveBeenCalled();
        expect(handlers.onError).not.toHaveBeenCalled();
    });

    it('skipStep posts a skip request', async () => {
        server.use(
            http.post('/api/v1/onboarding/me/steps/step1/skips', async ({ request }) => {
                const body = (await request.json()) as { reason: string };
                expect(body.reason).toBe('Too hard');
                return HttpResponse.json({
                    id: 'skip1',
                    stepId: 'step1',
                    status: 'PENDING',
                    reason: 'Too hard',
                    reviewComment: null,
                    createdAt: new Date().toISOString(),
                });
            }),
        );

        const step: OnboardingStepDetail = {
            id: 'step1',
            phaseId: 'phase1',
            position: 1,
            title: 'Step 1',
            description: '',
            type: 'TASK',
            estimatedMinutes: 10,
            expectedOutcomes: [],
            tasks: [],
            resources: [],
            status: 'IN_PROGRESS',
            startedAt: null,
            completedAt: null,
            feedback: null,
            skip: null,
        };

        const res = await onboardingService.skipStep(step, 'Too hard');
        expect(res.id).toBe('skip1');
    });

    it('updateTask updates finished state', async () => {
        let capturedBody: unknown = null;
        server.use(
            http.put('/api/v1/onboarding/me/tasks/task1', async ({ request }) => {
                capturedBody = await request.json();
                return new HttpResponse(null, { status: 200 });
            }),
        );

        const task: OnboardingTaskEndpoint = {
            id: 'task1',
            stepId: 'step1',
            position: 1,
            title: 'T1',
            description: 'D1',
            finished: false,
        };
        await onboardingService.updateTask(task, true);

        expect(capturedBody).toEqual({
            position: 1,
            title: 'T1',
            description: 'D1',
            finished: true,
        });
    });

    it('fetchPhaseCheck loads the check without correct answers', async () => {
        server.use(
            http.get('/api/v1/onboarding/me/phases/phase1/checks', () =>
                HttpResponse.json({
                    phaseId: 'phase1',
                    required: true,
                    passed: false,
                    latestAttemptId: null,
                    questions: [
                        {
                            id: 'q1',
                            position: 0,
                            type: 'MULTIPLE_CHOICE',
                            question: 'Which one?',
                            options: [{ id: 'o1', position: 0, label: 'A' }],
                        },
                    ],
                }),
            ),
        );

        const check = await onboardingService.fetchPhaseCheck('phase1');

        expect(check.phaseId).toBe('phase1');
        expect(check.questions[0].options?.[0].label).toBe('A');
        // Options must not leak a `correct` flag to the user-facing endpoint.
        expect(check.questions[0].options?.[0]).not.toHaveProperty('correct');
    });

    it('submitPhaseCheck posts answers and returns the grading result', async () => {
        let capturedBody: unknown = null;
        server.use(
            http.post('/api/v1/onboarding/me/phases/phase1/checks/attempts', async ({ request }) => {
                capturedBody = await request.json();
                return HttpResponse.json({
                    attemptId: 'attempt1',
                    phaseId: 'phase1',
                    passed: false,
                    createdAt: new Date().toISOString(),
                    correctCount: 1,
                    questionCount: 2,
                    requiredPercent: 80,
                    phaseCheckSummary: {
                        required: true,
                        questionCount: 2,
                        passed: false,
                        latestAttemptId: 'attempt1',
                        latestAttemptAt: new Date().toISOString(),
                    },
                    nextPhaseUnlocked: false,
                    results: [
                        {
                            questionId: 'q1',
                            correct: false,
                            correctOptionIds: ['o2'],
                            correctAnswer: null,
                            explanation: 'Nope.',
                            feedback: null,
                        },
                        {
                            questionId: 'q2',
                            correct: true,
                            correctOptionIds: [],
                            correctAnswer: 'gradlew bootRun',
                            explanation: null,
                            feedback: 'Right idea.',
                        },
                    ],
                });
            }),
        );

        const result = await onboardingService.submitPhaseCheck('phase1', [
            { questionId: 'q1', selectedOptionIds: ['o1'] },
            { questionId: 'q2', textAnswer: 'run the wrapper' },
        ]);

        expect(capturedBody).toEqual({
            answers: [
                { questionId: 'q1', selectedOptionIds: ['o1'] },
                { questionId: 'q2', textAnswer: 'run the wrapper' },
            ],
        });
        expect(result.passed).toBe(false);
        expect(result.requiredPercent).toBe(80);
        expect(result.results[0].correctOptionIds).toEqual(['o2']);
        // AI feedback on the short-text answer is surfaced through the service.
        expect(result.results[1].feedback).toBe('Right idea.');
    });

    it('fetchReviewCheck loads the open pool with its source phases', async () => {
        server.use(
            http.get('/api/v1/onboarding/me/review-check', () =>
                HttpResponse.json({
                    openCount: 1,
                    questions: [
                        {
                            id: 'q1',
                            position: 0,
                            type: 'MULTIPLE_CHOICE',
                            question: 'Which one?',
                            options: [{ id: 'o1', position: 0, label: 'A' }],
                            review: true,
                            reviewSourcePhaseTitle: 'Setup',
                        },
                    ],
                }),
            ),
        );

        const pool = await onboardingService.fetchReviewCheck();

        expect(pool.openCount).toBe(1);
        expect(pool.questions[0].review).toBe(true);
        expect(pool.questions[0].reviewSourcePhaseTitle).toBe('Setup');
        // Correct answers must not leak into the pool listing.
        expect(pool.questions[0].options?.[0]).not.toHaveProperty('correct');
    });

    it('submitReviewCheck posts only the answered questions and reports what is left', async () => {
        let capturedBody: unknown = null;
        server.use(
            http.post('/api/v1/onboarding/me/review-check/attempts', async ({ request }) => {
                capturedBody = await request.json();
                return HttpResponse.json({
                    answeredCount: 1,
                    correctCount: 1,
                    remainingCount: 0,
                    onboardingCompleted: true,
                    results: [
                        {
                            questionId: 'q1',
                            correct: true,
                            correctOptionIds: ['o1'],
                            correctAnswer: null,
                            explanation: null,
                            feedback: null,
                            review: true,
                            reviewSourcePhaseTitle: 'Setup',
                        },
                    ],
                });
            }),
        );

        const result = await onboardingService.submitReviewCheck([
            { questionId: 'q1', selectedOptionIds: ['o1'] },
        ]);

        expect(capturedBody).toEqual({
            answers: [{ questionId: 'q1', selectedOptionIds: ['o1'] }],
        });
        expect(result.remainingCount).toBe(0);
        // Clearing the last open question is what finishes the onboarding journey.
        expect(result.onboardingCompleted).toBe(true);
    });

    it('fetchUserReviewCheck loads another user\'s open pool for reviewers', async () => {
        server.use(
            http.get('/api/v1/onboarding/users/user1/review-check', () =>
                HttpResponse.json({
                    openCount: 1,
                    questions: [
                        {
                            id: 'q1',
                            position: 0,
                            type: 'SHORT_TEXT',
                            question: 'cmd?',
                            review: true,
                            reviewSourcePhaseTitle: 'Setup',
                        },
                    ],
                }),
            ),
        );

        const pool = await onboardingService.fetchUserReviewCheck('user1');

        expect(pool.openCount).toBe(1);
        expect(pool.questions[0].reviewSourcePhaseTitle).toBe('Setup');
    });

    it('savePhaseCheck sends a PUT with the questions payload', async () => {
        let capturedBody: unknown = null;
        server.use(
            http.put('/api/v1/onboarding/phases/phase1/checks', async ({ request }) => {
                capturedBody = await request.json();
                return HttpResponse.json({ phaseId: 'phase1', questions: [] });
            }),
        );

        await onboardingService.savePhaseCheck('phase1', [
            { position: 0, type: 'SHORT_TEXT', question: 'cmd?', correctAnswer: 'run' },
        ]);

        expect(capturedBody).toEqual({
            questions: [{ position: 0, type: 'SHORT_TEXT', question: 'cmd?', correctAnswer: 'run' }],
        });
    });

    it('fetchPhaseCheckAttempts loads a user\'s attempts for review', async () => {
        server.use(
            http.get('/api/v1/onboarding/users/user1/phases/phase1/checks/attempts', () =>
                HttpResponse.json({
                    userId: 'user1',
                    phaseId: 'phase1',
                    attempts: [
                        {
                            id: 'attempt1',
                            passed: true,
                            createdAt: new Date().toISOString(),
                            correctAnswerCount: 2,
                            questionCount: 2,
                            answers: [],
                        },
                    ],
                }),
            ),
        );

        const review = await onboardingService.fetchPhaseCheckAttempts('user1', 'phase1');

        expect(review.attempts).toHaveLength(1);
        expect(review.attempts[0].correctAnswerCount).toBe(2);
    });
});
