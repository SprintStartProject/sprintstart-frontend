// ============================================================
// OnBoardingPage.tsx
// ============================================================

import { useState, useEffect } from 'react';
import type { OnboardingPathEndpoint, OnboardingPhaseEndpoint } from '../types/onboarding';
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
import type {UserProfile} from "../services/types.ts";
//import { useAuth } from '../context/useAuth.ts';

const BASE_API_URL = 'http://localhost:8080/api/v1';

type LoadingState = 'idle' | 'loading' | 'success' | 'error';

//const { profile, status } = useAuth();
//const userLoading = status === 'loading';
//const userError = status === 'unauthenticated' ? 'Nicht eingeloggt.' : null;


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
        <div className="h-2 overflow-hidden rounded-full bg-app-progress-track">
            <div
                className="h-full rounded-full bg-gradient-to-r from-app-progress-fill to-app-progress-fill-end transition-all duration-500"
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
// HAUPT-KOMPONENTE: OnBoardingPage
// ─────────────────────────────────────────────────────────────


export function OnBoardingPage() {

    // Selected Phase
    const [selectedPhaseIndex, setSelectedPhaseIndex] = useState<number>(0);

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
                const users = (await usersRes.json()) as UserProfile[];

                // ToDo: Statt einfach den 2. User zu nehmen, sollte hier die Logik rein, um den aktuell eingeloggten User zu identifizieren (z.B. über Context oder Auth Hook)
                const userId: string = users[1]?.id;
                if (!userId) throw new Error('Kein User gefunden.');
                //console.log('Gefundener User ID:', userId);

                // fetch PATH
                const path = await fetchPath(userId);
                //console.log('Geladener OnBoarding Path:', path);

                setOnBoardingPath(path);


                setLoadingState('success');
            } catch (err) {
                setLoadingState('error');
                setErrorMessage(err instanceof Error ? err.message : 'Unbekannter Fehler');
            }
        };

        void loadOnBoardingPath();
    }, []);



    const currentPhase = OnBoardingPathEndpoint?.phases[selectedPhaseIndex] ?? null;

    // Hilfsfunktion für Fortschritt einer Phase
    const getPhaseProgress = (phase: OnboardingPhaseEndpoint) => {
        const completed = phase.steps.filter(step => step.status === 'FINISHED').length;
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
        .find(step => step.status !== 'FINISHED') ?? null;


    // ── RENDER: LOADING STATE ──────────────────────────────────
    if (loadingState === 'loading' || loadingState === 'idle') {
        return (
            <div className="flex min-h-screen items-center justify-center bg-app-bg">
                <div className="flex flex-col items-center gap-4 text-app-text-subtle">
                    <Loader2 className="h-8 w-8 animate-spin text-app-brand-text" />
                    <p className="text-sm">OnBoarding Path wird geladen...</p>
                </div>
            </div>
        );
    }

    // ── RENDER: ERROR STATE ────────────────────────────────────
    if (loadingState === 'error') {
        return (
            <div className="flex min-h-screen items-center justify-center bg-app-bg p-8">
                <div className="max-w-md text-center">
                    <AlertCircle className="mx-auto mb-4 h-12 w-12 text-app-danger-text" />

                    <h2 className="mb-2 text-xl font-semibold text-app-text">
                        OnBoarding konnte nicht geladen werden
                    </h2>

                    <p className="mb-6 text-sm text-app-text-subtle">
                        {errorMessage}
                    </p>

                    <button
                        onClick={() => window.location.reload()}
                        className="rounded-xl bg-app-brand px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-app-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus"
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
            <div className="flex min-h-screen items-center justify-center bg-app-bg">
                <p className="text-sm text-app-text-subtle">
                    Kein OnBoarding Path gefunden.
                </p>
            </div>
        );
    }


    // ── RENDER: SUCCESS STATE ──────────────────────────────────
    return (
        <div className="min-h-screen bg-app-bg text-app-text">
            <div className="border-b border-app-border bg-app-bg/90 backdrop-blur-xl">
                <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <div className="mb-1 flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-app-brand-text" />

                                <h1 className="text-2xl font-bold text-app-text">
                                    Dein OnBoarding Journey
                                </h1>
                            </div>
                        </div>

                        <div className="text-right">
                            <div className="text-4xl font-bold text-app-brand-text">
                                {totalPercentage}%
                            </div>

                            <div className="text-xs text-app-text-subtle">
                                gesamt
                            </div>
                        </div>
                    </div>

                    {/* Gesamt-Progressbar */}
                    <ProgressBar value={totalProgress.completed} max={totalProgress.total} />

                    <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                        {OnBoardingPathEndpoint.phases.map((phase, index) => {
                            const progress = getPhaseProgress(phase);
                            const isSelected = selectedPhaseIndex === index;

                            return (
                                <button
                                    key={phase.id}
                                    onClick={() => setSelectedPhaseIndex(index)}
                                    className={`flex-1 rounded-2xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus ${
                                        isSelected
                                            ? 'border-app-brand-border bg-app-brand-soft'
                                            : 'border-app-border bg-app-surface hover:border-app-border-strong hover:bg-app-surface-hover'
                                    }`}
                                >
                                    <div className="mb-1 text-sm font-semibold text-app-text">
                                        {phase.title}
                                    </div>
                                    <ProgressBar value={progress.completed} max={progress.total} />

                                    <div className="mt-2 flex justify-between">
                                        <span className="text-xs text-app-text-subtle">
                                            {progress.completed}/{progress.total} Tasks
                                        </span>

                                        <span
                                            className={`rounded-full px-2 py-0.5 text-xs ${
                                                progress.percentage === 100
                                                    ? 'bg-app-success-bg text-app-success-text'
                                                    : 'bg-app-neutral-bg text-app-neutral-text'
                                            }`}
                                        >
                                            {progress.percentage}%
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            <main className="mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6 lg:px-8">
                {nextTask && (
                    <div className="relative mb-6 overflow-hidden rounded-3xl border border-app-brand-border bg-app-surface p-6 sm:p-8">
                        <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full bg-app-brand-soft blur-3xl" />

                        <div className="relative z-10">
                            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-app-brand-soft px-3 py-1 text-xs font-medium text-app-brand-text">
                                <PlayCircle className="h-3.5 w-3.5" />
                                Up Next
                            </div>

                            <h2 className="text-2xl font-bold text-app-text sm:text-3xl">
                                {nextTask.title}
                            </h2>

                            <p className="mt-2 max-w-2xl text-app-text-muted">
                                {nextTask.description}
                            </p>

                            <div className="mt-6 flex flex-wrap items-center gap-4">
                                <button
                                    onClick={() => void navigate(`/onboarding/${nextTask.id}`)}
                                    className="flex items-center gap-2 rounded-xl bg-app-brand px-6 py-3 text-sm font-medium text-white transition-all hover:bg-app-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus"
                                >
                                    Jetzt starten
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Phase-Beschreibung */}
                <div className="mb-4">
                    <h2 className="text-lg font-semibold text-app-text">
                        {currentPhase.title}
                    </h2>

                    <p className="mt-1 text-sm text-app-text-subtle">
                        {currentPhase.description}
                    </p>
                </div>

                {/* Task-Liste */}
                <div className="space-y-4">
                    {currentPhase.steps.map((step) => (
                        <div
                            key={step.id}
                            className={`group rounded-2xl border bg-app-surface transition-all ${
                                step.status === 'FINISHED'
                                    ? 'border-app-border opacity-60'
                                    : 'border-app-border hover:border-app-brand-border hover:shadow-lg'
                            }`}
                        >
                            <div className="p-5">
                                <div className="flex gap-4">
                                    <div className="shrink-0 pt-0.5">
                                        {step.status === 'FINISHED' ? (
                                            <CheckCircle2 className="h-6 w-6 text-app-success-text" />
                                        ) : (
                                            <Circle className="h-6 w-6 text-app-text-disabled" />
                                        )}
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                            <div>
                                                <h3
                                                    className={`text-base font-semibold ${
                                                        step.status === 'FINISHED'
                                                            ? 'text-app-text-disabled line-through'
                                                            : 'text-app-text'
                                                    }`}
                                                >
                                                    {step.title}
                                                </h3>

                                                <p className="mt-1 text-sm leading-relaxed text-app-text-muted">
                                                    {step.description}
                                                </p>
                                                {/* Meta-Infos */}
                                            </div>

                                            <button
                                                onClick={() => void navigate(`/onboarding/${step.id}`)}
                                                className="flex items-center gap-2 rounded-xl bg-app-brand px-6 py-3 text-sm font-medium text-white transition-all hover:bg-app-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus"
                                            >
                                                Jetzt starten
                                                <ChevronRight className="h-4 w-4" />
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