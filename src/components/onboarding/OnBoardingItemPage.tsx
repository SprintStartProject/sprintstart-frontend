import type { OnBoardingPath, OnBoardingItem, OnBoardingTask, OnBoardingStep } from '../../types/onboarding';
import type { OnboardingPathEndpoint, OnboardingPhaseEndpoint, OnboardingTaskEndpoint, OnboardingStepEndpoint, OnboardingResourceEndpoint, OnboardingStepDetail, StepStatus} from '../types/onboarding';
import mockData from '../../mocks/onboardingMock.json';
import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock3,
  Sparkles,
  Trophy,
  Target,
  ExternalLink,
  MessageSquareCheck,
  ChevronRight,
} from 'lucide-react';

//const MOCK_OnBoarding_PATH: OnBoardingPath = mockData as OnBoardingPath;

const BASE_API_URL = 'http://localhost:8080/api/v1';
type LoadingState = 'idle' | 'loading' | 'success' | 'error';


function fetchPath(userId: string): Promise<OnboardingPathEndpoint> {
    return fetch(`${BASE_API_URL}/onboarding/${userId}/path`)
        .then(res => {
            if (!res.ok) {
                throw new Error(`Fehler beim Laden des OnBoarding Paths: ${res.statusText}`);
            }
            return res.json();
        })
        .then(data => data as OnboardingPathEndpoint);
}

function fetchAllTasksOfStep(stepId: string): Promise<OnboardingTaskEndpoint[]> {
    return fetch(`${BASE_API_URL}/onboarding/steps/${stepId}/tasks`)
        .then(res => {
            if (!res.ok) {
                throw new Error(`Fehler beim Laden der Tasks: ${res.statusText}`);
            }
            return res.json();
        })
        .then(data => data as OnboardingTaskEndpoint[]);
}

function fetchStep(stepId: string): Promise<OnboardingStepEndpoint> {
    return fetch(`${BASE_API_URL}/onboarding/steps/${stepId}`)
        .then(res => {
            if (!res.ok) {
                throw new Error(`Fehler beim Laden der Steps für Phase ${stepId}: ${res.statusText}`);
            }
            return res.json();
        })
        .then(data => data as OnboardingStepEndpoint);
}

function fetchStepDetail(stepId: string): Promise<OnboardingStepDetail> {
    return fetch(`${BASE_API_URL}/onboarding/steps/${stepId}`)
        .then(res => {
            if (!res.ok) {
                throw new Error(`Fehler beim Laden der Step-Details: ${res.statusText}`);
            }
            return res.json();
        })
        .then(data => data as OnboardingStepDetail);
}

