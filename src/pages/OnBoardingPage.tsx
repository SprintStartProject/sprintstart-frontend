// ============================================================
// OnBoardingPage.tsx
// ============================================================

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type {
  OnboardingPathEndpoint,
  OnboardingPhaseEndpoint,
  OnboardingQuestionEndpoint,
  OnboardingStepEndpoint,
} from "../features/onboarding/types";
import { findActivePhaseIndex } from "../features/onboarding/activePhase";
import { itemNumbers } from "../features/onboarding/itemNumbers";
import { AskTheBuddy } from "../features/buddy/components/AskTheBuddy";
import { onBuddyPathChanged } from "../features/buddy/aiBuddyBus";
import {
  askAboutEmptyPhase,
  askAboutPhase,
  askAboutQuestion,
  askAboutStep,
} from "../features/onboarding/buddyDrafts";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { onboardingService } from "../services/onboardingService";
import { queryKeys } from "../services/queryKeys";
import { ApiError } from "../services/apiClient";
import { useProjectContext } from "../features/projects/useProjectContext";
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
  AlertTriangle,
  CircleArrowRight,
  CircleHelp,
  Lock,
  Eye,
  RefreshCw,
  GitBranch,
  ListChecks,
} from "lucide-react";
import { PageShell } from "../components/layout/PageShell";
import { DinoGame } from "../features/chatbot/components/DinoGame";
import { QuestionModal } from "../features/onboarding/components/QuestionModal";
import { useMoments } from "../features/moments";
import { usePathRevealMoment } from "../features/onboarding/hooks/usePathRevealMoment";
import { OnboardingGraphViewer } from "../features/onboarding/components/OnboardingGraphViewer.tsx";

type LoadingState = "idle" | "loading" | "empty" | "generating" | "success" | "error";

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

/** The DOM id of a step or question card, which a link from the buddy scrolls to. */
function linkedCardId(itemId: string): string {
  return `onboarding-item-${itemId}`;
}

/**
 * Displays the user's personalized onboarding path hierarchy.
 * Fetches and tracks progress through phases, steps and knowledge-check
 * questions. Questions are first-class nodes alongside the steps and are
 * answered one at a time in a per-question modal.
 */
