// ============================================================
// OnBoardingPage.tsx
// ============================================================

import { useState, useEffect } from "react";
import type {
  OnboardingPathEndpoint,
  OnboardingPhaseEndpoint,
} from "../types/onboarding";
import { useNavigate } from "react-router-dom";
import { onboardingService } from "../services/onboardingService";
import { userService } from "../services/userService";

import {
  CheckCircle2,
  Circle,
  ChevronRight,
  Sparkles,
  PlayCircle,
  Loader2,
  AlertCircle,
  CircleArrowRight,
} from "lucide-react";
//import type {UserProfile} from "../services/types.ts";

type LoadingState = "idle" | "loading" | "success" | "error";

//const { profile, status } = useAuth();
//const userLoading = status === 'loading';
//const userError = status === 'unauthenticated' ? 'Not logged in.' : null;

// ─────────────────────────────────────────────────────────────
// HELPER COMPONENT: ProgressBar
// ─────────────────────────────────────────────────────────────

interface ProgressBarProps {
  value: number; // e.g. 3 (completed tasks)
  max: number; // e.g. 5 (total tasks)
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
// MAIN COMPONENT: OnBoardingPage
// ─────────────────────────────────────────────────────────────

export function OnBoardingPage() {
  // Selected phase index
  const [selectedPhaseIndex, setSelectedPhaseIndex] = useState<number>(0);

  // Onboarding data (null = not loaded yet)
  const [OnBoardingPathEndpoint, setOnBoardingPath] =
    useState<OnboardingPathEndpoint | null>(null);

  // Loading state: 'idle' (before load), 'loading' (while loading), 'success' (loaded), 'error' (error)
  const [loadingState, setLoadingState] = useState<LoadingState>("idle");

  // Error message for error state
  const [errorMessage, setErrorMessage] = useState<string>("");

  const navigate = useNavigate();

  // ── DATA FETCHING using useEffect ─────────────────────────────

  useEffect(() => {
    const loadOnBoardingPath = async () => {
      setLoadingState("loading");
      try {
        const profile = await userService.getProfile();
        if (!profile?.id) throw new Error("No user found.");

        const path = await onboardingService.fetchPath(profile.id);
        setOnBoardingPath(path);
        setLoadingState("success");
      } catch (err) {
        setLoadingState("error");
        setErrorMessage(err instanceof Error ? err.message : "Unknown error");
      }
    };
    void loadOnBoardingPath();
  }, []);

  const currentPhase =
    OnBoardingPathEndpoint?.phases[selectedPhaseIndex] ?? null;

  // Helper function for phase progress
  const getPhaseProgress = (phase: OnboardingPhaseEndpoint) => {
    const completed = phase.steps.filter(
      (step) => step.status === "FINISHED" || step.status === "SKIPPED",
    ).length;
    return {
      completed,
      total: phase.steps.length,
      percentage:
        phase.steps.length > 0
          ? Math.round((completed / phase.steps.length) * 100)
          : 0,
    };
  };

  const getStepButtonLabel = (stepStatus: string) => {
    return stepStatus === "WAITING" ? "Start now" : "Configure";
  };

  // Total progress across all phases
  const totalProgress = OnBoardingPathEndpoint?.phases.reduce(
    (acc, phase) => {
      const p = getPhaseProgress(phase);
      return {
        completed: acc.completed + p.completed,
        total: acc.total + p.total,
      };
    },
    { completed: 0, total: 0 },
  ) ?? { completed: 0, total: 0 };

  const totalPercentage =
    totalProgress.total > 0
      ? Math.round((totalProgress.completed / totalProgress.total) * 100)
      : 0;

  // Next pending task (across all phases)
  const nextTask =
    OnBoardingPathEndpoint?.phases
      .flatMap((phase) => phase.steps)
      .find((step) => step.status !== "FINISHED") ?? null;

  // ── RENDER: LOADING STATE ──────────────────────────────────
  if (loadingState === "loading" || loadingState === "idle") {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-gray-500 dark:text-gray-400">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-sm">Loading onboarding path...</p>
        </div>
      </div>
    );
  }

  // ── RENDER: ERROR STATE ────────────────────────────────────
  if (loadingState === "error") {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Onboarding could not be loaded
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            {errorMessage}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-all"
          >
            Try again
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
          No onboarding path found.
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
          {/* Title + overall percent */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-5 h-5 text-blue-500" />
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Your onboarding journey
                </h1>
              </div>
            </div>

            <div className="text-right">
              <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">
                {totalPercentage}%
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                overall
              </div>
            </div>
          </div>

          {/* Total progress bar */}
          <ProgressBar
            value={totalProgress.completed}
            max={totalProgress.total}
          />

          {/* Phase tabs */}
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            {OnBoardingPathEndpoint.phases.map((phase, index) => {
              const progress = getPhaseProgress(phase);
              const isSelected = selectedPhaseIndex === index;

              return (
                <button
                  key={phase.id}
                  onClick={() => setSelectedPhaseIndex(index)}
                  className={`flex-1 rounded-2xl border p-4 transition-all text-left ${
                    isSelected
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40"
                      : "border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-white dark:bg-gray-950"
                  }`}
                >
                  <div className="font-semibold text-gray-900 dark:text-white text-sm mb-1">
                    {phase.title}
                  </div>
                  <ProgressBar
                    value={progress.completed}
                    max={progress.total}
                  />
                  <div className="flex justify-between mt-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {progress.completed}/{progress.total} Tasks
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        progress.percentage === 100
                          ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
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
                  onClick={() => void navigate(`/onboarding/${nextTask.id}`)}
                  className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-all flex items-center gap-2"
                >
                  Start now
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Phase description */}
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {currentPhase.title}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {currentPhase.description}
          </p>
        </div>

        {/* Task list */}
        <div className="space-y-4">
          {currentPhase.steps.map((step) => (
            <div
              key={step.id}
              className={`group rounded-2xl border transition-all bg-white dark:bg-gray-900 ${
                step.status === "FINISHED" || step.status === "SKIPPED"
                  ? "border-gray-200 dark:border-gray-800 opacity-60"
                  : "border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-lg"
              }`}
            >
              <div className="p-5">
                <div className="flex gap-4">
                  <div className="pt-0.5 shrink-0">
                    {step.status === "FINISHED" ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : step.status === "SKIPPED" ? (
                      <CircleArrowRight className="w-5 h-5 text-red-500" />
                    ) : (
                      <Circle className="w-5 h-5 text-gray-300 dark:text-gray-600" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      {/* Text */}
                      <div>
                        <h3
                          className={`font-semibold text-base ${
                            step.status === "FINISHED" ||
                            step.status === "SKIPPED"
                              ? "line-through text-gray-400 dark:text-gray-500"
                              : "text-gray-900 dark:text-white"
                          }`}
                        >
                          {step.title}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
                          {step.description}
                        </p>
                        {/* Meta info */}
                      </div>

                      <button
                        onClick={() => void navigate(`/onboarding/${step.id}`)}
                        className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-all flex items-center gap-2"
                      >
                        {getStepButtonLabel(step.status)}
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
