// ============================================================
// OnBoardingPage.tsx
// ============================================================

import { useState, useEffect } from 'react';
import type { OnboardingPathEndpoint, OnboardingPhaseEndpoint, OnboardingTaskEndpoint, OnboardingStepEndpoint, OnboardingResourceEndpoint, StepStatus} from '../types/onboarding';
import { useNavigate } from 'react-router-dom';

import {
    CheckCircle2,
    Circle,
    ChevronRight,
    Sparkles,
    PlayCircle,
    Loader2,
    AlertCircle,
} from 'lucide-react';

// Interfaces - imported
// Todo: adapt to real Endpoints of Backend

const BASE_API_URL = 'http://localhost:8080/api/v1';
type LoadingState = 'idle' | 'loading' | 'success' | 'error';



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


// ─────────────────────────────────────────────────────────────
// MOCK-DATEN (temporär, bis Backend fertig ist) - auch imported
// ─────────────────────────────────────────────────────────────

//const MOCK_OnBoarding_PATH: OnBoardingPath = mockData as OnBoardingPath;



// ─────────────────────────────────────────────────────────────
// HAUPT-KOMPONENTE: OnBoardingPage
// ─────────────────────────────────────────────────────────────


export function OnBoardingPage() {

    // Selected Phase
    const [selectedPhaseIndex, setSelectedPhaseIndex] = useState<number>(1);

    // OnBoarding-Daten (null = noch nicht geladen)
    const [OnBoardingPathEndpoint, setOnBoardingPath] = useState<OnboardingPathEndpoint | null>(null);

    // Loading State: 'idle' (vor dem Laden), 'loading' (während Laden), 'success' (geladen), 'error' (Fehler)
    const [loadingState, setLoadingState] = useState<LoadingState>('idle');

    // Fehlermeldung für den Error-State
    const [errorMessage, setErrorMessage] = useState<string>('');

    const navigate = useNavigate();


    // ── DATA FETCHING mit useEffect ─────────────────────────────

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



    const currentPhase = OnBoardingPathEndpoint?.phases[selectedPhaseIndex] ?? null;

    // Hilfsfunktion für Fortschritt einer Phase
    const getPhaseProgress = (phase: OnboardingPhaseEndpoint) => {
        const completed = phase.steps.filter(step => step.status === 'DONE').length;
        return {
            completed,
            total: phase.steps.length,
            percentage: phase.steps.length > 0
                ? Math.round((completed / phase.steps.length) * 100)
                : 0,
        };
    };

    // Gesamtfortschritt über alle Phasen
    const totalProgress = OnBoardingPathEndpoint?.phases.reduce(
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
    const nextTask = OnBoardingPathEndpoint?.phases
        .flatMap(phase => phase.steps)
        .find(step => step.status !== 'DONE') ?? null;

    // Task als erledigt markieren (lokal, bis Backend-Patch-Endpoint fertig ist)
    // [TODO] Später durch API-Call ersetzen: PATCH /api/OnBoarding/steps/:id
    const toggleItemCompleted = (itemId: string) => {
        if (!OnBoardingPathEndpoint) return;

        setOnBoardingPath({
            ...OnBoardingPathEndpoint,
            phases: OnBoardingPathEndpoint.phases.map(phase => ({
                ...phase,
                steps: phase.steps.map(step =>
                    step.id === itemId
                        ? { ...step, status: step.status === 'DONE' ? 'TODO' : 'DONE' } // toggle
                        : step
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
    if (!OnBoardingPathEndpoint || !currentPhase) {
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
                        {OnBoardingPathEndpoint.phases.map((phase, index) => {
                            const progress = getPhaseProgress(phase);
                            const isSelected = selectedPhaseIndex === index;

                            return (
                                <button
                                    key={phase.id}
                                    onClick={() => setSelectedPhaseIndex(index)}
                                    className={`flex-1 rounded-2xl border p-4 transition-all text-left ${isSelected
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40'
                                        : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-white dark:bg-gray-950'
                                        }`}
                                >
                                    <div className="font-semibold text-gray-900 dark:text-white text-sm mb-1">
                                        {phase.title}
                                    </div>
                                    <ProgressBar value={progress.completed} max={progress.total} />
                                    <div className="flex justify-between mt-2">
                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                            {progress.completed}/{progress.total} Tasks
                                        </span>
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${progress.percentage === 100
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
                                    onClick={() => navigate(`/onboarding/${nextTask.id}`)}
                                    className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-all flex items-center gap-2"
                                >
                                    Jetzt starten
                                    <ChevronRight className="w-4 h-4" />
                                </button>
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
                    {currentPhase.steps.map((step) => (
                        <div
                            key={step.id}
                            className={`group rounded-2xl border transition-all bg-white dark:bg-gray-900 ${step.status === 'DONE'
                                ? 'border-gray-200 dark:border-gray-800 opacity-60'
                                : 'border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-lg'
                                }`}
                        >
                            <div className="p-5">
                                <div className="flex gap-4">

                                    {/* Checkbox-Button */}
                                    <button
                                        onClick={() => toggleItemCompleted(step.id)}
                                        className="pt-0.5 shrink-0 transition-transform hover:scale-110"
                                        aria-label={step.status === 'DONE' ? 'Als unerledigt markieren' : 'Als erledigt markieren'}
                                    >
                                        {step.status === 'DONE'
                                            ? <CheckCircle2 className="w-6 h-6 text-green-500" />
                                            : <Circle className="w-6 h-6 text-blue-400" />
                                        }
                                    </button>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">

                                            {/* Text */}
                                            <div>
                                                <h3 className={`font-semibold text-base ${step.status === 'DONE'
                                                    ? 'line-through text-gray-400 dark:text-gray-500'
                                                    : 'text-gray-900 dark:text-white'
                                                    }`}>
                                                    {step.title}
                                                </h3>
                                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
                                                    {step.description}
                                                </p>
                                                {/* Meta-Infos */}
                                            </div>

                                            <button
                                                onClick={() => navigate(`/onboarding/${step.id}`)}
                                                className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-all flex items-center gap-2"
                                            >
                                                Jetzt starten
                                                <ChevronRight className="w-4 h-4" />
                                            </button>
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