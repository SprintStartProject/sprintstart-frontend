// ============================================================
// OnBoardingPage.tsx
// ============================================================

import { useState, useEffect } from 'react';

import {
  CheckCircle2,
  Circle,
  Clock3,
  FileText,
  Video,
  Link2,
  ChevronRight,
  Sparkles,
  PlayCircle,
  Target,
  Loader2,
  AlertCircle,
} from 'lucide-react';


// Interfaces

// Todo: adapt to real Endpoints of Backend

export interface OnBoardingItemStep {
    id: string;
    title: string;
    completed: boolean;
}

export interface OnBoardingTask {
    id: string;
    title: string;
    description: string;
    motivation: string[];
    steps: OnBoardingItemStep[];
    finalTask: string;
    artifactUrl?: string;
}

export interface OnBoardingItem {
  id: string;
  title: string;
  description: string;
  type: 'document' | 'video' | 'link' | 'task';
  completed: boolean;
  duration?: string;
  artifactUrl?: string;
  task: OnBoardingTask;
}

export interface OnBoardingPhase {
  id: string;
  title: string;
  description: string;
  period: string;
  items: OnBoardingItem[];
}


export interface OnBoardingPath {
  userId: string;
  role: string;
  generatedAt: string;                      // ISO-Datum-String
  phases: OnBoardingPhase[];
}


type LoadingState = 'idle' | 'loading' | 'success' | 'error';


// Helper

interface OnBoardingIconProps {
  type: OnBoardingItem['type'];
  className?: string;
}

function OnBoardingIcon({ type, className }: OnBoardingIconProps) {
  switch (type) {
    case 'document': return <FileText className={className} />;
    case 'video':    return <Video className={className} />;
    case 'link':     return <Link2 className={className} />;
    default:         return <Target className={className} />;
  }
}

// ─────────────────────────────────────────────────────────────
// HELPER-KOMPONENTE: ProgressBar
// ─────────────────────────────────────────────────────────────

interface ProgressBarProps {
  value: number;  // z.B. 3 (erledigte Tasks)
  max: number;    // z.B. 5 (gesamt Tasks)
}

