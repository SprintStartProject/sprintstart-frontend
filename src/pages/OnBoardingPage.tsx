// ============================================================
// OnBoardingPage.tsx
// ============================================================

import { useState, useEffect } from "react";
import type {
  OnboardingPathEndpoint,
  OnboardingPhaseEndpoint,
  OnboardingStepEndpoint,
} from "../features/onboarding/types";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { buttonHoverMotion } from "../styles/tokens";
import { onboardingService } from "../services/onboardingService";
import { userService } from "../services/userService";
import { ApiError } from "../services/apiClient";
import { StepOriginBadge } from "../features/onboarding/components/StepOriginBadge";

import {
  CheckCircle2,
  Circle,
  CircleDot,
  ChevronRight,
  Sparkles,
  PlayCircle,
  Loader2,
  AlertCircle,
  CircleArrowRight,
  Lock,
  Eye,
  RefreshCw,
  ClipboardCheck,
} from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { DinoGame } from "../features/chatbot/components/DinoGame";
import { PhaseCheckModal } from "../features/onboarding/components/PhaseCheckModal";
import { useMoments } from "../features/moments";
import { usePathRevealMoment } from "../features/onboarding/hooks/usePathRevealMoment";
//import type {UserProfile} from "../services/types.ts";

type LoadingState = "idle" | "loading" | "generating" | "success" | "error";

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
    <div className="bg-app-border-muted rounded-full h-2 overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-app-brand to-app-progress-fill-end rounded-full transition-all duration-500"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

/**
 * Index of the phase the user is currently working on: the first phase that still
 * has a not-yet-finished/skipped step. Falls back to the last phase when everything
 * is done, so a reload never drops the user back to phase 1.
 */