// ── HAUPT-KOMPONENTE ─────────────────────────────────────────
export function OnBoardingItemPage() {

      // Selected Phase
      const [selectedPhaseIndex, setSelectedPhaseIndex] = useState<number>(1);
  
      // OnBoarding-Daten (null = noch nicht geladen)
      const [OnBoardingPathEndpoint, setOnBoardingPath] = useState<OnboardingPathEndpoint | null>(null);
  
      // Loading State: 'idle' (vor dem Laden), 'loading' (während Laden), 'success' (geladen), 'error' (Fehler)
      const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  
      // Fehlermeldung für den Error-State
      const [errorMessage, setErrorMessage] = useState<string>('');
  
          useEffect(() => {
        const loadOnBoardingPath = async () => {
            setLoadingState('loading');
            try {
                // find USER
                const usersRes = await fetch(`${BASE_API_URL}/users`);
                if (!usersRes.ok) throw new Error(`Users: HTTP ${usersRes.status}`);
                const users = await usersRes.json();
                const userId: string = users[0]?.id;
                if (!userId) throw new Error('Kein User gefunden.');
                console.log('Gefundener User ID:', userId);

                // fetch PATH
                const path = await fetchPath(userId);
                console.log('Geladener OnBoarding Path:', path);

                setOnBoardingPath(path);


                setLoadingState('success');
            } catch (err) {
                setLoadingState('error');
                setErrorMessage(err instanceof Error ? err.message : 'Unbekannter Fehler');
            }
        };

        loadOnBoardingPath();
    }, []);


  const { stepId: stepId } = useParams();
  const navigate = useNavigate();
  
  const myStep = fetchStep(stepId!).catch((err) => {
    console.error('Fehler beim Laden der Step-Daten:', err);
    return null; // Rückfall auf null, damit die Seite nicht komplett crasht
  });

  // [CONCEPT] useState für die Step-Checkboxen auf dieser Page.
  // Wir speichern welche Steps der User lokal abgehakt hat.
  // TODO: später mit Backend synchronisieren
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);

  // Step toggle — gleiche Immutability-Logik wie in OnBoardingPage
  const toggleStep = (stepId: string) => {
    setCompletedSteps((prev) =>
      prev.includes(stepId)
        ? prev.filter((id) => id !== stepId)
        : [...prev, stepId]
    );
  };

  // ── EMPTY STATE ──────────────────────────────────────────
  if (!myStep) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">Item nicht gefunden.</p>
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

  const tasksOfStep = fetchAllTasksOfStep(stepId!);

  // Fortschritt der Steps berechnen
  const totalTasks = (await tasksOfStep)?.length ?? 0;
  const doneSteps = (await tasksOfStep)?.filter(
    (s) => s.finished || completedSteps.includes(s.id)
  ).length ?? 0;
  const stepPercentage = totalTasks > 0 ? Math.round((doneSteps / totalTasks) * 100) : 0;

  // ── RENDER ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">

      {/* ── HEADER ─────────────────────────────────────────── */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-950/90 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">

          {/* Back Button */}
          <button
            onClick={() => navigate('/onboarding')}
            className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Zurück zum Onboarding
          </button>

          {/* Titel + Typ-Badge */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 text-xs font-medium mb-3">
                <span className="capitalize">{myStep.type}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                {myStep.title}
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">
                {myStep.description}
              </p>
            </div>

            {/* Dauer */}
            {myStep.duration && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-900 text-sm text-gray-600 dark:text-gray-400 shrink-0">
                <Clock3 className="w-4 h-4" />
                {myStep.duration}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ───────────────────────────────────── */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24">
        <div className="grid lg:grid-cols-3 gap-6">

          {/* ── LINKE SPALTE (2/3 breit) ─────────────────── */}
          <div className="lg:col-span-2 space-y-6">

            {/* MOTIVATION */}
            {tasksOfStep?.motivation && tasksOfStep.motivation.length > 0 && (
              <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-5 h-5 text-blue-500" />
                  <h2 className="font-semibold text-gray-900 dark:text-white">
                    Nach diesem Schritt kannst du...
                  </h2>
                </div>
              </div>
            )}

            {/* STEP BY STEP */}
            {tasksOfStep?.steps && tasksOfStep.steps.length > 0 && (
              <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-orange-500" />
                    <h2 className="font-semibold text-gray-900 dark:text-white">
                      Step by Step
                    </h2>
                  </div>
                  {/* Mini-Fortschritt */}
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {doneSteps}/{totalTasks} erledigt
                  </span>
                </div>

                {/* Fortschrittsbalken */}
                <div className="bg-gray-200 dark:bg-gray-800 rounded-full h-1.5 mb-5 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500"
                    style={{ width: `${stepPercentage}%` }}
                  />
                </div>

                <div className="space-y-3">
                  {tasksOfStep.steps.map((step: OnboardingStepEndpoint, index: number) => {
                    const isDone = step.finished || completedSteps.includes(step.id);
                    return (
                      <button
                        key={step.id}
                        onClick={() => toggleStep(step.id)}
                        className={`w-full text-left flex items-center gap-4 rounded-xl border p-4 transition-all ${isDone
                            ? 'border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/20'
                            : 'border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700'
                          }`}
                      >
                        {isDone
                          ? <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                          : <Circle className="w-5 h-5 text-gray-400 shrink-0" />
                        }
                        <span className={`text-sm font-medium ${isDone
                            ? 'line-through text-gray-400 dark:text-gray-500'
                            : 'text-gray-900 dark:text-white'
                          }`}>
                          {index + 1}. {step.title}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* FINAL TASK */}
            {tasksOfStep?.finalTask && (
              <div className="rounded-2xl border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/20 p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <h2 className="font-semibold text-gray-900 dark:text-white">
                    Abschluss-Aufgabe
                  </h2>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                  {tasksOfStep.finalTask}
                </p>
                <button className="px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-all flex items-center gap-2">
                  Als abgeschlossen markieren
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* ── RECHTE SPALTE (1/3 breit) ────────────────── */}
          <div className="space-y-6">

            {/* ARTIFACT LINK */}
            {myStep.artifactUrl && (
              <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-3">
                  Zugehöriges Artifact
                </h3>
                <a
                  href={myStep.artifactUrl}
                  className="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700 transition-all group"
                >
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Artifact öffnen
                  </span>
                  <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-all" />
                </a>
              </div>
            )}

            {/* ITEM STATUS */}
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-3">
                Status
              </h3>
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm ${myStep.finished
                  ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                }`}>
                {myStep.finished
                  ? <CheckCircle2 className="w-4 h-4" />
                  : <Circle className="w-4 h-4" />
                }
                {myStep.finished ? 'Abgeschlossen' : 'Offen'}
              </div>
            </div>
            {/* FEEDBACK */}
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
                <h3 className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white text-sm mb-3">
                  <MessageSquareCheck className="w-4 h-4 text-blue-500" /> Feedback
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