export function OnBoardingPage() {
  // Selected phase index
  const [selectedPhaseIndex, setSelectedPhaseIndex] = useState<number>(0);
  const [viewMode, setViewMode] = useState<"list" | "graph">("list");

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
  const [gameActive, setGameActive] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(localStorage.getItem("dinoUnlocked") === "true");

  // The question currently open in the answer modal, paired with its phase title.
  const [questionToAnswer, setQuestionToAnswer] = useState<{
    question: OnboardingQuestionEndpoint;
    phaseTitle: string;
  } | null>(null);

  // The "on board" finale lives in the moments layer, so that it can take over
  // the screen rather than render inside this page's tree.
  const { celebrate: celebrateMoment, completeMission, flyby } = useMoments();

  // The reveal of a freshly built path, the first time its owner sees it.
  // Handed the path only once the page is showing it: whichever way the user
  // got here — waiting out the generator or opening onboarding days after it
  // finished — this is the moment the path first exists for them.
  usePathRevealMoment(loadingState === "success" ? OnBoardingPathEndpoint : null);

  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const invalidateMyOnboardingStatus = useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.myStatuses() }),
    [queryClient],
  );

  // The project the user currently has selected. Path generation is
  // project-scoped, so a regenerated path is rebuilt from this project's active
  // blueprint — never from the wrong project's.
  const { selectedProjectId, isLoading: isProjectLoading, isSwitcherEnabled } = useProjectContext();

  // Set by the step page when a knowledge-check question is what stands between the
  // user and the rest of their path, so this page can land on the question's phase.
  const focusQuestionId = (location.state as { focusQuestionId?: string } | null)?.focusQuestionId;

  /**
   * Where a link from the buddy points.
   *
   * The mentor is given each item's link so it can say "you are on [#3](...)" and have that be
   * clickable: `?step=<id>`, `?question=<id>` or `?phase=<id>`.
   *
   * A step or question link *lands* on the item rather than starting it — the right phase opens,
   * the page scrolls to the card, and the card lights up briefly. Following a link in a
   * conversation is a way of finding something, and starting a step (or opening a question to
   * answer) is the hire's own click on the card they can now see.
   *
   * In the URL rather than in router state, unlike `focusQuestionId`: this link is written by the
   * model into text the hire can copy, keep, or open in a second tab, and state does not survive any
   * of that.
   */
  const [searchParams, setSearchParams] = useSearchParams();
  const linkedStepId = searchParams.get("step");
  const linkedQuestionId = searchParams.get("question");
  const linkedPhaseId = searchParams.get("phase");
  const linkedItemId = linkedStepId ?? linkedQuestionId;

  // The question list of the focused phase, so the page can scroll to it.
  const questionListRef = useRef<HTMLDivElement>(null);
  const hasFocusedQuestionRef = useRef(false);

  // The horizontal list of phase tabs in the header.
  const phaseTabsRef = useRef<HTMLDivElement>(null);

  /**
   * A vertical mouse wheel over the phase tabs scrolls the row horizontally instead of the
   * page. The listener is non-passive so the event is captured while the pointer is over it.
   * Both axes feed the row: a vertical wheel pans it sideways, and a trackpad's horizontal
   * two-finger swipe (deltaX) scrolls it directly.
   */
  useEffect(() => {
    const phaseTabs = phaseTabsRef.current;
    if (!phaseTabs) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      phaseTabs.scrollLeft += event.deltaY + event.deltaX;
    };
    phaseTabs.addEventListener("wheel", handleWheel, { passive: false });
    return () => phaseTabs.removeEventListener("wheel", handleWheel);
  }, [loadingState]);

  /**
   * Brings the question list into view when the user was sent here because of a question.
   *
   * Fires once per visit: the list is the reason for the navigation, and without this the
   * user would land above it and not see what they were sent to do. Later phase switches
   * must not drag the view back down, hence the ref.
   */
  useEffect(() => {
    if (loadingState !== "success" || !focusQuestionId || hasFocusedQuestionRef.current) return;
    hasFocusedQuestionRef.current = true;
    questionListRef.current?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  }, [loadingState, focusQuestionId]);

  // Silently re-fetches the path, e.g. after a question attempt changed lock states.
  const refreshPath = async () => {
    try {
      const path = await onboardingService.fetchPath();
      setOnBoardingPath(path);
    } catch (err) {
      console.error("Failed to refresh onboarding path:", err);
    }
  };

  const closeQuestionModal = ({
    answered,
    correct,
    onboardingCompleted,
  }: {
    answered: boolean;
    correct: boolean;
    onboardingCompleted: boolean;
  }) => {
    const phases = OnBoardingPathEndpoint?.phases ?? [];
    setQuestionToAnswer(null);

    // The backend decides completion; nothing here is derived from the phase alone.
    if (onboardingCompleted) {
      completeMission();
    } else if (correct && questionToAnswer) {
      // Celebrate the phase, not the question: only when the correct answer finished off
      // the last open step or question does the whole phase count as complete. The local
      // path is still stale here, so the question just answered counts as passed.
      const phase = phases.find((item) => item.id === questionToAnswer.question.phaseId);
      const phaseIndex = phases.findIndex((item) => item.id === questionToAnswer.question.phaseId);
      const allStepsDone = phase?.steps.every(
        (step) => step.status === "FINISHED" || step.status === "SKIPPED",
      );
      const allQuestionsPassed = phase?.questions.every(
        (question) => question.status === "PASSED" || question.id === questionToAnswer.question.id,
      );
      if (allStepsDone && allQuestionsPassed) {
        celebrateMoment({
          tone: "milestone",
          title: "Phase completed",
          message: phase ? `You completed the ${phase.title} phase.` : "You completed the phase.",
          progress:
            phaseIndex >= 0 && phases.length > 0
              ? { current: phaseIndex + 1, total: phases.length }
              : undefined,
        });
      }
    }
    if (answered) {
      void invalidateMyOnboardingStatus();
      void refreshPath();
    }
  };

  // State updates do not disable a button until React renders again. This ref
  // closes that tiny gap as well, so a double click cannot open two streams.
  const generationInFlightRef = useRef(false);

  /** Triggers AI path generation only in response to an explicit user action. */
  const generatePath = async () => {
    if (generationInFlightRef.current) return;
    generationInFlightRef.current = true;
    setLoadingState("generating");
    setGenerationStage(null);
    setGameActive(false);
    if (!selectedProjectId) {
      generationInFlightRef.current = false;
      setLoadingState("error");
      setErrorMessage(
        "No project selected. Choose a project before generating your onboarding path.",
      );
      return;
    }
    try {
      await onboardingService.personalizePath(selectedProjectId, {
        onStage: (name, detail) => setGenerationStage({ name, detail }),
        onPath: (path) => {
          setOnBoardingPath(path);
          void invalidateMyOnboardingStatus();
          setSelectedPhaseIndex(findActivePhaseIndex(path));
        },
        onDone: () => setLoadingState("success"),
        onError: (message) => {
          setLoadingState("error");
          setErrorMessage(message);
        },
      });
    } catch (error) {
      setLoadingState("error");
      setErrorMessage(error instanceof Error ? error.message : "Path generation failed");
    } finally {
      generationInFlightRef.current = false;
    }
  };

  // Keep isUnlocked state perfectly in sync with localStorage and close game if locked
  useEffect(() => {
    const handleUnlockChange = () => {
      const unlocked = localStorage.getItem("dinoUnlocked") === "true";
      setIsUnlocked(unlocked);
      if (!unlocked) {
        setGameActive(false);
      }
    };
    window.addEventListener("dinoUnlockChanged", handleUnlockChange);
    window.addEventListener("storage", handleUnlockChange);
    return () => {
      window.removeEventListener("dinoUnlockChanged", handleUnlockChange);
      window.removeEventListener("storage", handleUnlockChange);
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
        (active.tagName === "TEXTAREA" || active.tagName === "INPUT" || active.isContentEditable);
      if (typing) return;

      e.preventDefault();
      setGameActive(true);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [loadingState, gameActive, isUnlocked]);

  /**
   * Re-reads the path after the buddy changed it.
   *
   * The buddy lives in a dock over this page, which is the page a hire is most likely to be on while
   * talking about their path. Without this, confirming "mark this step as done" in the conversation
   * left the list behind it still showing the step open — their own click looking like it had done
   * nothing. Told rather than polled; see `announceBuddyPathChanged`.
   *
   * Subscribed once: `refreshPath` only closes over the service and a setter, both stable for the
   * life of the page.
   */
  useEffect(() => onBuddyPathChanged(() => void refreshPath()), []);

  /**
   * The phase a buddy link names, resolved from the URL rather than copied into state.
   *
   * Derived on purpose. A link can arrive two ways — a fresh mount, or a click while the hire is
   * already standing on this page — and writing state from an effect would both trip the
   * set-state-in-an-effect rule and only handle the first. Deriving handles both and needs no
   * clean-up: the link stops winning the moment the hire picks a different phase or view, because
   * those clear the parameter.
   */
  const linkedPhaseIndex = useMemo(() => {
    const phases = OnBoardingPathEndpoint?.phases ?? [];
    if (linkedStepId) {
      return phases.findIndex((phase) => phase.steps.some((step) => step.id === linkedStepId));
    }
    if (linkedQuestionId) {
      return phases.findIndex((phase) =>
        phase.questions.some((question) => question.id === linkedQuestionId),
      );
    }
    return linkedPhaseId ? phases.findIndex((phase) => phase.id === linkedPhaseId) : -1;
  }, [OnBoardingPathEndpoint, linkedStepId, linkedQuestionId, linkedPhaseId]);

  /** Forgets the link, so the hire's own next click decides what they are looking at. */
  const clearLink = () =>
    setSearchParams(
      (params) => {
        params.delete("step");
        params.delete("question");
        params.delete("phase");
        return params;
      },
      { replace: true },
    );

  // ── DATA FETCHING using useEffect ─────────────────────────────

  // Guards the initial GET against StrictMode's development-only effect replay.
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    const loadOnBoardingPath = async () => {
      setLoadingState("loading");
      try {
        const path = await onboardingService.fetchPath();
        setOnBoardingPath(path);
        // Land on the phase the user is actually working on, not always phase 1. A phase
        // the step page pointed us at wins, since an earlier phase can still be open while
        // the question being waited on belongs to a later one.
        const requestedIndex = focusQuestionId
          ? path.phases.findIndex((phase) =>
              phase.questions.some((question) => question.id === focusQuestionId),
            )
          : -1;
        setSelectedPhaseIndex(requestedIndex >= 0 ? requestedIndex : findActivePhaseIndex(path));
        setLoadingState("success");
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          // Absence is a normal state. Generation starts only when the user asks
          // for it, preventing mounts, reloads and duplicate tabs from spawning
          // competing personalization requests.
          setOnBoardingPath(null);
          setLoadingState("empty");
          return;
        }
        setLoadingState("error");
        setErrorMessage(err instanceof Error ? err.message : "Unknown error");
      }
    };
    void loadOnBoardingPath();
    // The flag comes from the navigation that mounted this page, so it is fixed for the
    // visit; listing it keeps the effect honest about what it reads, and `hasLoadedRef`
    // makes a re-run a no-op anyway.
  }, [focusQuestionId]);

  // A link from the buddy wins while it is in the URL; the hire's own tab click clears it.
  const shownPhaseIndex = linkedPhaseIndex >= 0 ? linkedPhaseIndex : selectedPhaseIndex;
  const currentPhase = OnBoardingPathEndpoint?.phases[shownPhaseIndex] ?? null;
  const generationIssues = OnBoardingPathEndpoint?.generationIssues ?? [];
  const generationIssueSummary = generationIssues
    .map(
      (issue) =>
        `${issue.title} (${issue.status === "TIMED_OUT" ? "timed out" : issue.status.toLowerCase()})`,
    )
    .join(", ");

  // A link names a card in the list, so it shows the list even if the hire had left it on the graph.
  const shownViewMode = linkedItemId ? "list" : viewMode;

  /**
   * Scrolls to the card a link landed on.
   *
   * Keyed on `location.key` as well as the id, so following the same link a second time — the hire
   * scrolled away and clicked it again in the conversation — scrolls again. Only a scroll, never
   * state: which phase is open and which card lights up are both derived from the URL.
   */
  useEffect(() => {
    if (loadingState !== "success" || !linkedItemId) return;
    document
      .getElementById(linkedCardId(linkedItemId))
      ?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  }, [loadingState, linkedItemId, location.key]);

  /**
   * What a card needs to be the one a link landed on: an id to scroll to, a key that restarts the
   * light when the same link is followed again, and the class that plays it.
   */
  const linkedCard = (id: string) =>
    id === linkedItemId
      ? { id: linkedCardId(id), key: `${id}:${location.key}`, highlight: "app-link-highlight" }
      : { id: linkedCardId(id), key: id, highlight: "" };

  // The numbers this phase's items are shown with. The buddy's path tool derives the same ones, so
  // "let's do 3" means one item on both sides — see `itemNumbers`.
  const numbers = currentPhase ? itemNumbers(currentPhase) : new Map<string, number>();

  // Helper function for phase progress — steps and questions both count.
  const getPhaseProgress = (phase: OnboardingPhaseEndpoint) => {
    const questions = phase.questions ?? [];
    const completed =
      phase.steps.filter((step) => step.status === "FINISHED" || step.status === "SKIPPED").length +
      questions.filter((question) => question.status === "PASSED").length;
    return {
      completed,
      total: phase.steps.length + questions.length,
      percentage:
        phase.steps.length + questions.length > 0
          ? Math.round((completed / (phase.steps.length + questions.length)) * 100)
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
    totalProgress.total > 0 ? Math.round((totalProgress.completed / totalProgress.total) * 100) : 0;

  // Recommended next item: the first open, unlocked step across the unlocked phases,
  // falling back to the first open question. Neither can be recommended from a locked phase.
  const recommendedStep =
    OnBoardingPathEndpoint?.phases
      .filter((phase) => !phase.locked)
      .flatMap((phase) => phase.steps)
      .find((step) => step.status !== "FINISHED" && step.status !== "SKIPPED" && !step.locked) ??
    null;

  const recommendedQuestion =
    !recommendedStep &&
    (OnBoardingPathEndpoint?.phases
      .filter((phase) => !phase.locked)
      .flatMap((phase) => phase.questions.map((question) => ({ phase, question })))
      .find(({ question }) => question.status !== "PASSED" && question.status !== "LOCKED") ??
      null);

  // How a single step in the list should behave:
  //  - "completed": FINISHED or SKIPPED  -> read-only, can be reopened to look at it
  //  - "active":    the recommended next step -> can be started / continued
  //  - "locked":    a later, not-yet-reachable step (or any step in a locked phase)
  type StepMode = "completed" | "active" | "locked";
  const getStepMode = (step: OnboardingStepEndpoint, phaseLocked: boolean): StepMode => {
    if (step.status === "FINISHED" || step.status === "SKIPPED") return "completed";
    if (step.locked || phaseLocked) return "locked";
    if (recommendedStep && step.id === recommendedStep.id) return "active";
    return "locked";
  };

  // Open a step's detail page (read-only for completed steps, continue for started ones).
  const openStep = (stepId: string) => void navigate(`/onboarding/${stepId}`);

  // Start the step (records startedAt + sets IN_PROGRESS the first time) and open it.
  const startStep = async (stepId: string) => {
    try {
      await onboardingService.startStep(stepId);
      await invalidateMyOnboardingStatus();
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

  const openQuestion = (question: OnboardingQuestionEndpoint) =>
    setQuestionToAnswer({ question, phaseTitle: currentPhase?.title ?? "" });

  // How a single question card in the list should behave: passed ones are read-only,
  // anything the phase and the blocker graph leaves open can be answered, the rest is locked.
  const questionMode = (
    question: OnboardingQuestionEndpoint,
  ): "completed" | "active" | "locked" => {
    if (question.status === "PASSED") return "completed";
    if (question.status === "LOCKED" || currentPhase?.locked) return "locked";
    return "active";
  };

  // ── RENDER: LOADING STATE ──────────────────────────────────
  if (
    loadingState === "loading" ||
    loadingState === "idle" ||
    (loadingState === "empty" && isProjectLoading)
  ) {
    return (
      <PageShell
        icon={Sparkles}
        title="Your onboarding journey"
        subtitle="Follow your personalized path, continue the next task and review completed steps."
      >
        <div className="flex min-h-96 items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-app-text-muted">
            <Loader2 className="h-8 w-8 animate-spin text-app-brand" />
            <p className="text-sm">Loading onboarding path...</p>
          </div>
        </div>
      </PageShell>
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
              <DinoGame onExit={() => setGameActive(false)} />
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
      <PageShell
        icon={Sparkles}
        title="Your onboarding journey"
        subtitle="Follow your personalized path, continue the next task and review completed steps."
      >
        <div className="flex min-h-96 items-center justify-center p-8">
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
      </PageShell>
    );
  }

  // ── RENDER: NO PATH YET ──────────────────────────────────
  if (loadingState === "empty") {
    if (!selectedProjectId) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-app-bg p-8">
          <div className="max-w-md text-center">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-app-warning-text" />
            <h2 className="mb-2 text-xl font-semibold text-app-text">No project selected</h2>
            <p className="text-sm text-app-text-muted">
              {isSwitcherEnabled
                ? "Select a project from the project switcher before creating your personalized onboarding path."
                : "You need to be assigned to a project before a personalized onboarding path can be created. Ask your project manager or administrator for access."}
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-app-bg p-8">
        <div className="max-w-md text-center">
          <Sparkles className="mx-auto mb-4 h-12 w-12 text-app-brand" />
          <h2 className="mb-2 text-xl font-semibold text-app-text">Build your onboarding path</h2>
          <p className="mb-6 text-sm text-app-text-muted">
            Your personalized project path has not been created yet. Start it when you are ready.
          </p>
          <Button
            variant="primary"
            onClick={() => void generatePath()}
            icon={<PlayCircle className="h-4 w-4" />}
          >
            Start personalization
          </Button>
        </div>
      </div>
    );
  }

  // ── RENDER: EMPTY STATE ────────────────────────────────────
  if (!OnBoardingPathEndpoint) {
    return (
      <PageShell
        icon={Sparkles}
        title="Your onboarding journey"
        subtitle="Follow your personalized path, continue the next task and review completed steps."
      >
        <div className="flex min-h-96 items-center justify-center">
          <p className="text-sm text-app-text-muted">No onboarding path found.</p>
        </div>
      </PageShell>
    );
  }

  if (!currentPhase) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app-bg p-8">
        <div className="max-w-md text-center">
          <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-app-warning-text" />
          <h2 className="mb-2 text-xl font-semibold text-app-text">
            {generationIssues.length > 0
              ? "No onboarding phases were generated"
              : "No onboarding phases are available"}
          </h2>
          <p className="mb-2 text-sm text-app-text-muted">
            {generationIssues.length > 0
              ? "The generated phases were empty, could not be assembled, or timed out, so they have been left out of your journey."
              : "This onboarding path does not contain any phases for your current role and skills."}
          </p>
          {generationIssues.length > 0 && (
            <p className="mb-6 text-xs text-app-text-subtle">{generationIssueSummary}</p>
          )}
          <Button
            variant="primary"
            onClick={() => void generatePath()}
            icon={<RefreshCw className="h-4 w-4" />}
          >
            Try generation again
          </Button>
          {/* Generating again is the wrong hope when the corpus is what was thin -- it will come
              back empty a second time. The conversation is the one thing here that can actually
              produce something, so it is offered next to the retry rather than instead of it. */}
          {generationIssues.length > 0 && (
            <div>
              <AskTheBuddy
                question={askAboutEmptyPhase(generationIssues[0].title)}
                label="Work it out with your buddy instead"
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── RENDER: SUCCESS STATE ──────────────────────────────────
  const headerActions = (
    <>
      {generationIssues.length > 0 && (
        <span
          role="status"
          aria-label={`${generationIssues.length} onboarding ${generationIssues.length === 1 ? "phase" : "phases"} could not be generated`}
        >
          <Badge variant="warning" size="sm" title={generationIssueSummary}>
            <AlertTriangle className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            {generationIssues.length}
          </Badge>
        </span>
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
  );

  const headerBandExtra = (
    <>
      {/* Total progress bar */}
      <ProgressBar value={totalProgress.completed} max={totalProgress.total} />

      {/* Phase tabs */}
      <div
        ref={phaseTabsRef}
        className="mt-4 flex w-full max-w-full min-w-0 gap-3 overflow-x-auto pb-2"
        aria-label="Onboarding phases"
      >
        {OnBoardingPathEndpoint.phases.map((phase, index) => {
          const progress = getPhaseProgress(phase);
          const isSelected = selectedPhaseIndex === index;

          return (
            <button
              key={phase.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => {
                setSelectedPhaseIndex(index);
                clearLink();
              }}
              className={`min-w-64 flex-1 rounded-2xl border p-4 text-left transition-all duration-200 motion-reduce:hover:scale-100 ${
                isSelected
                  ? "border-app-brand bg-app-brand-soft"
                  : "border-app-border bg-app-surface hover:scale-[1.02] hover:border-app-brand-border-strong hover:bg-app-surface-hover hover:shadow-lg"
              }`}
            >
              <div className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-app-text">
                {phase.locked && <Lock className="h-3.5 w-3.5 shrink-0 text-app-text-disabled" />}
                <span className="truncate">{phase.title}</span>
              </div>
              <ProgressBar value={progress.completed} max={progress.total} />
              <div className="mt-2 flex justify-between">
                <span className="text-xs text-app-text-muted">
                  {progress.completed}/{progress.total} items
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
    </>
  );

  return (
    <>
      <PageShell
        icon={Sparkles}
        title="Your onboarding journey"
        subtitle="Follow your personalized path, continue the next task and review completed steps."
        frame="content"
        actions={headerActions}
        bandExtra={headerBandExtra}
        mainClassName="py-6 pt-8 pb-24"
      >
        <div className="mb-6 flex flex-wrap gap-2" aria-label="Onboarding view">
          <Button
            size="sm"
            variant={shownViewMode === "list" ? "primary" : "secondary"}
            aria-pressed={shownViewMode === "list"}
            icon={<ListChecks className="h-4 w-4" />}
            onClick={() => setViewMode("list")}
          >
            List view
          </Button>
          <Button
            size="sm"
            variant={shownViewMode === "graph" ? "primary" : "secondary"}
            aria-pressed={shownViewMode === "graph"}
            icon={<GitBranch className="h-4 w-4" />}
            onClick={() => {
              setViewMode("graph");
              clearLink();
            }}
          >
            Graph view
          </Button>
        </div>

        {shownViewMode === "graph" ? (
          <OnboardingGraphViewer
            path={OnBoardingPathEndpoint}
            selectedPhaseId={currentPhase.id}
            onSelectPhase={(phaseId) => {
              const phaseIndex = OnBoardingPathEndpoint.phases.findIndex(
                (phase) => phase.id === phaseId,
              );
              if (phaseIndex >= 0) setSelectedPhaseIndex(phaseIndex);
              clearLink();
            }}
          />
        ) : (
          <>
            {/* "Up Next" banner — the recommended step, or the recommended question when
                no step is left before it */}
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
                  <p className="mt-2 max-w-2xl text-app-text-muted">
                    {recommendedStep.description}
                  </p>
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

            {!recommendedStep && recommendedQuestion && (
              <div className="relative mb-6 overflow-hidden rounded-2xl border border-app-brand-border bg-app-surface p-6 sm:p-8">
                <div className="pointer-events-none absolute top-0 right-0 h-64 w-64 rounded-full bg-app-brand-soft blur-3xl" />
                <div className="relative z-10">
                  <Badge variant="brand" className="mb-4 gap-2">
                    <CircleHelp className="h-3.5 w-3.5" />
                    Knowledge question
                  </Badge>
                  <h2 className="text-2xl font-bold text-app-text sm:text-3xl">
                    {recommendedQuestion.question.question}
                  </h2>
                  <p className="mt-2 max-w-2xl text-app-text-muted">
                    {recommendedQuestion.question.status === "RETRY"
                      ? "You got this one wrong before — answer it correctly to move on."
                      : "Answer this question to move on in your onboarding."}
                  </p>
                  <div className="mt-6 flex flex-wrap items-center gap-4">
                    <Button
                      variant="primary"
                      size="lg"
                      onClick={() => openQuestion(recommendedQuestion.question)}
                      trailingIcon={<ChevronRight className="h-4 w-4" />}
                    >
                      {recommendedQuestion.question.status === "RETRY" ? "Try again" : "Answer now"}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Phase description */}
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-app-text">{currentPhase.title}</h2>
              <p className="mt-1 text-sm text-app-text-muted">{currentPhase.description}</p>
              {/* The phase-level way in. A hire who does not know why a phase is here is not helped
                  by any of the buttons below it. */}
              <AskTheBuddy
                question={
                  currentPhase.steps.length === 0 && currentPhase.questions.length === 0
                    ? askAboutEmptyPhase(currentPhase.title)
                    : askAboutPhase(currentPhase)
                }
                label={
                  currentPhase.steps.length === 0 && currentPhase.questions.length === 0
                    ? "This phase is empty — talk it through with your buddy"
                    : "Ask your buddy about this phase"
                }
              />
            </div>

            {/* Locked phase notice */}
            {currentPhase.locked && (
              <div className="mb-4 flex items-center gap-3 rounded-2xl border border-app-border bg-app-surface-muted p-4">
                <Lock className="h-5 w-5 shrink-0 text-app-text-muted" />
                <p className="text-sm text-app-text-muted">
                  This phase unlocks once all its prerequisite phases are complete.
                </p>
              </div>
            )}

            {/* Task list */}
            <div className="space-y-4">
              {currentPhase.steps.map((step) => {
                const mode = getStepMode(step, currentPhase.locked);
                return (
                  <div
                    key={linkedCard(step.id).key}
                    id={linkedCard(step.id).id}
                    // Completed and locked steps stay still on purpose: nothing
                    // happens when you click them, and magnifying them would
                    // promise an interaction that is not there.
                    className={`group rounded-2xl border bg-app-surface transition-all duration-200 motion-reduce:hover:scale-100 ${linkedCard(step.id).highlight} ${
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
                                {/* The number the buddy uses for this item. Quiet, and not part of
                                    the title: it is a handle for talking about the step, not
                                    something the step is called. */}
                                <span className="mr-2 font-mono text-sm text-app-text-subtle">
                                  #{numbers.get(step.id)}
                                </span>
                                {step.title}
                              </h3>
                              <div className="mt-2">
                                <StepOriginBadge step={step} />
                              </div>
                              <p className="mt-1 text-sm leading-relaxed text-app-text-muted">
                                {step.description}
                              </p>
                              {/* Not on a finished or skipped step: there is nothing left to be
                                  stuck on, and an invitation there is noise on a list of them. */}
                              {mode !== "completed" && (
                                <AskTheBuddy
                                  question={askAboutStep(step)}
                                  label="Ask your buddy about this step"
                                />
                              )}
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

              {/* Questions — first-class nodes listed after the steps */}
              {currentPhase.questions.length > 0 && (
                <div ref={questionListRef} className="space-y-4">
                  <div className="flex items-center gap-2 pt-4">
                    <CircleHelp className="h-5 w-5 text-app-brand" />
                    <h3 className="text-base font-semibold text-app-text">Knowledge questions</h3>
                  </div>
                  {currentPhase.questions.map((question) => {
                    const mode = questionMode(question);
                    return (
                      <div
                        key={linkedCard(question.id).key}
                        id={linkedCard(question.id).id}
                        className={`group rounded-2xl border bg-app-surface transition-all duration-200 motion-reduce:hover:scale-100 ${linkedCard(question.id).highlight} ${
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
                              {mode === "completed" ? (
                                <CheckCircle2 className="h-5 w-5 text-app-success-solid" />
                              ) : mode === "locked" ? (
                                <Lock className="h-5 w-5 text-app-text-disabled" />
                              ) : (
                                <CircleHelp className="h-5 w-5 text-app-brand" />
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                  <h3
                                    className={`text-base font-semibold ${
                                      mode === "completed"
                                        ? "text-app-text-subtle line-through"
                                        : "text-app-text"
                                    }`}
                                  >
                                    <span className="mr-2 font-mono text-sm text-app-text-subtle">
                                      #{numbers.get(question.id)}
                                    </span>
                                    {question.question}
                                  </h3>
                                  <p className="mt-1 text-sm leading-relaxed text-app-text-muted">
                                    {question.type === "MULTIPLE_CHOICE"
                                      ? "Multiple choice"
                                      : "Short text answer"}
                                  </p>
                                  {/* The tutoring moment. Offered on a question still open --
                                      loudest on one already answered wrong, which is where a hire
                                      previously had nowhere to go but another guess. */}
                                  {mode !== "completed" && (
                                    <AskTheBuddy
                                      question={askAboutQuestion(question, currentPhase.title)}
                                      label={
                                        question.status === "RETRY"
                                          ? "Go through this with your buddy"
                                          : "Ask your buddy to explain the material"
                                      }
                                    />
                                  )}
                                </div>

                                <div className="shrink-0 self-start sm:self-center">
                                  {mode === "completed" ? (
                                    <Badge variant="success">Passed</Badge>
                                  ) : mode === "locked" ? (
                                    <Badge variant="neutral" className="gap-1.5">
                                      <Lock className="h-3.5 w-3.5" />
                                      Locked
                                    </Badge>
                                  ) : (
                                    <Button
                                      variant="primary"
                                      onClick={() => openQuestion(question)}
                                      trailingIcon={<ChevronRight className="h-4 w-4" />}
                                    >
                                      {question.status === "RETRY" ? "Try again" : "Answer"}
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </PageShell>

      {/* Per-question answer modal. Opened by the card's own button, never by a link. */}
      {questionToAnswer && (
        <QuestionModal
          question={questionToAnswer.question}
          phaseTitle={questionToAnswer.phaseTitle}
          onClose={closeQuestionModal}
        />
      )}
    </>
  );
}