function findActivePhaseIndex(path: OnboardingPathEndpoint): number {
  const index = path.phases.findIndex((phase) =>
    phase.steps.some(
      (step) => step.status !== "FINISHED" && step.status !== "SKIPPED",
    ),
  );
  return index === -1 ? Math.max(0, path.phases.length - 1) : index;
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT: OnBoardingPage
// ─────────────────────────────────────────────────────────────

/**
 * Displays the user's personalized onboarding path hierarchy.
 * Fetches and tracks progress through phases and tasks.
 */
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

  // Current AI generation stage, shown while loadingState === "generating"
  const [generationStage, setGenerationStage] = useState<{ name: string; detail?: string } | null>(null);

  // Dino easter egg: pressing Space while the path is being generated starts a
  // tiny endless runner. It unmounts by itself once generation finishes.
  const [gameActive, setGameActive] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(localStorage.getItem('dinoUnlocked') === 'true');

  // Phase whose knowledge check is currently open in the modal (null = closed)
  const [checkPhase, setCheckPhase] = useState<OnboardingPhaseEndpoint | null>(null);

  // The "on board" finale now lives in the moments layer, so that it can take
  // over the screen rather than render inside this page's tree.
  const { celebrate: celebrateMoment, completeMission, flyby } = useMoments();

  // The reveal of a freshly built path, the first time its owner sees it.
  // Handed the path only once the page is showing it: whichever way the user
  // got here — waiting out the generator or opening onboarding days after it
  // finished — this is the moment the path first exists for them.
  usePathRevealMoment(
    loadingState === "success" ? OnBoardingPathEndpoint : null,
  );

  const navigate = useNavigate();

  // Silently re-fetches the path, e.g. after a check attempt changed lock states.
  const refreshPath = async () => {
    try {
      const path = await onboardingService.fetchPath();
      setOnBoardingPath(path);
    } catch (err) {
      console.error("Failed to refresh onboarding path:", err);
    }
  };

  const closeCheckModal = ({
    submittedAttempt,
    passed,
  }: {
    submittedAttempt: boolean;
    passed: boolean;
  }) => {
    // Passing the last phase's check completes the whole journey -> celebrate.
    const phases = OnBoardingPathEndpoint?.phases ?? [];
    const clearedIndex = phases.findIndex((phase) => phase.id === checkPhase?.id);
    const wasFinalPhase = !!checkPhase && phases.at(-1)?.id === checkPhase.id;
    const clearedPhaseTitle = checkPhase?.title;
    setCheckPhase(null);

    if (passed && wasFinalPhase) {
      completeMission();
    } else if (passed) {
      // Clearing a mid-path check unlocks the next phase — worth a beat of its
      // own, with the ring showing how much of the journey is now behind them.
      celebrateMoment({
        tone: "milestone",
        title: "Phase cleared",
        message: clearedPhaseTitle
          ? `You passed the ${clearedPhaseTitle} check. The next phase is unlocked.`
          : "You passed the check. The next phase is unlocked.",
        progress:
          clearedIndex >= 0 && phases.length > 0
            ? { current: clearedIndex + 1, total: phases.length }
            : undefined,
      });
    }
    // Only refresh the path here, never the auth profile: the backend has flagged the
    // user as onboarded, but keeping the in-memory profile stale until the next reload
    // lets the celebration play out before the onboarding UI is gated away.
    if (submittedAttempt) void refreshPath();
  };

  // Triggers AI path generation and streams progress until a path is produced.
  const generatePath = async () => {
    setLoadingState("generating");
    setGenerationStage(null);
    setGameActive(false);
    await onboardingService.personalizePath({
      onStage: (name, detail) => setGenerationStage({ name, detail }),
      onPath: (path) => setOnBoardingPath(path),
      onDone: () => setLoadingState("success"),
      onError: (message) => {
        setLoadingState("error");
        setErrorMessage(message);
      },
    });
  };

  // Keep isUnlocked state perfectly in sync with localStorage and close game if locked
  useEffect(() => {
    const handleUnlockChange = () => {
      const unlocked = localStorage.getItem('dinoUnlocked') === 'true';
      setIsUnlocked(unlocked);
      if (!unlocked) {
        setGameActive(false);
      }
    };
    window.addEventListener('dinoUnlockChanged', handleUnlockChange);
    window.addEventListener('storage', handleUnlockChange);
    return () => {
      window.removeEventListener('dinoUnlockChanged', handleUnlockChange);
      window.removeEventListener('storage', handleUnlockChange);
    };
  }, []);

  // Easter egg trigger: Space starts the game while the path is generating.
  useEffect(() => {
    if (loadingState !== "generating" || gameActive || !isUnlocked) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;

      // Don't hijack space while the user is typing somewhere.
      const active = document.activeElement;
      const typing =
        active instanceof HTMLElement &&
        (active.tagName === "TEXTAREA" ||
          active.tagName === "INPUT" ||
          active.isContentEditable);
      if (typing) return;

      e.preventDefault();
      setGameActive(true);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [loadingState, gameActive, isUnlocked]);

  // ── DATA FETCHING using useEffect ─────────────────────────────

  useEffect(() => {
    const loadOnBoardingPath = async () => {
      setLoadingState("loading");
      try {
        const profile = await userService.getProfile();
        if (!profile?.id) throw new Error("No user found.");

        const path = await onboardingService.fetchPath();
        setOnBoardingPath(path);
        // Land on the phase the user is actually working on, not always phase 1.
        setSelectedPhaseIndex(findActivePhaseIndex(path));
        setLoadingState("success");
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          // No path generated yet — kick off AI personalization instead of erroring out.
          void generatePath();
          return;
        }
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

  // Recommended next step (first not-yet-finished/skipped step across all
  // unlocked phases). Steps in locked phases can never be recommended.
  const recommendedStep =
    OnBoardingPathEndpoint?.phases
      .filter((phase) => !phase.locked)
      .flatMap((phase) => phase.steps)
      .find((step) => step.status !== "FINISHED" && step.status !== "SKIPPED") ?? null;

  // First unlocked phase whose required knowledge check is still open while all
  // of its steps are already done — the check is what blocks the next phase.
  const pendingCheckPhase =
    OnBoardingPathEndpoint?.phases.find(
      (phase) =>
        !phase.locked &&
        phase.checkSummary?.required &&
        !phase.checkSummary.passed &&
        phase.steps.every(
          (step) => step.status === "FINISHED" || step.status === "SKIPPED",
        ),
    ) ?? null;

  // How a single step in the list should behave:
  //  - "completed": FINISHED or SKIPPED  -> read-only, can be reopened to look at it
  //  - "active":    the recommended next step -> can be started / continued
  //  - "locked":    a later, not-yet-reachable step (or any step in a locked phase)
  type StepMode = "completed" | "active" | "locked";
  const getStepMode = (step: OnboardingStepEndpoint, phaseLocked: boolean): StepMode => {
    if (step.status === "FINISHED" || step.status === "SKIPPED") return "completed";
    if (!phaseLocked && recommendedStep && step.id === recommendedStep.id) return "active";
    return "locked";
  };

  // Open a step's detail page (read-only for completed steps, continue for started ones).
  const openStep = (stepId: string) => void navigate(`/onboarding/${stepId}`);

  // Start the step (records startedAt + sets IN_PROGRESS the first time) and open it.
  const startStep = async (stepId: string) => {
    try {
      await onboardingService.startStep(stepId);
    } catch (err) {
      console.error("Failed to start onboarding step:", err);
    }
    // The rocket marks a step *beginning*, so it rides on the start rather than
    // on the navigation. Reopening a step you already started is not a new
    // journey and gets nothing — `handleActiveStep` routes those to `openStep`.
    flyby();
    openStep(stepId);
  };

  // Action for the recommended step's primary button: "Continue" if already started,
  // otherwise "Start now" (which triggers the start call).
  const handleActiveStep = (step: OnboardingStepEndpoint) => {
    if (step.status === "IN_PROGRESS") openStep(step.id);
    else void startStep(step.id);
  };

  // ── RENDER: LOADING STATE ──────────────────────────────────
  if (loadingState === "loading" || loadingState === "idle") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-app-text-muted">
          <Loader2 className="w-8 h-8 animate-spin text-app-brand" />
          <p className="text-sm">Loading onboarding path...</p>
        </div>
      </div>
    );
  }

  // ── RENDER: GENERATING STATE ───────────────────────────────
  if (loadingState === "generating") {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className={gameActive ? "w-full max-w-2xl text-center" : "max-w-md text-center"}>
          <Sparkles className="w-10 h-10 text-app-brand mx-auto mb-4 animate-pulse" />
          <h2 className="text-xl font-semibold text-app-text mb-2">
            Generating your personalized onboarding path...
          </h2>
          <p className="text-sm text-app-text-muted mb-2">
            {generationStage?.name ?? "Starting up"}
          </p>
          {generationStage?.detail && (
            <p className="text-xs text-app-text-subtle mb-6">{generationStage.detail}</p>
          )}

          {gameActive ? (
            <div className="mt-6">
              <DinoGame onExit={() => setGameActive(false)} />
            </div>
          ) : (
            <Loader2 className="w-6 h-6 animate-spin text-app-brand mx-auto mt-4" />
          )}
        </div>
      </div>
    );
  }

  // ── RENDER: ERROR STATE ────────────────────────────────────
  if (loadingState === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-app-danger-solid mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-app-text mb-2">
            Onboarding could not be loaded
          </h2>
          <p className="text-sm text-app-text-muted mb-6">
            {errorMessage}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 rounded-xl bg-app-brand hover:bg-app-brand-hover text-white text-sm font-medium transition-all"
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
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-app-text-muted text-sm">
          No onboarding path found.
        </p>
      </div>
    );
  }

  // The knowledge check acts as the phase's final step: it only becomes
  // actionable once every real step is finished/skipped, and passing it unlocks
  // the next phase (or completes onboarding for the last phase).
  const allStepsDone = currentPhase.steps.every(
    (step) => step.status === "FINISHED" || step.status === "SKIPPED",
  );
  const isFinalPhase =
    OnBoardingPathEndpoint.phases.at(-1)?.id === currentPhase.id;

  // ── RENDER: SUCCESS STATE ──────────────────────────────────
  return (
    <div className="min-h-screen">
      {/* ── HEADER ───────────────────────────────────────── */}
      <div className="border-b border-app-border bg-app-bg/90 backdrop-blur-xl">
        <div className="app-page-content py-4">
          <PageHeader
            icon={Sparkles}
            title="Your onboarding journey"
            subtitle="Follow your personalized path, continue the next task and review completed steps."
            className="mb-4"
            actions={
              <>
                <button
                  onClick={() => void generatePath()}
                  title="Regenerate path with AI"
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-app-border bg-app-surface text-app-text-muted transition-colors hover:border-app-brand-border-strong hover:bg-app-brand-soft hover:text-app-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>

                <div className="rounded-2xl border border-app-brand-border bg-app-brand-soft px-4 py-2 text-right">
                  <div className="text-3xl font-bold text-app-brand">
                    {totalPercentage}%
                  </div>
                  <div className="text-xs font-medium text-app-brand-text">
                    overall
                  </div>
                </div>
              </>
            }
          />

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
                  className={`flex-1 rounded-2xl border p-4 text-left transition-all duration-200 motion-reduce:hover:scale-100 ${
                    isSelected
                      ? "border-app-brand bg-app-brand-soft"
                      : "border-app-border bg-app-surface hover:scale-[1.02] hover:border-app-brand-border-strong hover:bg-app-surface-hover hover:shadow-lg"
                  }`}
                >
                  <div className="font-semibold text-app-text text-sm mb-1 flex items-center gap-1.5">
                    {phase.locked && (
                      <Lock className="w-3.5 h-3.5 shrink-0 text-app-text-disabled" />
                    )}
                    <span className="truncate">{phase.title}</span>
                    {phase.checkSummary?.required && (
                      <ClipboardCheck
                        className={`w-3.5 h-3.5 shrink-0 ${
                          phase.checkSummary.passed
                            ? "text-app-success-solid"
                            : "text-app-text-disabled"
                        }`}
                      />
                    )}
                  </div>
                  <ProgressBar
                    value={progress.completed}
                    max={progress.total}
                  />
                  <div className="flex justify-between mt-2">
                    <span className="text-xs text-app-text-muted">
                      {progress.completed}/{progress.total} Tasks
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        progress.percentage === 100
                          ? "bg-app-success-bg text-app-success-text"
                          : "bg-app-surface-muted text-app-text-muted"
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
      <main className="app-page-content py-6 pb-24 pt-8">
        {/* "Up Next" Banner — nur wenn es einen empfohlenen Step gibt */}
        {recommendedStep && (
          <div className="rounded-3xl border border-app-brand-border bg-app-surface p-6 sm:p-8 mb-6 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-app-brand-soft blur-3xl rounded-full pointer-events-none" />
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-app-brand-soft text-app-brand-text text-xs font-medium mb-4">
                <PlayCircle className="w-3.5 h-3.5" />
                {recommendedStep.status === "IN_PROGRESS" ? "In progress" : "Up Next"}
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-app-text">
                {recommendedStep.title}
              </h2>
              <div className="mt-3">
                <StepOriginBadge step={recommendedStep} />
              </div>
              <p className="text-app-text-muted mt-2 max-w-2xl">
                {recommendedStep.description}
              </p>
              <div className="flex flex-wrap items-center gap-4 mt-6">
                <motion.button
                  onClick={() => handleActiveStep(recommendedStep)}
                  {...buttonHoverMotion}
                  className="flex items-center gap-2 rounded-xl bg-app-brand px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-app-brand-hover hover:shadow-[0_10px_26px_-10px_var(--color-app-brand)]"
                >
                  {recommendedStep.status === "IN_PROGRESS" ? "Continue" : "Start now"}
                  <ChevronRight className="w-4 h-4" />
                </motion.button>
              </div>
            </div>
          </div>
        )}

        {/* "Knowledge check pending" banner — all steps of the phase are done,
            only the check still blocks the next phase */}
        {!recommendedStep && pendingCheckPhase && (
          <div className="rounded-3xl border border-app-brand-border bg-app-surface p-6 sm:p-8 mb-6 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-app-brand-soft blur-3xl rounded-full pointer-events-none" />
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-app-brand-soft text-app-brand-text text-xs font-medium mb-4">
                <ClipboardCheck className="w-3.5 h-3.5" />
                Knowledge check
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-app-text">
                Ready for the {pendingCheckPhase.title} check?
              </h2>
              <p className="text-app-text-muted mt-2 max-w-2xl">
                You finished all steps of this phase. Pass the knowledge check to
                unlock the next phase.
              </p>
              <div className="flex flex-wrap items-center gap-4 mt-6">
                <motion.button
                  onClick={() => setCheckPhase(pendingCheckPhase)}
                  {...buttonHoverMotion}
                  className="flex items-center gap-2 rounded-xl bg-app-brand px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-app-brand-hover hover:shadow-[0_10px_26px_-10px_var(--color-app-brand)]"
                >
                  Start knowledge check
                  <ChevronRight className="w-4 h-4" />
                </motion.button>
              </div>
            </div>
          </div>
        )}

        {/* Phase description */}
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-app-text">
            {currentPhase.title}
          </h2>
          <p className="text-sm text-app-text-muted mt-1">
            {currentPhase.description}
          </p>
        </div>

        {/* Locked phase notice */}
        {currentPhase.locked && (
          <div className="mb-4 rounded-2xl border border-app-border bg-app-surface-muted p-4 flex items-center gap-3">
            <Lock className="w-5 h-5 shrink-0 text-app-text-muted" />
            <p className="text-sm text-app-text-muted">
              {currentPhase.unlockReason === "PREVIOUS_PHASE_CHECK_NOT_PASSED"
                ? "This phase unlocks once you pass the knowledge check of the previous phase."
                : "This phase unlocks once you complete all steps of the previous phase."}
            </p>
          </div>
        )}

        {/* Task list — the phase's knowledge check is appended as the final "step" below */}
        <div className="space-y-4">
          {currentPhase.steps.map((step) => {
            const mode = getStepMode(step, currentPhase.locked);
            return (
              <div
                key={step.id}
                // Completed and locked steps stay still on purpose: nothing
                // happens when you click them, and magnifying them would
                // promise an interaction that is not there.
                className={`group rounded-2xl border bg-app-surface transition-all duration-200 motion-reduce:hover:scale-100 ${
                  mode === "completed"
                    ? "border-app-border opacity-60"
                    : mode === "locked"
                      ? "border-app-border opacity-75"
                      : "border-app-border hover:scale-[1.01] hover:border-app-brand-border-strong hover:shadow-lg"
                }`}
              >
                <div className="p-5">
                  <div className="flex gap-4">
                    <div className="pt-0.5 shrink-0">
                      {step.status === "FINISHED" ? (
                        <CheckCircle2 className="w-5 h-5 text-app-success-solid" />
                      ) : step.status === "SKIPPED" ? (
                        <CircleArrowRight className="w-5 h-5 text-app-danger-solid" />
                      ) : step.status === "IN_PROGRESS" ? (
                        <CircleDot className="w-5 h-5 text-app-brand" />
                      ) : mode === "locked" ? (
                        <Lock className="w-5 h-5 text-app-text-disabled" />
                      ) : (
                        <Circle className="w-5 h-5 text-app-text-disabled" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        {/* Text */}
                        <div>
                          <h3
                            className={`font-semibold text-base ${
                              mode === "completed"
                                ? "line-through text-app-text-subtle"
                                : "text-app-text"
                            }`}
                          >
                            {step.title}
                          </h3>
                          <div className="mt-2">
                            <StepOriginBadge step={step} />
                          </div>
                          <p className="text-sm text-app-text-muted mt-1 leading-relaxed">
                            {step.description}
                          </p>
                        </div>

                        {/* Action depends on the step's mode:
                            active -> start/continue, completed -> status + read-only view,
                            locked -> status chip only (cannot be started yet) */}
                        <div className="shrink-0 self-start sm:self-center">
                          {mode === "active" ? (
                            <button
                              onClick={() => handleActiveStep(step)}
                              className="px-6 py-3 rounded-xl bg-app-brand hover:bg-app-brand-hover text-white text-sm font-medium transition-all flex items-center gap-2"
                            >
                              {step.status === "IN_PROGRESS" ? "Continue" : "Start now"}
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          ) : mode === "completed" ? (
                            <div className="flex items-center gap-3">
                              <span
                                className={`text-xs px-3 py-1 rounded-full font-medium ${
                                  step.status === "FINISHED"
                                    ? "bg-app-success-bg text-app-success-text"
                                    : "bg-app-surface-muted text-app-text-muted"
                                }`}
                              >
                                {step.status === "FINISHED" ? "Completed" : "Skipped"}
                              </span>
                              <button
                                onClick={() => openStep(step.id)}
                                className="px-4 py-2 rounded-xl border border-app-border hover:border-app-border-strong text-app-text-muted hover:text-app-text text-sm font-medium transition-all flex items-center gap-2"
                              >
                                <Eye className="w-4 h-4" />
                                View
                              </button>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-medium bg-app-surface-muted text-app-text-muted">
                              <Lock className="w-3.5 h-3.5" />
                              Locked
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Knowledge check — rendered as the phase's final step */}
          {currentPhase.checkSummary?.required &&
            (() => {
              const passed = currentPhase.checkSummary.passed;
              // Locked = phase not reached yet, or earlier steps still open.
              const locked = currentPhase.locked || !allStepsDone;
              return (
                <div
                  className={`group rounded-2xl border transition-all bg-app-surface ${
                    passed
                      ? "border-app-border opacity-60"
                      : locked
                        ? "border-app-border opacity-75"
                        : "border-app-brand-border hover:border-app-border-strong hover:shadow-lg"
                  }`}
                >
                  <div className="p-5">
                    <div className="flex gap-4">
                      <div className="pt-0.5 shrink-0">
                        <ClipboardCheck
                          className={`w-5 h-5 ${
                            passed
                              ? "text-app-success-solid"
                              : locked
                                ? "text-app-text-disabled"
                                : "text-app-brand"
                          }`}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                          <div>
                            <h3
                              className={`font-semibold text-base ${
                                passed
                                  ? "line-through text-app-text-subtle"
                                  : "text-app-text"
                              }`}
                            >
                              Knowledge check
                            </h3>
                            <p className="text-sm text-app-text-muted mt-1 leading-relaxed">
                              {currentPhase.checkSummary.questionCount}{" "}
                              {currentPhase.checkSummary.questionCount === 1
                                ? "question"
                                : "questions"}{" "}
                              ·{" "}
                              {isFinalPhase
                                ? "pass to complete your onboarding"
                                : "pass to unlock the next phase"}
                            </p>
                          </div>

                          {/* Same action pattern as steps: passed -> status chip,
                              locked -> lock chip, otherwise start/retry the check. */}
                          <div className="shrink-0 self-start sm:self-center">
                            {passed ? (
                              <span className="text-xs px-3 py-1 rounded-full font-medium bg-app-success-bg text-app-success-text">
                                Passed
                              </span>
                            ) : locked ? (
                              <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-medium bg-app-surface-muted text-app-text-muted">
                                <Lock className="w-3.5 h-3.5" />
                                Locked
                              </span>
                            ) : (
                              <button
                                onClick={() => setCheckPhase(currentPhase)}
                                className="px-6 py-3 rounded-xl bg-app-brand hover:bg-app-brand-hover text-white text-sm font-medium transition-all flex items-center gap-2"
                              >
                                {currentPhase.checkSummary.latestAttemptId
                                  ? "Try again"
                                  : "Start check"}
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
        </div>
      </main>

      {/* Knowledge check modal */}
      {checkPhase && (
        <PhaseCheckModal
          phaseId={checkPhase.id}
          phaseTitle={checkPhase.title}
          onClose={closeCheckModal}
        />
      )}

    </div>
  );
}