function ProgressBar({ value, max }: ProgressBarProps) {
  const percentage = max > 0 ? Math.round((value / max) * 100) : 0;

  return (
    <div className="bg-gray-200 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}


// ─────────────────────────────────────────────────────────────
// MOCK-DATEN (temporär, bis Backend fertig ist)
// ─────────────────────────────────────────────────────────────

const MOCK_OnBoarding_PATH: OnBoardingPath = {
  userId: 'user-123',
  role: 'Frontend Developer',
  generatedAt: new Date().toISOString(),
  phases: [
    {
      id: 'day1',
      title: 'Day 1',
      description: 'Ankommen und Grundlagen schaffen',
      period: 'Day 1',
      items: [
        {
          id: 'item-1',
          title: 'Willkommensvideo ansehen',
          description: 'Lerne das Unternehmen und das Produkt kennen.',
          type: 'video',
          completed: true,
          duration: '10 min',
          artifactUrl: '/videos/company-intro',
          task: {
            id: 'task-1',
            title: 'Unternehmen kennenlernen',
            description: 'Schaue das Einführungsvideo vollständig an.',
            motivation: [
              'Verstehe die Mission des Unternehmens',
              'Bekomme einen Überblick über Produkt und Team',
            ],
            steps: [
              {
                id: 'step-1',
                title: 'Video öffnen',
                completed: true,
              },
              {
                id: 'step-2',
                title: 'Video vollständig ansehen',
                completed: true,
              },
            ],
            finalTask: 'Die wichtigsten Erkenntnisse notieren',
            artifactUrl: '/videos/company-intro',
          },
        },
        {
          id: 'item-2',
          title: 'Entwicklungsumgebung einrichten',
          description: 'Repository klonen und Anwendung lokal starten.',
          type: 'task',
          completed: false,
          task: {
            id: 'task-2',
            title: 'Setup abschließen',
            description: 'Richte deine lokale Entwicklungsumgebung ein.',
            motivation: [
              'Du kannst anschließend selbst entwickeln',
              'Du lernst die wichtigsten Tools kennen',
            ],
            steps: [
              {
                id: 'step-1',
                title: 'Repository klonen',
                completed: true,
              },
              {
                id: 'step-2',
                title: 'Abhängigkeiten installieren',
                completed: true,
              },
              {
                id: 'step-3',
                title: 'Backend starten',
                completed: false,
              },
            ],
            finalTask: 'Anwendung lokal erfolgreich starten',
          },
        },
      ],
    },

    {
      id: 'week1',
      title: 'Week 1',
      description: 'Codebase und Prozesse verstehen',
      period: 'Week 1',
      items: [
        {
          id: 'item-3',
          title: 'Architektur-Dokumentation lesen',
          description: 'Verstehe die wichtigsten Systemkomponenten.',
          type: 'document',
          completed: false,
          duration: '30 min',
          artifactUrl: '/knowledge/architecture',
          task: {
            id: 'task-3',
            title: 'Architektur verstehen',
            description: 'Arbeite dich in die Systemarchitektur ein.',
            motivation: [
              'Besseres Verständnis der Codebase',
              'Einfacherer Einstieg in neue Features',
            ],
            steps: [
              {
                id: 'step-1',
                title: 'Dokument öffnen',
                completed: true,
              },
              {
                id: 'step-2',
                title: 'Frontend-Bereich lesen',
                completed: false,
              },
              {
                id: 'step-3',
                title: 'Backend-Bereich lesen',
                completed: false,
              },
            ],
            finalTask: 'Architekturdiagramm erklären können',
            artifactUrl: '/knowledge/architecture',
          },
        },
        {
          id: 'item-4',
          title: 'Erstes GitHub Issue bearbeiten',
          description: 'Implementiere ein kleines Feature oder einen Bugfix.',
          type: 'task',
          completed: false,
          task: {
            id: 'task-4',
            title: 'Ersten Pull Request erstellen',
            description: 'Durchlaufe den kompletten Entwicklungsprozess.',
            motivation: [
              'Praktischer Einstieg in die Codebase',
              'Lerne den Review-Prozess kennen',
            ],
            steps: [
              {
                id: 'step-1',
                title: 'Issue auswählen',
                completed: false,
              },
              {
                id: 'step-2',
                title: 'Lösung implementieren',
                completed: false,
              },
              {
                id: 'step-3',
                title: 'Pull Request erstellen',
                completed: false,
              },
            ],
            finalTask: 'Pull Request erfolgreich mergen',
          },
        },
      ],
    },

    {
      id: 'month1',
      title: 'Month 1',
      description: 'Eigenständig Verantwortung übernehmen',
      period: 'Month 1',
      items: [
        {
          id: 'item-5',
          title: 'Security Guidelines durcharbeiten',
          description: 'Lerne die wichtigsten Sicherheitsrichtlinien kennen.',
          type: 'document',
          completed: false,
          duration: '20 min',
          artifactUrl: '/knowledge/security',
          task: {
            id: 'task-5',
            title: 'Security Grundlagen verstehen',
            description: 'Arbeite die Security-Dokumentation durch.',
            motivation: [
              'Vermeide Sicherheitslücken',
              'Arbeite sicher an produktivem Code',
            ],
            steps: [
              {
                id: 'step-1',
                title: 'Authentifizierung lesen',
                completed: false,
              },
              {
                id: 'step-2',
                title: 'Berechtigungskonzept lesen',
                completed: false,
              },
            ],
            finalTask: 'Security Quiz bestehen',
            artifactUrl: '/knowledge/security',
          },
        },
        {
          id: 'item-6',
          title: 'Feature eigenständig liefern',
          description: 'Plane und implementiere ein kleines Feature.',
          type: 'task',
          completed: false,
          task: {
            id: 'task-6',
            title: 'Feature Ownership übernehmen',
            description: 'Von Anforderung bis Deployment.',
            motivation: [
              'Eigenverantwortung übernehmen',
              'Produktverständnis vertiefen',
            ],
            steps: [
              {
                id: 'step-1',
                title: 'Anforderungen analysieren',
                completed: false,
              },
              {
                id: 'step-2',
                title: 'Implementieren',
                completed: false,
              },
              {
                id: 'step-3',
                title: 'Deployment begleiten',
                completed: false,
              },
            ],
            finalTask: 'Feature erfolgreich in Produktion bringen',
          },
        },
      ],
    },
  ],
};


// ─────────────────────────────────────────────────────────────
// HAUPT-KOMPONENTE: OnBoardingPage
// ─────────────────────────────────────────────────────────────


export function OnBoardingPage() {

  // Selected Phase
  const [selectedPhaseIndex, setSelectedPhaseIndex] = useState<number>(0);

  // OnBoarding-Daten (null = noch nicht geladen)
  const [OnBoardingPath, setOnBoardingPath] = useState<OnBoardingPath | null>(null);

  // Loading State: 'idle' (vor dem Laden), 'loading' (während Laden), 'success' (geladen), 'error' (Fehler)
  const [loadingState, setLoadingState] = useState<LoadingState>('idle');

  // Fehlermeldung für den Error-State
  const [errorMessage, setErrorMessage] = useState<string>('');


 // ── DATA FETCHING mit useEffect ─────────────────────────────

  useEffect(() => {
    const loadOnBoardingPath = async () => {
      setLoadingState('loading');

      try {
        // ── [TODO] HIER KOMMT DER ECHTE API-CALL ────────────
        // Wenn Backend-Endpoint bekannt, ersetze den Mock-Code:
        //
        //   const response = await fetch('/api/OnBoarding/path');
        //
        //   if (!response.ok) {
        //     throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        //   }
        //
        //   const data: OnBoardingPath = await response.json();
        //   setOnBoardingPath(data);
        //
        // ── AKTUELL: Mock-Daten mit simuliertem Delay ────────
        await new Promise(resolve => setTimeout(resolve, 800));
        setOnBoardingPath(MOCK_OnBoarding_PATH);
        // ─────────────────────────────────────────────────────

        setLoadingState('success');
      } catch (err) {
        setLoadingState('error');
        setErrorMessage(err instanceof Error ? err.message : 'Unbekannter Fehler');
      }
    };

    loadOnBoardingPath();
  }, []);



  const currentPhase = OnBoardingPath?.phases[selectedPhaseIndex] ?? null;

  // Hilfsfunktion für Fortschritt einer Phase
  const getPhaseProgress = (phase: OnBoardingPhase) => {
    const completed = phase.items.filter(item => item.completed).length;
    return {
      completed,
      total: phase.items.length,
      percentage: phase.items.length > 0
        ? Math.round((completed / phase.items.length) * 100)
        : 0,
    };
  };

  // Gesamtfortschritt über alle Phasen
  const totalProgress = OnBoardingPath?.phases.reduce(
    (acc, phase) => {
      const p = getPhaseProgress(phase);
      return { completed: acc.completed + p.completed, total: acc.total + p.total };
    },
    { completed: 0, total: 0 }
  ) ?? { completed: 0, total: 0 };

  const totalPercentage = totalProgress.total > 0
    ? Math.round((totalProgress.completed / totalProgress.total) * 100)
    : 0;

  // Nächste unerledigte Task (über alle Phasen)
  const nextTask = OnBoardingPath?.phases
    .flatMap(phase => phase.items)
    .find(item => !item.completed) ?? null;

  // Task als erledigt markieren (lokal, bis Backend-Patch-Endpoint fertig ist)
  // [TODO] Später durch API-Call ersetzen: PATCH /api/OnBoarding/items/:id
  const toggleItemCompleted = (itemId: string) => {
    if (!OnBoardingPath) return;

    setOnBoardingPath({
      ...OnBoardingPath,
      phases: OnBoardingPath.phases.map(phase => ({
        ...phase,
        items: phase.items.map(item =>
          item.id === itemId
            ? { ...item, completed: !item.completed } // toggle
            : item
        ),
      })),
    });
  };


  // ── RENDER: LOADING STATE ──────────────────────────────────
  if (loadingState === 'loading' || loadingState === 'idle') {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-gray-500 dark:text-gray-400">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-sm">OnBoarding Path wird geladen...</p>
        </div>
      </div>
    );
  }

  // ── RENDER: ERROR STATE ────────────────────────────────────
  if (loadingState === 'error') {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            OnBoarding konnte nicht geladen werden
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{errorMessage}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-all"
          >
            Nochmal versuchen
          </button>
        </div>
      </div>
    );
  }

  // ── RENDER: EMPTY STATE ────────────────────────────────────
  if (!OnBoardingPath || !currentPhase) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Kein OnBoarding Path gefunden.
        </p>
      </div>
    );
  }


  // ── RENDER: SUCCESS STATE ──────────────────────────────────
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">

      {/* ── HEADER ───────────────────────────────────────── */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-950/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">

          {/* Titel + Gesamt-Prozent */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-5 h-5 text-blue-500" />
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Dein OnBoarding Journey
                </h1>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Rolle: {OnBoardingPath.role}
              </p>
            </div>

            <div className="text-right">
              <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">
                {totalPercentage}%
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">gesamt</div>
            </div>
          </div>

          {/* Gesamt-Progressbar */}
          <ProgressBar value={totalProgress.completed} max={totalProgress.total} />

          {/* Phasen-Tabs */}
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            {OnBoardingPath.phases.map((phase, index) => {
              const progress = getPhaseProgress(phase);
              const isSelected = selectedPhaseIndex === index;

              return (
                <button
                  key={phase.id}
                  onClick={() => setSelectedPhaseIndex(index)}
                  className={`flex-1 rounded-2xl border p-4 transition-all text-left ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40'
                      : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-white dark:bg-gray-950'
                  }`}
                >
                  <div className="font-semibold text-gray-900 dark:text-white text-sm mb-1">
                    {phase.title}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    {phase.period}
                  </div>
                  <ProgressBar value={progress.completed} max={progress.total} />
                  <div className="flex justify-between mt-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {progress.completed}/{progress.total} Tasks
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      progress.percentage === 100
                        ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                    }`}>
                      {progress.percentage}%
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>


      {/* ── MAIN CONTENT ─────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 pt-8">

        {/* "Up Next" Banner — nur wenn es einen nächsten Task gibt */}
        {nextTask && (
          <div className="rounded-3xl border border-blue-200 dark:border-blue-900 bg-white dark:bg-gray-950 p-6 sm:p-8 mb-6 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-3xl rounded-full pointer-events-none" />
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 text-xs font-medium mb-4">
                <PlayCircle className="w-3.5 h-3.5" />
                Up Next
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                {nextTask.title}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mt-2 max-w-2xl">
                {nextTask.description}
              </p>
              <div className="flex flex-wrap items-center gap-4 mt-6">
                <button
                  onClick={() => toggleItemCompleted(nextTask.id)}
                  className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-all flex items-center gap-2"
                >
                  Als erledigt markieren
                  <ChevronRight className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                  <OnBoardingIcon type={nextTask.type} className="w-4 h-4" />
                  <span className="capitalize">{nextTask.type}</span>
                </div>
                {nextTask.duration && (
                  <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                    <Clock3 className="w-4 h-4" />
                    {nextTask.duration}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Phase-Beschreibung */}
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {currentPhase.title}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {currentPhase.description}
          </p>
        </div>

        {/* Task-Liste */}
        <div className="space-y-4">
          {currentPhase.items.map((item) => (
            <div
              key={item.id}
              className={`group rounded-2xl border transition-all bg-white dark:bg-gray-900 ${
                item.completed
                  ? 'border-gray-200 dark:border-gray-800 opacity-60'
                  : 'border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-lg'
              }`}
            >
              <div className="p-5">
                <div className="flex gap-4">

                  {/* Checkbox-Button */}
                  <button
                    onClick={() => toggleItemCompleted(item.id)}
                    className="pt-0.5 shrink-0 transition-transform hover:scale-110"
                    aria-label={item.completed ? 'Als unerledigt markieren' : 'Als erledigt markieren'}
                  >
                    {item.completed
                      ? <CheckCircle2 className="w-6 h-6 text-green-500" />
                      : <Circle className="w-6 h-6 text-blue-400" />
                    }
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">

                      {/* Text */}
                      <div>
                        <h3 className={`font-semibold text-base ${
                          item.completed
                            ? 'line-through text-gray-400 dark:text-gray-500'
                            : 'text-gray-900 dark:text-white'
                        }`}>
                          {item.title}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
                          {item.description}
                        </p>
                        {/* Meta-Infos */}
                        <div className="flex flex-wrap items-center gap-4 mt-3">
                          <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                            <OnBoardingIcon type={item.type} className="w-4 h-4" />
                            <span className="text-xs capitalize">{item.type}</span>
                          </div>
                          {item.duration && (
                            <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                              <Clock3 className="w-4 h-4" />
                              <span className="text-xs">{item.duration}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Artifact-Link — [TODO] Navigate to artifact detail */}
                      {item.artifactUrl && !item.completed && (
                        <a
                          href={item.artifactUrl}
                          className="shrink-0 px-4 py-2 rounded-xl border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 transition-all text-sm font-medium flex items-center gap-2 whitespace-nowrap"
                        >
                          Öffnen
                          <ChevronRight className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}