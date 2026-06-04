// ============================================================
// OnBoardingItemPage.tsx
// ============================================================

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type {
  OnboardingStepDetail,
  OnboardingTaskEndpoint,
  OnboardingResourceEndpoint,
  StepStatus
} from '../../types/onboarding';

import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock3,
  Target,
  ExternalLink,
  MessageSquareCheck,
  Loader2,
  AlertCircle,
  Trophy,
} from 'lucide-react';

const BASE_API_URL = 'http://localhost:8080/api/v1';
type LoadingState = 'idle' | 'loading' | 'success' | 'error';

// ─────────────────────────────────────────────────────────────
// HELPER
// ─────────────────────────────────────────────────────────────

async function readJson<T>(response: Response): Promise<T> {
  const data: unknown = await response.json();
  return data as T;
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

// ─────────────────────────────────────────────────────────────
// HAUPT-KOMPONENTE
// ─────────────────────────────────────────────────────────────

export function OnBoardingItemPage() {
  const { stepId } = useParams<{ stepId: string }>();
  const navigate = useNavigate();

  // Step-Detail (enthält tasks + resources direkt vom GET /steps/{id} Endpoint)
  const [stepDetail, setStepDetail] = useState<OnboardingStepDetail | null>(null);
  const [tasks, setTasks] = useState<OnboardingTaskEndpoint[]>([]);
  const [resources, setResources] = useState<OnboardingResourceEndpoint[]>([]);

  const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const [localFinished, setLocalFinished] = useState<Set<string>>(new Set());

  // PUT /api/v1/onboarding/steps/{stepId}
  const updateStepStatus = async (newStatus: StepStatus) => {
    if (!stepDetail) return;

        const body = {
        position: stepDetail.position,
        title: stepDetail.title,
        description: stepDetail.description,
        type: stepDetail.type ?? 'TASK',
        estimatedMinutes: stepDetail.estimatedMinutes,
        expectedOutcome: stepDetail.expectedOutcome ?? '',
        status: newStatus,
        skipReason: stepDetail.skipReason ?? '',
    };

    console.warn('PUT body:', JSON.stringify(body, null, 2)); // ← neu

    try {
      const res = await fetch(`${BASE_API_URL}/onboarding/steps/${stepDetail.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          position: stepDetail.position,
          title: stepDetail.title,
          description: stepDetail.description,
          type: stepDetail.type,
          estimatedMinutes: stepDetail.estimatedMinutes,
          expectedOutcome: stepDetail.expectedOutcome ?? '',
          status: newStatus,
          skipReason: stepDetail.skipReason ?? '',
        }),
      });



      if (!res.ok) throw new Error(`Step Update: HTTP ${res.status}`);
      setStepDetail((prev: OnboardingStepDetail | null) => {
        if (!prev) return prev;
        return { ...prev, status: newStatus };
      });
    } catch (err) {
      console.error('Fehler beim Step-Update:', err);
    }
  };

  // PUT /api/v1/onboarding/tasks/{taskId}
  const updateTaskFinished = async (taskId: string, finished: boolean) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    try {
      const res = await fetch(`${BASE_API_URL}/onboarding/tasks/${taskId}`, {
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
      // Lokal updaten
      setTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, finished } : t
      ));
      // localFinished synchron halten
      setLocalFinished(prev => {
        const next = new Set(prev);
        if (finished) {
          next.add(taskId);
        } else {
          next.delete(taskId);
        }
        return next;
      });
    } catch (err) {
      console.error('Fehler beim Task-Update:', err);
    }
  };

  // ── DATA FETCHING ─────────────────────────────────────────
  useEffect(() => {
    if (!stepId) return;

    const load = async (): Promise<void> => {
      setLoadingState('loading');
      setErrorMessage('');

      try {
        const stepRes = await fetch(`${BASE_API_URL}/onboarding/steps/${stepId}`);
        if (!stepRes.ok) throw new Error(`Step: HTTP ${stepRes.status}`);
        const step = await readJson<OnboardingStepDetail>(stepRes);
        setStepDetail(step);

        const tasksRes = await fetch(`${BASE_API_URL}/onboarding/steps/${stepId}/tasks`);
        if (!tasksRes.ok) throw new Error(`Tasks: HTTP ${tasksRes.status}`);
        const fetchedTasks = await readJson<OnboardingTaskEndpoint[]>(tasksRes);
        setTasks(fetchedTasks);

        const resourcesRes = await fetch(`${BASE_API_URL}/onboarding/steps/${stepId}/resources`);
        if (!resourcesRes.ok) throw new Error(`Resources: HTTP ${resourcesRes.status}`);
        const fetchedResources = await readJson<OnboardingResourceEndpoint[]>(resourcesRes);
        setResources(fetchedResources);

        const alreadyDone = new Set(fetchedTasks.filter(task => task.finished).map(task => task.id));
        setLocalFinished(alreadyDone);

        setLoadingState('success');
      } catch (err) {
        setLoadingState('error');
        setErrorMessage(err instanceof Error ? err.message : 'Unbekannter Fehler');
      }
    };

    void load();
  }, [stepId]);

  // ── TOGGLE TASK ───────────────────────────────────────────
  // Nachher:
  const toggleTask = (taskId: string): void => {
    const isCurrentlyDone = localFinished.has(taskId);
    void updateTaskFinished(taskId, !isCurrentlyDone);
  };

  // ── DERIVED ───────────────────────────────────────────────
  const sortedTasks = [...tasks].sort((a, b) => a.position - b.position);
  const doneTasks = sortedTasks.filter(t => localFinished.has(t.id)).length;
  const allTasksDone = sortedTasks.length === 0 || doneTasks === sortedTasks.length;
  const taskPercentage = sortedTasks.length > 0
    ? Math.round((doneTasks / sortedTasks.length) * 100)
    : 0;

  // ── LOADING ───────────────────────────────────────────────
  if (loadingState === 'loading' || loadingState === 'idle') {
    return (
        <div className="flex min-h-screen items-center justify-center bg-app-bg">
          <div className="flex flex-col items-center gap-4 text-app-text-subtle">
            <Loader2 className="h-8 w-8 animate-spin text-app-brand-text" />
            <p className="text-sm">Step wird geladen...</p>
          </div>
        </div>
    );
  }

  // ── ERROR ─────────────────────────────────────────────────
  if (loadingState === 'error') {
    return (
        <div className="flex min-h-screen items-center justify-center bg-app-bg p-8">
          <div className="max-w-md text-center">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-app-danger-text" />

            <h2 className="mb-2 text-xl font-semibold text-app-text">
              Step konnte nicht geladen werden
            </h2>

            <p className="mb-6 text-sm text-app-text-subtle">
              {errorMessage}
            </p>

            <button
                onClick={() => void navigate('/onboarding')}
                className="rounded-xl bg-app-brand px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-app-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus"
            >
              Zurück zum Onboarding
            </button>
          </div>
        </div>
    );
  }

  // ── EMPTY ─────────────────────────────────────────────────
  if (!stepDetail) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-app-bg">
          <div className="text-center">
            <p className="mb-4 text-sm text-app-text-subtle">
              Step nicht gefunden.
            </p>

            <button
                onClick={() => void navigate('/onboarding')}
                className="rounded-xl bg-app-brand px-4 py-2 text-sm font-medium text-white transition-all hover:bg-app-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus"
            >
              Zurück zum Onboarding
            </button>
          </div>
        </div>
    );
  }

  // ── RENDER ────────────────────────────────────────────────
  return (
      <div className="min-h-screen bg-app-bg text-app-text">
        {/* HEADER */}
        <div className="border-b border-app-border bg-app-bg/90 backdrop-blur-xl">
          <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6 lg:px-8">
            <button
                onClick={() => void navigate('/onboarding')}
                className="mb-4 inline-flex items-center gap-2 text-sm text-app-text-subtle transition-all hover:text-app-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus"
            >
              <ArrowLeft className="h-4 w-4" />
              Zurück zum Onboarding
            </button>

            <div className="flex items-start justify-between gap-4">
              <div>
                <div
                    className={`mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
                        stepDetail.status === 'FINISHED'
                            ? 'bg-app-success-bg text-app-success-text'
                            : stepDetail.status === 'IN_PROGRESS'
                                ? 'bg-app-warning-bg text-app-warning-text'
                                : stepDetail.status === 'SKIPPED'
                                    ? 'bg-app-neutral-bg text-app-neutral-text'
                                    : 'bg-app-brand-soft text-app-brand-text'
                    }`}
                >
                  {stepDetail.status === 'FINISHED'
                      ? 'Erledigt'
                      : stepDetail.status === 'IN_PROGRESS'
                          ? 'In Bearbeitung'
                          : stepDetail.status === 'SKIPPED'
                              ? 'Übersprungen'
                              : 'Offen'}
                </div>

                <h1 className="text-2xl font-bold text-app-text sm:text-3xl">
                  {stepDetail.title}
                </h1>

                <p className="mt-2 text-sm text-app-text-subtle">
                  {stepDetail.description}
                </p>
              </div>

              {stepDetail.estimatedMinutes > 0 && (
                  <div className="hidden shrink-0 items-center gap-2 rounded-xl bg-app-surface px-3 py-2 text-sm text-app-text-muted sm:flex">
                    <Clock3 className="h-4 w-4" />
                    {formatMinutes(stepDetail.estimatedMinutes)}
                  </div>
              )}
            </div>
          </div>
        </div>

        {/* MAIN CONTENT */}
        <main className="mx-auto max-w-5xl px-4 py-6 pb-24 sm:px-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* LINKE SPALTE */}
            <div className="space-y-6 lg:col-span-2">
              {/* TASKS */}
              {sortedTasks.length > 0 && (
                  <div className="rounded-2xl border border-app-border bg-app-surface p-6">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Target className="h-5 w-5 text-app-warning-solid" />

                        <h2 className="font-semibold text-app-text">
                          Aufgaben
                        </h2>
                      </div>

                      <span className="text-xs text-app-text-subtle">
                    {doneTasks}/{sortedTasks.length} erledigt
                  </span>
                    </div>

                    {/* Fortschrittsbalken */}
                    <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-app-progress-track">
                      <div
                          className="h-full rounded-full bg-gradient-to-r from-app-progress-fill to-app-progress-fill-end transition-all duration-500"
                          style={{ width: `${taskPercentage}%` }}
                      />
                    </div>

                    <div className="space-y-3">
                      {sortedTasks.map((task, index) => {
                        const isDone = localFinished.has(task.id);

                        return (
                            <button
                                key={task.id}
                                onClick={() => toggleTask(task.id)}
                                className={`flex w-full items-start gap-4 rounded-xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus ${
                                    isDone
                                        ? 'border-app-success-border bg-app-success-bg'
                                        : 'border-app-border hover:border-app-brand-border'
                                }`}
                            >
                              {isDone ? (
                                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-app-success-text" />
                              ) : (
                                  <Circle className="mt-0.5 h-5 w-5 shrink-0 text-app-text-disabled" />
                              )}

                              <div>
                          <span
                              className={`text-sm font-medium ${
                                  isDone
                                      ? 'text-app-text-disabled line-through'
                                      : 'text-app-text'
                              }`}
                          >
                            {index + 1}. {task.title}
                          </span>
                                {task.description && (
                                    <p className="mt-0.5 text-xs text-app-text-subtle">
                                      {task.description}
                                    </p>
                                )}
                              </div>
                            </button>
                        );
                      })}
                    </div>
                  </div>
              )}

              {/* MARK STEP AS DONE */}
              <div className="rounded-2xl border border-app-border bg-app-surface p-5">
                <h3 className="mb-3 text-sm font-semibold text-app-text">
                  Schritt abschließen
                </h3>
                <button
                    onClick={() => void updateStepStatus(
                        stepDetail.status === 'FINISHED' ? 'WAITING' : 'FINISHED'
                    )}
                    disabled={!allTasksDone && stepDetail.status !== 'FINISHED'}
                    className={`flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus ${
                        stepDetail.status === 'FINISHED'
                            ? 'border-app-success-border bg-app-success-bg text-app-success-text'
                            : allTasksDone
                                ? 'border-dashed border-app-border-strong text-app-text-subtle hover:border-app-brand-border-strong hover:text-app-brand-text'
                                : 'cursor-not-allowed border-dashed border-app-border text-app-text-disabled'
                    }`}
                >
                  {stepDetail.status === 'FINISHED' ? (
                      <Trophy className="h-5 w-5 shrink-0" />
                  ) : (
                      <Circle className="h-5 w-5 shrink-0" />
                  )}

                  <span className="flex-1 text-left text-sm font-medium">
                  {stepDetail.status === 'FINISHED'
                      ? 'Erledigt!'
                      : allTasksDone
                          ? 'Als erledigt markieren'
                          : `Noch ${sortedTasks.length - doneTasks} Aufgabe${
                              sortedTasks.length - doneTasks === 1 ? '' : 'n'
                          } offen`}
                </span>

                  {stepDetail.status === 'FINISHED' && (
                      <span className="text-xs opacity-60">rückgängig</span>
                  )}
                </button>
              </div>
            </div>




          {/* RECHTE SPALTE */}
          <div className="space-y-6">

            {/* STATUS */}
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-3">
                Status
              </h3>
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm ${stepDetail.status === 'FINISHED'
                ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                }`}>
                {stepDetail.status === 'FINISHED'
                  ? <CheckCircle2 className="w-4 h-4" />
                  : <Circle className="w-4 h-4" />
                }
                {stepDetail.status === 'FINISHED' ? 'Erledigt' :
                  stepDetail.status === 'IN_PROGRESS' ? 'In Bearbeitung' :
                    stepDetail.status === 'SKIPPED' ? 'Übersprungen' : 'Offen'}
              </div>
            </div>

              {/* RESOURCES */}
              {resources.length > 0 && (
                  <div className="rounded-2xl border border-app-border bg-app-surface p-5">
                    <h3 className="mb-3 text-sm font-semibold text-app-text">
                      Ressourcen
                    </h3>

                    <div className="space-y-2">
                      {resources.map(resource => (
                          <a
                              key={resource.id}
                              href={resource.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group flex items-center justify-between rounded-xl border border-app-border p-3 transition-all hover:border-app-brand-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-app-text-muted">
                                {resource.title}
                              </p>

                              {resource.description && (
                                  <p className="mt-0.5 truncate text-xs text-app-text-subtle">
                                    {resource.description}
                                  </p>
                              )}
                            </div>

                            <ExternalLink className="ml-2 h-4 w-4 shrink-0 text-app-text-subtle transition-all group-hover:text-app-brand-text" />
                          </a>
                      ))}
                    </div>
                  </div>
              )}

              {/* FEEDBACK */}
              <div className="rounded-2xl border border-app-border bg-app-surface p-5">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-app-text">
                  <MessageSquareCheck className="h-4 w-4 text-app-brand-text" />
                  Feedback
                </h3>

                <textarea
                    placeholder="Dein Feedback zu diesem Schritt..."
                    className="h-24 w-full resize-none rounded-xl border border-app-border bg-app-bg p-3 text-sm text-app-text transition-all placeholder:text-app-text-disabled focus:outline-none focus:ring-2 focus:ring-app-focus"
                />

                <button className="mt-3 rounded-xl bg-app-brand px-4 py-2 text-sm font-medium text-white transition-all hover:bg-app-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus">
                  Feedback absenden
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
  );
}