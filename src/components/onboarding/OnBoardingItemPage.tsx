import type { OnBoardingPath, OnBoardingItem, OnBoardingTask, OnBoardingStep } from '../../types/onboarding';
import mockData from '../../mocks/onboardingMock.json';
import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock3,
  Sparkles,
  Trophy,
  Target,
  FileText,
  Video,
  Link2,
  ExternalLink,
  MessageSquareCheck,
  ChevronRight,
} from 'lucide-react';

const MOCK_OnBoarding_PATH: OnBoardingPath = mockData as OnBoardingPath;

// ── HELPER: Icon (gleich wie in OnBoardingPage) ──────────────
function OnBoardingIcon({ type, className }: { type: OnBoardingItem['type']; className?: string }) {
  switch (type) {
    case 'document': return <FileText className={className} />;
    case 'video': return <Video className={className} />;
    case 'link': return <Link2 className={className} />;
    default: return <Target className={className} />;
  }
}

// ── HAUPT-KOMPONENTE ─────────────────────────────────────────
export function OnBoardingItemPage() {
  const { itemId } = useParams();
  const navigate = useNavigate();

  // [CONCEPT] useState für die Step-Checkboxen auf dieser Page.
  // Wir speichern welche Steps der User lokal abgehakt hat.
  // TODO: später mit Backend synchronisieren
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);

  // Item aus Mock heraussuchen
  const allItems = MOCK_OnBoarding_PATH.phases.flatMap((phase) => phase.items);
  const myItem: OnBoardingItem | undefined = allItems.find((item) => item.id === itemId);

  // Step toggle — gleiche Immutability-Logik wie in OnBoardingPage
  const toggleStep = (stepId: string) => {
    setCompletedSteps((prev) =>
      prev.includes(stepId)
        ? prev.filter((id) => id !== stepId)
        : [...prev, stepId]
    );
  };

  // ── EMPTY STATE ──────────────────────────────────────────
  if (!myItem) {
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

  const task: OnBoardingTask | undefined = myItem.task;

  // Fortschritt der Steps berechnen
  const totalSteps = task?.steps.length ?? 0;
  const doneSteps = task?.steps.filter(
    (s) => s.completed || completedSteps.includes(s.id)
  ).length ?? 0;
  const stepPercentage = totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0;

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
                <OnBoardingIcon type={myItem.type} className="w-3.5 h-3.5" />
                <span className="capitalize">{myItem.type}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                {myItem.title}
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">
                {myItem.description}
              </p>
            </div>

            {/* Dauer */}
            {myItem.duration && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-900 text-sm text-gray-600 dark:text-gray-400 shrink-0">
                <Clock3 className="w-4 h-4" />
                {myItem.duration}
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
            {task?.motivation && task.motivation.length > 0 && (
              <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-5 h-5 text-blue-500" />
                  <h2 className="font-semibold text-gray-900 dark:text-white">
                    Nach diesem Schritt kannst du...
                  </h2>
                </div>
                <div className="space-y-3">
                  {task.motivation.map((point, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 p-3"
                    >
                      <CheckCircle2 className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{point}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* STEP BY STEP */}
            {task?.steps && task.steps.length > 0 && (
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
                    {doneSteps}/{totalSteps} erledigt
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
                  {task.steps.map((step: OnBoardingStep, index: number) => {
                    const isDone = step.completed || completedSteps.includes(step.id);
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
            {task?.finalTask && (
              <div className="rounded-2xl border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/20 p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <h2 className="font-semibold text-gray-900 dark:text-white">
                    Abschluss-Aufgabe
                  </h2>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                  {task.finalTask}
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
            {myItem.artifactUrl && (
              <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-3">
                  Zugehöriges Artifact
                </h3>
                <a
                  href={myItem.artifactUrl}
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
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm ${myItem.completed
                  ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                }`}>
                {myItem.completed
                  ? <CheckCircle2 className="w-4 h-4" />
                  : <Circle className="w-4 h-4" />
                }
                {myItem.completed ? 'Abgeschlossen' : 'Offen'}
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