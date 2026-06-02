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
} from '../types/onboarding';

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

  // Lokaler Zustand für Task-Checkboxen (bis PUT-Endpoint verfügbar)
  // [TODO] Ersetzen durch: PUT /api/v1/onboarding/tasks/{taskId}  mit { finished: true }
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

    console.log('PUT body:', JSON.stringify(body, null, 2)); // ← neu

    try {
      const res = await fetch(`${BASE_API_URL}/onboarding/steps/${stepDetail.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          position: stepDetail.position,
          title: stepDetail.title,
          description: stepDetail.description,
          type: stepDetail.type ?? 'TASK',      // ← Fallback weil GET es nicht zurückgibt
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
        finished ? next.add(taskId) : next.delete(taskId);
        return next;
      });
    } catch (err) {
      console.error('Fehler beim Task-Update:', err);
    }
  };

  // ── DATA FETCHING ─────────────────────────────────────────
  useEffect(() => {
    if (!stepId) {
      setLoadingState('error');
      setErrorMessage('Keine Step-ID in der URL gefunden.');
      return;
    }

    const load = async () => {
      setLoadingState('loading');
      try {
        // 1. Step-Detail holen (enthält bereits tasks[] und resources[] laut Interface)
        const stepRes = await fetch(`${BASE_API_URL}/onboarding/steps/${stepId}`);
        if (!stepRes.ok) throw new Error(`Step: HTTP ${stepRes.status}`);
        const step: OnboardingStepDetail = await stepRes.json();
        setStepDetail(step);

        // 2. Tasks separat holen (falls step.tasks leer oder nicht befüllt)
        //    GET /onboarding/steps/{stepId}/tasks
        const tasksRes = await fetch(`${BASE_API_URL}/onboarding/steps/${stepId}/tasks`);
        if (!tasksRes.ok) throw new Error(`Tasks: HTTP ${tasksRes.status}`);
        const fetchedTasks: OnboardingTaskEndpoint[] = await tasksRes.json();
        setTasks(fetchedTasks);

        // 3. Resources separat holen
        //    GET /onboarding/steps/{stepId}/resources
        const resourcesRes = await fetch(`${BASE_API_URL}/onboarding/steps/${stepId}/resources`);
        if (!resourcesRes.ok) throw new Error(`Resources: HTTP ${resourcesRes.status}`);
        const fetchedResources: OnboardingResourceEndpoint[] = await resourcesRes.json();
        setResources(fetchedResources);

        // Bereits als finished markierte Tasks in den lokalen State übernehmen
        const alreadyDone = new Set(
          fetchedTasks.filter(t => t.finished).map(t => t.id)
        );
        setLocalFinished(alreadyDone);

        setLoadingState('success');
      } catch (err) {
        setLoadingState('error');
        setErrorMessage(err instanceof Error ? err.message : 'Unbekannter Fehler');
      }
    };

    load();
  }, [stepId]);

  // ── TOGGLE TASK ───────────────────────────────────────────
  // Nachher:
  const toggleTask = (taskId: string) => {
    const isCurrentlyDone = localFinished.has(taskId);
    updateTaskFinished(taskId, !isCurrentlyDone);
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
      <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-gray-500 dark:text-gray-400">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-sm">Step wird geladen...</p>
        </div>
      </div>
    );
  }

  // ── ERROR ─────────────────────────────────────────────────
  if (loadingState === 'error') {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Step konnte nicht geladen werden
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{errorMessage}</p>
          <button
            onClick={() => navigate('/onboarding')}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-all"
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
      <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">Step nicht gefunden.</p>
          <button
            onClick={() => navigate('/onboarding')}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-all"
          >
            Zurück zum Onboarding
          </button>
        </div>
      </div>
    );
  }

  // ── RENDER ────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">

      {/* HEADER */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-950/90 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">

          <button
            onClick={() => navigate('/onboarding')}
            className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Zurück zum Onboarding
          </button>

          <div className="flex items-start justify-between gap-4">
            <div>
              {/* Status-Badge */}
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-3 ${stepDetail.status === 'FINISHED' ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400' :
                stepDetail.status === 'IN_PROGRESS' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400' :
                  stepDetail.status === 'SKIPPED' ? 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' :
                    'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
                }`}>
                {stepDetail.status === 'FINISHED' ? 'Erledigt' :
                  stepDetail.status === 'IN_PROGRESS' ? 'In Bearbeitung' :
                    stepDetail.status === 'SKIPPED' ? 'Übersprungen' : 'Offen'}
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                {stepDetail.title}
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">
                {stepDetail.description}
              </p>
            </div>

            {stepDetail.estimatedMinutes > 0 && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-900 text-sm text-gray-600 dark:text-gray-400 shrink-0">
                <Clock3 className="w-4 h-4" />
                {formatMinutes(stepDetail.estimatedMinutes)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24">
        <div className="grid lg:grid-cols-3 gap-6">

          {/* LINKE SPALTE */}
          <div className="lg:col-span-2 space-y-6">

            {/* TASKS (Step by Step) */}
            {sortedTasks.length > 0 && (
              <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-orange-500" />
                    <h2 className="font-semibold text-gray-900 dark:text-white">
                      Aufgaben
                    </h2>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {doneTasks}/{sortedTasks.length} erledigt
                  </span>
                </div>

                {/* Fortschrittsbalken */}
                <div className="bg-gray-200 dark:bg-gray-800 rounded-full h-1.5 mb-5 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500"
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
                        className={`w-full text-left flex items-start gap-4 rounded-xl border p-4 transition-all ${isDone
                          ? 'border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/20'
                          : 'border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700'
                          }`}
                      >
                        {isDone
                          ? <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                          : <Circle className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
                        }
                        <div>
                          <span className={`text-sm font-medium ${isDone
                            ? 'line-through text-gray-400 dark:text-gray-500'
                            : 'text-gray-900 dark:text-white'
                            }`}>
                            {index + 1}. {task.title}
                          </span>
                          {task.description && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
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


            {/* mark step as done */}
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-3">
                Schritt abschließen
              </h3>
              <button
                onClick={() => updateStepStatus(
                  stepDetail.status === 'FINISHED' ? 'WAITING' : 'FINISHED'
                )}
                disabled={!allTasksDone && stepDetail.status !== 'FINISHED'}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all duration-200 ${stepDetail.status === 'FINISHED'
                    ? 'border-green-400 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-950/50'
                    : allTasksDone
                      ? 'border-dashed border-gray-300 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-600 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
                      : 'border-dashed border-gray-200 dark:border-gray-800 text-gray-300 dark:text-gray-700 cursor-not-allowed'
                  }`}
              >
                {stepDetail.status === 'FINISHED'
                  ? <Trophy className="w-5 h-5 shrink-0" />
                  : <Circle className="w-5 h-5 shrink-0" />
                }
                <span className="text-sm font-medium flex-1 text-left">
                  {stepDetail.status === 'FINISHED'
                    ? 'Erledigt!'
                    : allTasksDone
                      ? 'Als erledigt markieren'
                      : `Noch ${sortedTasks.length - doneTasks} Aufgabe${sortedTasks.length - doneTasks === 1 ? '' : 'n'} offen`
                  }
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
              <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-3">
                  Ressourcen
                </h3>
                <div className="space-y-2">
                  {resources.map(resource => (
                    <a
                      key={resource.id}
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700 transition-all group"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                          {resource.title}
                        </p>
                        {resource.description && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
                            {resource.description}
                          </p>
                        )}
                      </div>
                      <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-all shrink-0 ml-2" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* FEEDBACK */}
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
              <h3 className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white text-sm mb-3">
                <MessageSquareCheck className="w-4 h-4 text-blue-500" />
                Feedback
              </h3>
              <textarea
                placeholder="Dein Feedback zu diesem Schritt..."
                className="w-full h-24 p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"
              />
              <button className="mt-3 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-all">
                Feedback absenden
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}