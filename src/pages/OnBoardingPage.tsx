// ============================================================
// OnBoardingPage.tsx
// ============================================================

import { useState, useEffect, useRef } from "react";
import type {
  OnboardingPathEndpoint,
  OnboardingPhaseEndpoint,
  OnboardingStepEndpoint,
} from "../features/onboarding/types";
import { findActivePhaseIndex } from "../features/onboarding/activePhase";
import { useNavigate, useLocation } from "react-router-dom";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
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
  Brain,
} from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { DinoGame } from "../features/chatbot/components/DinoGame";
import { PhaseCheckModal } from "../features/onboarding/components/PhaseCheckModal";
import { useMoments } from "../features/moments";
import { ReviewCheckModal } from "../features/onboarding/components/ReviewCheckModal";
import { usePathRevealMoment } from "../features/onboarding/hooks/usePathRevealMoment";
import {
  useDinoUnlocked,
  useSpaceOpensDino,
} from "../features/easter-eggs/hooks/useDinoWaitingGame";
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
    <div className="h-2 overflow-hidden rounded-full bg-app-border-muted">
      <div
        className="h-full rounded-full bg-gradient-to-r from-app-brand to-app-progress-fill-end transition-all duration-500"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
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
  const [OnBoardingPathEndpoint, setOnBoardingPath] = useState<OnboardingPathEndpoint | null>(null);

  // Loading state: 'idle' (before load), 'loading' (while loading), 'success' (loaded), 'error' (error)
  const [loadingState, setLoadingState] = useState<LoadingState>("idle");

  // Error message for error state
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Current AI generation stage, shown while loadingState === "generating"
  const [generationStage, setGenerationStage] = useState<{ name: string; detail?: string } | null>(
    null,
  );

  // Dino easter egg: pressing Space while the path is being generated starts a
  // tiny endless runner. It unmounts by itself once generation finishes.
  const dinoUnlocked = useDinoUnlocked();
  const [gameActive, closeGame] = useSpaceOpensDino(loadingState === "generating", dinoUnlocked);

  // Phase whose knowledge check is currently open in the modal (null = closed)
  const [checkPhase, setCheckPhase] = useState<OnboardingPhaseEndpoint | null>(null);

  // The "on board" finale lives in the moments layer, so that it can take over
  // the screen rather than render inside this page's tree.
  const { celebrate: celebrateMoment, completeMission, flyby } = useMoments();

  // Whether the standalone review check is open.
  const [reviewCheckOpen, setReviewCheckOpen] = useState(false);

  // How many earlier questions the user still has to answer correctly. Drives the
  // review-check button and, once zero, no longer blocks finishing the onboarding.
  const [openReviewCount, setOpenReviewCount] = useState(0);

  // The reveal of a freshly built path, the first time its owner sees it.
  // Handed the path only once the page is showing it: whichever way the user
  // got here — waiting out the generator or opening onboarding days after it
  // finished — this is the moment the path first exists for them.
  usePathRevealMoment(loadingState === "success" ? OnBoardingPathEndpoint : null);

  const navigate = useNavigate();
  const location = useLocation();

  // Set by the step page when a knowledge check is what stands between the user and the
  // rest of their path, so this page can put that check in front of them.
  const focusCheckPhaseId = (location.state as { focusCheckPhaseId?: string } | null)
    ?.focusCheckPhaseId;

  // Set by the dashboard card when the review pool is all that is left of the journey. The
  // pool has no place on the page to scroll to — it lives in a modal — so the navigation
  // opens it directly, rather than dropping the user next to a button they already clicked.
  const shouldOpenReviewCheck =
    (location.state as { openReviewCheck?: boolean } | null)?.openReviewCheck === true;

  // The phase's knowledge check card, which sits at the end of a potentially long step list.
  const checkCardRef = useRef<HTMLDivElement>(null);
  const hasFocusedCheckRef = useRef(false);

  /**
   * Brings the knowledge check into view when the user was sent here because of it.
   *
   * Fires once per visit: the card is the reason for the navigation, but it is the last
   * thing on the page, so without this the user lands above it and sees the step list they
   * just finished. Later phase switches must not drag the view back down, hence the ref.
   */
  useEffect(() => {
    if (loadingState !== "success" || !focusCheckPhaseId || hasFocusedCheckRef.current) return;
    hasFocusedCheckRef.current = true;
    checkCardRef.current?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  }, [loadingState, focusCheckPhaseId]);

  // Silently re-fetches the path, e.g. after a check attempt changed lock states.
  const refreshPath = async () => {
    try {
      const path = await onboardingService.fetchPath();
      setOnBoardingPath(path);
    } catch (err) {
      console.error("Failed to refresh onboarding path:", err);
    }
  };

  /**
   * Silently re-reads how many questions are waiting in the review pool.
   *
   * `openWhenPending` is passed by the initial load alone, and only when the dashboard sent
   * the user here to work through the pool. Opening the modal from the read that produced
   * the count — rather than from an effect watching it — is what keeps the pool from
   * springing open much later, when a passed check happens to refill it.
   */
  const refreshReviewCount = async ({ openWhenPending = false } = {}) => {
    try {
      const pool = await onboardingService.fetchReviewCheck();
      setOpenReviewCount(pool.openCount);

      // An empty pool would open a modal with nothing in it.
      if (openWhenPending && pool.openCount > 0) {
        setReviewCheckOpen(true);
      }
    } catch (err) {
      console.error("Failed to refresh review check:", err);
    }
  };

  const closeCheckModal = ({
    submittedAttempt,
    passed,
    onboardingCompleted,
  }: {
    submittedAttempt: boolean;
    passed: boolean;
    onboardingCompleted: boolean;
  }) => {
    const phases = OnBoardingPathEndpoint?.phases ?? [];
    const clearedIndex = phases.findIndex((phase) => phase.id === checkPhase?.id);
    const clearedPhaseTitle = checkPhase?.title;
    setCheckPhase(null);

    // The backend decides completion: passing the final check is not enough while
    // review questions are still open, so this is never derived from the phase alone.
    if (onboardingCompleted) {
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
    if (submittedAttempt) {
      void refreshPath();
      // A passed check moves every missed question into the pool.
      if (passed) void refreshReviewCount();
    }
  };

  const closeReviewCheckModal = ({
    answeredAny,
    onboardingCompleted,
  }: {
    answeredAny: boolean;
    onboardingCompleted: boolean;
  }) => {
    setReviewCheckOpen(false);
    if (onboardingCompleted) completeMission();
    if (answeredAny) {
      void refreshReviewCount();
      void refreshPath();
    }
  };

  /**
   * Triggers AI path generation and streams progress until a path is produced.
   *
   * `recoverExisting` handles the one failure that is not really a failure: a
   * user has exactly one path, so a generation that collides with an existing
   * one means somebody else already built it — a duplicate request, a second
   * tab, a retry after a dropped connection. The backend answers with a unique
   * constraint violation, which is true but useless to the user, and the path
   * they were promised is sitting there ready. So the initial load asks for it
   * once before it gives up.
   *
   * Deliberately not set for the "regenerate" button: there, an existing path
   * is precisely what the user asked to replace, and quietly handing back the
   * old one would look like the button does nothing.
   */
  const generatePath = async ({ recoverExisting = false } = {}) => {
    setLoadingState("generating");
    setGenerationStage(null);
    closeGame();
    await onboardingService.personalizePath({
      onStage: (name, detail) => setGenerationStage({ name, detail }),
      onPath: (path) => setOnBoardingPath(path),
      onDone: () => setLoadingState("success"),
      onError: (message) => {
        void (async () => {
          if (recoverExisting) {
            try {
              const path = await onboardingService.fetchPath();
              setOnBoardingPath(path);
              setSelectedPhaseIndex(findActivePhaseIndex(path));
              setLoadingState("success");
              return;
            } catch {
              // Nothing there after all — the original error stands.
            }
          }
          setLoadingState("error");
          setErrorMessage(message);
        })();
      },
    });
  };

  // ── DATA FETCHING using useEffect ─────────────────────────────

  // Guards the load against running twice. StrictMode invokes every effect
  // twice in development, and this one can *create* something: two loads both
  // find no path, both start a generation, and the second one collides with
  // the row the first just inserted. The user is then shown a unique
  // constraint violation for a path that was built perfectly well.
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    const loadOnBoardingPath = async () => {
      setLoadingState("loading");
      try {
        const profile = await userService.getProfile();
        if (!profile?.id) throw new Error("No user found.");

        const path = await onboardingService.fetchPath();
        setOnBoardingPath(path);
        // Land on the phase the user is actually working on, not always phase 1. A phase
        // the step page pointed us at wins, since an earlier phase can still be open while
        // the check being waited on belongs to a later one.
        const requestedIndex = focusCheckPhaseId
          ? path.phases.findIndex((phase) => phase.id === focusCheckPhaseId)
          : -1;
        setSelectedPhaseIndex(requestedIndex >= 0 ? requestedIndex : findActivePhaseIndex(path));
        setLoadingState("success");
        // Drives the review-check button; failing to read it must not break the page. The
        // pool has no place on the page to scroll to, so a user sent here for it gets the
        // modal opened straight from this read.
        await refreshReviewCount({ openWhenPending: shouldOpenReviewCheck });
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          // No path generated yet — kick off AI personalization instead of erroring out.
          void generatePath({ recoverExisting: true });
          return;
        }
        setLoadingState("error");
        setErrorMessage(err instanceof Error ? err.message : "Unknown error");
      }
    };
    void loadOnBoardingPath();
    // Both flags come from the navigation that mounted this page, so they are fixed for the
    // visit; listing them keeps the effect honest about what it reads, and `hasLoadedRef`
    // makes a re-run a no-op anyway. `generatePath` is a stable component-scope function
    // (no props/state in its closure beyond the setters it calls), so omitting it here is
    // intentional and safe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusCheckPhaseId, shouldOpenReviewCheck]);

  const currentPhase = OnBoardingPathEndpoint?.phases[selectedPhaseIndex] ?? null;

  // Helper function for phase progress
  const getPhaseProgress = (phase: OnboardingPhaseEndpoint) => {
    const completed = phase.steps.filter(
      (step) => step.status === "FINISHED" || step.status === "SKIPPED",
    ).length;
    return {
      completed,
      total: phase.steps.length,
      percentage: phase.steps.length > 0 ? Math.round((completed / phase.steps.length) * 100) : 0,
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
    totalProgress.total > 0 ? Math.round((totalProgress.completed / totalProgress.total) * 100) : 0;

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
        phase.steps.every((step) => step.status === "FINISHED" || step.status === "SKIPPED"),
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
      <div className="flex min-h-screen items-center justify-center bg-app-bg">
        <div className="flex flex-col items-center gap-4 text-app-text-muted">
          <Loader2 className="h-8 w-8 animate-spin text-app-brand" />
          <p className="text-sm">Loading onboarding path...</p>
        </div>
      </div>
    );
  }

  // ── RENDER: GENERATING STATE ───────────────────────────────
  if (loadingState === "generating") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app-bg p-8">
        <div className={gameActive ? "w-full max-w-2xl text-center" : "max-w-md text-center"}>
          <Sparkles className="mx-auto mb-4 h-10 w-10 animate-pulse text-app-brand" />
          <h2 className="mb-2 text-lg font-semibold text-app-text">
            Generating your personalized onboarding path...
          </h2>
          <p className="mb-2 text-sm text-app-text-muted">
            {generationStage?.name ?? "Starting up"}
          </p>
          {generationStage?.detail && (
            <p className="mb-6 text-xs text-app-text-subtle">{generationStage.detail}</p>
          )}

          {gameActive ? (
            <div className="mt-6">
              <DinoGame onExit={closeGame} />
            </div>
          ) : (
            <Loader2 className="mx-auto mt-4 h-6 w-6 animate-spin text-app-brand" />
          )}
        </div>
      </div>
    );
  }

  // ── RENDER: ERROR STATE ────────────────────────────────────
  if (loadingState === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app-bg p-8">
        <div className="max-w-md text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-app-danger-solid" />
          <h2 className="mb-2 text-lg font-semibold text-app-text">
            Onboarding could not be loaded
          </h2>
          <p className="mb-6 text-sm text-app-text-muted">{errorMessage}</p>
          <Button variant="primary" onClick={() => window.location.reload()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  // ── RENDER: EMPTY STATE ────────────────────────────────────
  if (!OnBoardingPathEndpoint || !currentPhase) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app-bg">
        <p className="text-sm text-app-text-muted">No onboarding path found.</p>
      </div>
    );
  }

  // The knowledge check acts as the phase's final step: it only becomes
  // actionable once every real step is finished/skipped, and passing it unlocks
  // the next phase (or completes onboarding for the last phase).
  const allStepsDone = currentPhase.steps.every(
    (step) => step.status === "FINISHED" || step.status === "SKIPPED",
  );
  const isFinalPhase = OnBoardingPathEndpoint.phases.at(-1)?.id === currentPhase.id;

  // ── RENDER: SUCCESS STATE ──────────────────────────────────
  return (
    <div className="min-h-screen bg-app-bg">
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
                {/* Only offered once something is actually waiting to be reviewed. */}
                {openReviewCount > 0 && (
                  <Button
                    variant="secondary"
                    onClick={() => setReviewCheckOpen(true)}
                    title="Answer the questions you got wrong earlier"
                    icon={<Brain className="h-4 w-4" />}
                    className="border-app-warning-border bg-app-warning-bg text-app-warning-text hover:border-app-warning-solid"
                  >
                    <span className="hidden sm:inline">Test your knowledge</span>
                    <Badge variant="warning" size="sm">
                      {openReviewCount}
                    </Badge>
                  </Button>
                )}

                <Button
                  variant="secondary"
                  iconOnly
                  onClick={() => void generatePath()}
                  aria-label="Regenerate path with AI"
                  title="Regenerate path with AI"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>

                <div className="rounded-2xl border border-app-brand-border bg-app-brand-soft px-4 py-2 text-right">
                  <div className="text-3xl font-bold text-app-brand">{totalPercentage}%</div>
                  <div className="text-xs font-medium text-app-brand-text">overall</div>
                </div>
              </>
            }
          />

          {/* Total progress bar */}
          <ProgressBar value={totalProgress.completed} max={totalProgress.total} />

          {/* Phase tabs */}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
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
                  <div className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-app-text">
                    {phase.locked && (
                      <Lock className="h-3.5 w-3.5 shrink-0 text-app-text-disabled" />
                    )}
                    <span className="truncate">{phase.title}</span>
                    {phase.checkSummary?.required && (
                      <ClipboardCheck
                        className={`h-3.5 w-3.5 shrink-0 ${
                          phase.checkSummary.passed
                            ? "text-app-success-solid"
                            : "text-app-text-disabled"
                        }`}
                      />
                    )}
                  </div>
                  <ProgressBar value={progress.completed} max={progress.total} />
                  <div className="mt-2 flex justify-between">
                    <span className="text-xs text-app-text-muted">
                      {progress.completed}/{progress.total} Tasks
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
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
      <main className="app-page-content py-6 pt-8 pb-24">
        {/* "Up Next" Banner — nur wenn es einen empfohlenen Step gibt */}
        {recommendedStep && (
          <div className="relative mb-6 overflow-hidden rounded-2xl border border-app-brand-border bg-app-surface p-6 sm:p-8">
            <div className="pointer-events-none absolute top-0 right-0 h-64 w-64 rounded-full bg-app-brand-soft blur-3xl" />
            <div className="relative z-10">
              <Badge variant="brand" className="mb-4 gap-2">
                <PlayCircle className="h-3.5 w-3.5" />
                {recommendedStep.status === "IN_PROGRESS" ? "In progress" : "Up Next"}
              </Badge>
              <h2 className="text-2xl font-bold text-app-text sm:text-3xl">
                {recommendedStep.title}
              </h2>
              <div className="mt-3">
                <StepOriginBadge step={recommendedStep} />
              </div>
              <p className="mt-2 max-w-2xl text-app-text-muted">{recommendedStep.description}</p>
              <div className="mt-6 flex flex-wrap items-center gap-4">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => handleActiveStep(recommendedStep)}
                  trailingIcon={<ChevronRight className="h-4 w-4" />}
                >
                  {recommendedStep.status === "IN_PROGRESS" ? "Continue" : "Start now"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* "Knowledge check pending" banner — all steps of the phase are done,
            only the check still blocks the next phase */}
        {!recommendedStep && pendingCheckPhase && (
          <div className="relative mb-6 overflow-hidden rounded-2xl border border-app-brand-border bg-app-surface p-6 sm:p-8">
            <div className="pointer-events-none absolute top-0 right-0 h-64 w-64 rounded-full bg-app-brand-soft blur-3xl" />
            <div className="relative z-10">
              <Badge variant="brand" className="mb-4 gap-2">
                <ClipboardCheck className="h-3.5 w-3.5" />
                Knowledge check
              </Badge>
              <h2 className="text-2xl font-bold text-app-text sm:text-3xl">
                Ready for the {pendingCheckPhase.title} check?
              </h2>
              <p className="mt-2 max-w-2xl text-app-text-muted">
                You finished all steps of this phase. Pass the knowledge check to unlock the next
                phase.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-4">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => setCheckPhase(pendingCheckPhase)}
                  trailingIcon={<ChevronRight className="h-4 w-4" />}
                >
                  Start knowledge check
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Phase description */}
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-app-text">{currentPhase.title}</h2>
          <p className="mt-1 text-sm text-app-text-muted">{currentPhase.description}</p>
        </div>

        {/* Locked phase notice */}
        {currentPhase.locked && (
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-app-border bg-app-surface-muted p-4">
            <Lock className="h-5 w-5 shrink-0 text-app-text-muted" />
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
                    <div className="shrink-0 pt-0.5">
                      {step.status === "FINISHED" ? (
                        <CheckCircle2 className="h-5 w-5 text-app-success-solid" />
                      ) : step.status === "SKIPPED" ? (
                        <CircleArrowRight className="h-5 w-5 text-app-danger-solid" />
                      ) : step.status === "IN_PROGRESS" ? (
                        <CircleDot className="h-5 w-5 text-app-brand" />
                      ) : mode === "locked" ? (
                        <Lock className="h-5 w-5 text-app-text-disabled" />
                      ) : (
                        <Circle className="h-5 w-5 text-app-text-disabled" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        {/* Text */}
                        <div>
                          <h3
                            className={`text-base font-semibold ${
                              mode === "completed"
                                ? "text-app-text-subtle line-through"
                                : "text-app-text"
                            }`}
                          >
                            {step.title}
                          </h3>
                          <div className="mt-2">
                            <StepOriginBadge step={step} />
                          </div>
                          <p className="mt-1 text-sm leading-relaxed text-app-text-muted">
                            {step.description}
                          </p>
                        </div>

                        {/* Action depends on the step's mode:
                            active -> start/continue, completed -> status + read-only view,
                            locked -> status chip only (cannot be started yet) */}
                        <div className="shrink-0 self-start sm:self-center">
                          {mode === "active" ? (
                            <Button
                              variant="primary"
                              onClick={() => handleActiveStep(step)}
                              trailingIcon={<ChevronRight className="h-4 w-4" />}
                            >
                              {step.status === "IN_PROGRESS" ? "Continue" : "Start now"}
                            </Button>
                          ) : mode === "completed" ? (
                            <div className="flex items-center gap-3">
                              <span
                                className={`rounded-full px-3 py-1 text-xs font-medium ${
                                  step.status === "FINISHED"
                                    ? "bg-app-success-bg text-app-success-text"
                                    : "bg-app-surface-muted text-app-text-muted"
                                }`}
                              >
                                {step.status === "FINISHED" ? "Completed" : "Skipped"}
                              </span>
                              <button
                                onClick={() => openStep(step.id)}
                                className="flex items-center gap-2 rounded-xl border border-app-border px-4 py-2 text-sm font-medium text-app-text-muted transition-all hover:border-app-border-strong hover:text-app-text"
                              >
                                <Eye className="h-4 w-4" />
                                View
                              </button>
                            </div>
                          ) : (
                            <Badge variant="neutral" className="gap-1.5">
                              <Lock className="h-3.5 w-3.5" />
                              Locked
                            </Badge>
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
                  ref={checkCardRef}
                  className={`group rounded-2xl border bg-app-surface transition-all ${
                    passed
                      ? "border-app-border opacity-60"
                      : locked
                        ? "border-app-border opacity-75"
                        : "border-app-brand-border hover:border-app-border-strong hover:shadow-lg"
                  }`}
                >
                  <div className="p-5">
                    <div className="flex gap-4">
                      <div className="shrink-0 pt-0.5">
                        <ClipboardCheck
                          className={`h-5 w-5 ${
                            passed
                              ? "text-app-success-solid"
                              : locked
                                ? "text-app-text-disabled"
                                : "text-app-brand"
                          }`}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <h3
                              className={`text-base font-semibold ${
                                passed ? "text-app-text-subtle line-through" : "text-app-text"
                              }`}
                            >
                              Knowledge check
                            </h3>
                            <p className="mt-1 text-sm leading-relaxed text-app-text-muted">
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
                              <Badge variant="success">Passed</Badge>
                            ) : locked ? (
                              <Badge variant="neutral" className="gap-1.5">
                                <Lock className="h-3.5 w-3.5" />
                                Locked
                              </Badge>
                            ) : (
                              <Button
                                variant="primary"
                                onClick={() => setCheckPhase(currentPhase)}
                                trailingIcon={<ChevronRight className="h-4 w-4" />}
                              >
                                {currentPhase.checkSummary.latestAttemptId
                                  ? "Try again"
                                  : "Start check"}
                              </Button>
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

      {/* Standalone review check for questions missed in earlier phases */}
      {reviewCheckOpen && <ReviewCheckModal onClose={closeReviewCheckModal} />}
    </div>
  );
}
