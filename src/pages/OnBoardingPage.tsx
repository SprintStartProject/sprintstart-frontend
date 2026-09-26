// ============================================================
// OnBoardingPage.tsx
// ============================================================

import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  FolderKanban,
  GitBranch,
  ListChecks,
  Loader2,
  Lock,
  PlayCircle,
  RefreshCw,
  Rocket,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../components/layout/PageHeader";
import { PageShell } from "../components/layout/PageShell";
import { AlertDialog } from "../components/ui/AlertDialog";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { SegmentedTabs } from "../components/ui/SegmentedTabs";
import { SLIDING_PANEL_EXIT_MS, SlidingTabPanel } from "../components/ui/SlidingTabPanel";
import { useAuth } from "../context/useAuth";
import { useToast } from "../context/useToast";
import { useSwipeableTabs } from "../hooks/useHorizontalWheelNavigation";
import { GenerationScreen } from "../features/onboarding/components/journey/GenerationScreen";
import { JourneyGraph } from "../features/onboarding/components/journey/JourneyGraph";
import { PhaseChooser } from "../features/onboarding/components/journey/PhaseChooser";
import { PhaseItemList } from "../features/onboarding/components/journey/PhaseItemList";
import { PhaseNavigator } from "../features/onboarding/components/journey/PhaseNavigator";
import { primaryActionLabel } from "../features/onboarding/graph/nodeLabels";
import { QuestionWorkspace } from "../features/onboarding/components/journey/QuestionWorkspace";
import { StepWorkspace } from "../features/onboarding/components/journey/StepWorkspace";
import {
  useOnboardingJourney,
  type GenerationFailureReason,
  type GenerationPhaseProgress,
  type UnavailableReason,
} from "../features/onboarding/generation/OnboardingJourneyContext";
import { ProgressRing } from "../features/onboarding/graph/JourneyNodeCards";
import { usePathRevealMoment } from "../features/onboarding/hooks/usePathRevealMoment";
import {
  blockingPhases,
  itemState,
  pathProgress,
  phaseItems,
  phaseProgress,
  phaseState,
  phasesUnlockedBy,
  sortedPhases,
  waitingOn,
  type PhaseItem,
} from "../features/onboarding/journey";
import { resolveNextAction } from "../features/onboarding/nextAction";
import type {
  OnboardingPathEndpoint,
  OnboardingPhaseEndpoint,
  OnboardingQuestionEndpoint,
  QuestionAttemptResult,
} from "../features/onboarding/types";
import { useMoments } from "../features/moments";
import { useProjectContext } from "../features/projects/useProjectContext";
import { ApiError } from "../services/apiClient";
import { onboardingGraphService } from "../services/onboardingGraphService";
import { onboardingService } from "../services/onboardingService";
import { queryKeys } from "../services/queryKeys";
import { GenerationIssueSummary } from "../features/onboarding/components/GenerationIssueSummary";
import { issueStatusLabel, retryCouldHelp } from "../features/onboarding/generationIssues";
import {
  notifySkipAnswerSeen,
  withSkipAnswerSeen,
  withSkipAnswerUnseen,
} from "../features/onboarding/skipAnswers";
import {
  hireJourneyViewKey,
  readJourneyView,
  writeJourneyView,
} from "../features/onboarding/journeyViewMemory";

type LoadingState = "loading" | "empty" | "success" | "error";
type ViewMode = "list" | "graph";

const VIEW_ORDER: readonly ViewMode[] = ["list", "graph"];

type NavigationState = {
  focusQuestionId?: string;
  choosePhase?: boolean;
  /** A phase to land on, set by anything that sends the member here pointing at one. */
  openPhaseId?: string;
} | null;

/** The phase a visit opens on: what the member was sent for, else where they are, else a choice. */
function initialPhaseId(
  path: OnboardingPathEndpoint,
  phases: OnboardingPhaseEndpoint[],
  focusItemId: string | undefined,
  openPhaseId: string | undefined,
): string {
  // A phase asked for by name wins over everything: whoever sent the member here was pointing at
  // it, and landing them somewhere else answers a question they did not ask.
  const named = openPhaseId ? phases.find((phase) => phase.id === openPhaseId) : undefined;
  if (named) return named.id;
  const requested = focusItemId
    ? phases.find((phase) => phaseItems(phase).some((item) => item.id === focusItemId))
    : undefined;
  if (requested) return requested.id;
  const next = resolveNextAction(path);
  if (next.kind === "step" || next.kind === "question") return next.phase.id;
  if (next.kind === "choose") return next.phases[0].id;
  return (
    (phases.find((phase) => phaseState(phase) !== "done") ?? phases[phases.length - 1])?.id ?? ""
  );
}

/**
 * The hire's onboarding path.
 *
 * Two ways through the same path, switched by the page's slider (or a two-finger swipe):
 *
 * - **List** -- the phases on the left, grouped by where the hire stands with them, and the selected
 *   phase's steps and questions on the right. Phases are not a queue: a blueprint opens several at
 *   once, so the page shows them as a choice, and "up next" follows the phase the hire is working in
 *   rather than the lowest phase number.
 * - **Graph** -- the journey map of all phases. Clicking a phase flies into it and shows the graph of
 *   its steps; "Journey map" flies back out.
 *
 * Building a path is not this page's job: `OnboardingJourneyProvider` owns the generation, so
 * leaving the page does not cancel it, and coming back shows its progress again.
 */
export function OnBoardingPage() {
  const location = useLocation();
  // `/onboarding/:stepId` -- the old address of a step page -- now opens the path with that step
  // unfolded, so links from the dashboard and the buddy keep landing on the step.
  const { stepId: routeStepId } = useParams<{ stepId?: string }>();
  const navigate = useNavigate();
  // Whose remembered view this is. Browser storage is per browser, so without this two accounts
  // on one machine share the List/Graph mode and the phase the graph was left on. Empty only
  // before the profile is there, which `AuthGuard` does not render this page without -- the
  // fallbacks below keep that case from writing under the wrong key anyway.
  const viewerId = useAuth().profile?.id ?? "";
  const viewKey = viewerId ? hireJourneyViewKey(viewerId) : null;
  const toast = useToast();
  const { celebrate: celebrateMoment, completeMission, flyby } = useMoments();
  const {
    selectedProjectId,
    isLoading: isProjectLoading,
    isSwitcherEnabled,
    canManageSelected,
  } = useProjectContext();
  const journey = useOnboardingJourney();
  const { generation, startGeneration, clearGeneration } = journey;

  const navigationState = location.state as NavigationState;
  // Set by the step page when a knowledge-check question is what stands between the user and the
  // rest of their path, so this page can land on the question's phase.
  const focusItemId = routeStepId ?? navigationState?.focusQuestionId;
  // Set by the board's "where you are" strip when a phase on it is pressed.
  const openPhaseId = navigationState?.openPhaseId;

  const [path, setPath] = useState<OnboardingPathEndpoint | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedPhaseId, setSelectedPhaseId] = useState("");
  // A phase picked from the chooser before anything in it was started -- until then nothing else
  // says that this is where the hire wants to be.
  const [chosenPhaseId, setChosenPhaseId] = useState<string | null>(null);
  // Where the member left the page last time: list or graph, and the phase the graph was zoomed into.
  // A link to a step always opens the list, since that is where the step unfolds.
  // Arriving for a particular step, question or phase choice opens the list: that is where each of
  // them unfolds, whichever view was used last.
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    routeStepId || navigationState?.focusQuestionId || navigationState?.choosePhase
      ? "list"
      : viewKey
        ? readJourneyView(viewKey).mode
        : "list",
  );
  const [graphPhaseId, setGraphPhaseId] = useState<string | null>(
    // A phase arrived at by name opens *inside* itself on the graph, the same way it opens selected
    // in the list — the two views' idea of "here" has to be the one place the member was sent.
    () => openPhaseId ?? (viewKey ? readJourneyView(viewKey).graphPhaseId : null),
  );
  // The item unfolded in the list, and the one zoomed into on the graph.
  const [expandedItemId, setExpandedItemId] = useState<string | null>(focusItemId ?? null);
  const [graphItemId, setGraphItemId] = useState<string | null>(null);
  /**
   * Whether the list is on screen because this visit arrived for a step, a question or the phase
   * chooser, rather than because the member wanted it.
   *
   * Without the distinction, one click on the dashboard's next-step card wrote "list" over a
   * member's remembered graph -- for good, and again every time they used that card. Choosing a
   * view clears it, and only then is the choice remembered.
   */
  const arrivedInForcedList = useRef(
    Boolean(routeStepId || navigationState?.focusQuestionId || navigationState?.choosePhase),
  );
  const chooseViewMode = useCallback((mode: ViewMode) => {
    arrivedInForcedList.current = false;
    setViewMode(mode);
  }, []);
  const chooserScrollTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(chooserScrollTimer.current), []);
  /** Brings the phase chooser into view, once the panel holding it has slid in. */
  const scrollToChooser = useCallback(() => {
    window.clearTimeout(chooserScrollTimer.current);
    chooserScrollTimer.current = window.setTimeout(
      () =>
        document
          .querySelector("#phase-chooser")
          ?.scrollIntoView?.({ behavior: "smooth", block: "center" }),
      SLIDING_PANEL_EXIT_MS,
    );
  }, []);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [isDinoActiveInGeneration, setIsDinoActiveInGeneration] = useState(false);
  /**
   * The last running generation, kept so the generation screen can stay up while the dino game
   * is still being played after the run has ended (see `isDinoActiveInGeneration`).
   *
   * `completed` outlives the `done` status on purpose: the page clears a finished generation as
   * soon as the new path is fetched, so the status drops to `idle` while the game may still be
   * open. Without the flag the screen would fall back to the frozen "working" snapshot and stop
   * saying "Path ready".
   */
  const [lastGeneration, setLastGeneration] = useState<{
    phases: GenerationPhaseProgress[];
    startedAt: number;
    completed: boolean;
  }>(() =>
    generation.status === "running"
      ? { phases: generation.phases, startedAt: generation.startedAt, completed: false }
      : { phases: [], startedAt: 0, completed: false },
  );

  // Follows the generation during render (React's "adjust state when a value changes" pattern)
  // rather than in an effect, so the screen never paints one frame with a stale outcome.
  const [seenGeneration, setSeenGeneration] = useState(generation);
  if (seenGeneration !== generation) {
    setSeenGeneration(generation);
    if (generation.status === "running") {
      setLastGeneration({
        phases: generation.phases,
        startedAt: generation.startedAt,
        completed: false,
      });
    } else if (generation.status === "done") {
      setLastGeneration((previous) => ({ ...previous, completed: true }));
    } else if (generation.status === "error") {
      // Failure wins over the game: the snapshot's phases are still "working", so keeping the
      // generation screen up for the game would hide the failure behind a wait that is over.
      // Dropping the flag unmounts the screen, which releases the game's shared slot with it.
      setIsDinoActiveInGeneration(false);
    }
  }
  // Set when the page itself moves the member on, so the item they land on is scrolled to.
  const scrollToItemRef = useRef<string | null>(focusItemId ?? null);

  usePathRevealMoment(loadingState === "success" ? path : null);

  const phases = useMemo(() => (path ? sortedPhases(path) : []), [path]);

  const queryClient = useQueryClient();
  const applyPath = useCallback(
    (next: OnboardingPathEndpoint, { keepSelection }: { keepSelection: boolean }) => {
      setPath(next);
      // The dashboard's "next step" card reads the same path through the query cache.
      void queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.myStatuses() });
      setSelectedPhaseId((current) => {
        const ordered = sortedPhases(next);
        if (keepSelection && ordered.some((phase) => phase.id === current)) return current;
        return initialPhaseId(next, ordered, focusItemId, openPhaseId);
      });
      setLoadingState("success");
    },
    [focusItemId, openPhaseId, queryClient],
  );

  // ── Loading ─────────────────────────────────────────────────

  const hasLoadedRef = useRef(false);
  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    void (async () => {
      try {
        // The step a link points at is started by the arrival effect below, which sees every
        // link rather than only the one this visit started with.
        applyPath(await onboardingService.fetchPath(), { keepSelection: false });
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          // Absence is a normal state; a path is only built when the user asks for one.
          setLoadingState("empty");
          return;
        }
        setLoadingState("error");
        setErrorMessage(error instanceof Error ? error.message : "Unknown error");
      }
    })();
  }, [applyPath]);

  const refreshPath = useCallback(async () => {
    try {
      applyPath(await onboardingService.fetchPath(), { keepSelection: true });
    } catch (error) {
      console.error("Failed to refresh onboarding path:", error);
      // Said out loud: after finishing a step, a silent failure leaves progress looking unchanged.
      toast.error("Your path could not be refreshed", {
        description: "What you did is saved. Reload the page to see it.",
      });
    }
  }, [applyPath, toast]);

  // A generation that finished -- here or while the user was elsewhere -- means there is a new path.
  // Read fresh rather than taken from the generation: the hire may have started working on it before
  // coming back here, and the stream's copy knows nothing of that.
  useEffect(() => {
    if (generation.status !== "done") return;
    let cancelled = false;
    onboardingService
      .fetchPath()
      .then((next) => {
        if (!cancelled) applyPath(next, { keepSelection: false });
      })
      .catch((error: unknown) => console.error("Failed to load the new onboarding path:", error))
      .finally(() => clearGeneration());
    return () => {
      cancelled = true;
    };
  }, [applyPath, clearGeneration, generation]);

  // A rebuild that failed leaves the path the member already had in place -- so the failure is said
  // once, beside it, instead of taking the page over.
  useEffect(() => {
    if (generation.status !== "error" || loadingState !== "success" || !path) return;
    toast.error("Your path could not be rebuilt", {
      description:
        generation.reason === "not-enough-knowledge"
          ? "The project's knowledge base does not cover any phase yet. Your current path is unchanged."
          : `${generation.message} Your current path is unchanged.`,
    });
    clearGeneration();
  }, [clearGeneration, generation, loadingState, path, toast]);

  /**
   * Everything this visit was sent here for, in one place: a step in the address, a question or
   * the phase chooser in the router's state.
   *
   * One effect rather than one per instruction, and keyed on the instruction rather than run once
   * on mount. `/onboarding` and `/onboarding/:stepId` are the same component in the same position,
   * so a second link arriving while the page is open remounts nothing -- which is how the first
   * version came to follow a changed step id but not a changed question, and to bring the chooser
   * into view exactly once per visit however often somebody was sent to it.
   *
   * Each arrival does the same four things: check the target is still on the path, put the view
   * where the target unfolds, start a step that was opened for the first time, and scroll to it.
   */
  const focusQuestionId = navigationState?.focusQuestionId;
  const wantsChooser = Boolean(navigationState?.choosePhase);
  const arrival = useMemo(
    () =>
      routeStepId
        ? { kind: "step" as const, id: routeStepId }
        : focusQuestionId
          ? { kind: "question" as const, id: focusQuestionId }
          : wantsChooser
            ? { kind: "choose" as const, id: "" }
            : null,
    [focusQuestionId, routeStepId, wantsChooser],
  );
  const arrivalKey = arrival ? `${arrival.kind}:${arrival.id}` : "";
  const handledArrivalRef = useRef("");

  // Read by the arrival effect, which must not re-run every time one of these is recreated.
  const startStepRef = useRef<(item: PhaseItem) => void>(() => undefined);
  const scrollToChooserRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    if (loadingState !== "success" || !path || !arrival) return;
    if (handledArrivalRef.current === arrivalKey) return;
    handledArrivalRef.current = arrivalKey;

    // Deferred to a microtask: React 19's lint rejects a synchronous setState in an effect body,
    // and this is the pattern the repo already passes with.
    queueMicrotask(() => {
      // The list, whichever view was last used: a step, a question and the chooser all unfold
      // there. Marked as forced, so it is not written back as a preference the member chose.
      arrivedInForcedList.current = true;
      setViewMode("list");

      if (arrival.kind === "choose") {
        setExpandedItemId(null);
        scrollToChooserRef.current();
        return;
      }

      const owningPhase = path.phases.find((phase) =>
        phaseItems(phase).some((item) => item.id === arrival.id),
      );
      if (!owningPhase) {
        toast.error(
          arrival.kind === "step"
            ? "That step is not on your path"
            : "That question is not on your path",
          { description: "It may have been replaced when your path was rebuilt." },
        );
        // Only the step has an address of its own to go back from; a question arrives in router
        // state, which is dropped by navigating to the same place without it.
        void navigate("/onboarding", { replace: true, state: null });
        return;
      }

      setSelectedPhaseId(owningPhase.id);
      scrollToItemRef.current = arrival.id;
      setExpandedItemId(arrival.id);

      // A step opened by its address is started like one opened by a click -- including the
      // second link of a visit, which the load-time version could not see.
      const item = phaseItems(owningPhase).find((candidate) => candidate.id === arrival.id);
      if (item) startStepRef.current(item);
    });
  }, [arrival, arrivalKey, loadingState, navigate, path, toast]);

  // Scrolls to an item the page opened on the member's behalf -- a link, "up next", "continue".
  useEffect(() => {
    const target = scrollToItemRef.current;
    if (loadingState !== "success" || !target || target !== expandedItemId) return;
    scrollToItemRef.current = null;
    document
      .querySelector(`[data-item-id="${target}"]`)
      ?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, [expandedItemId, loadingState, selectedPhaseId]);

  // A remembered phase that is not in this path (a rebuilt path, another project) opens the map.
  const openGraphPhaseId = phases.some((phase) => phase.id === graphPhaseId) ? graphPhaseId : null;
  useEffect(() => {
    if (loadingState !== "success" || arrivedInForcedList.current || !viewKey) return;
    writeJourneyView(viewKey, { mode: viewMode, graphPhaseId: openGraphPhaseId });
  }, [loadingState, openGraphPhaseId, viewKey, viewMode]);

  const swipeRef = useSwipeableTabs<ViewMode, HTMLDivElement>({
    order: VIEW_ORDER,
    value: viewMode,
    onChange: chooseViewMode,
    // Not while a step or a question is open. The two views are the two halves of a
    // `SlidingTabPanel`, which unmounts the one being left -- so a stray sideways flick took a
    // typed short answer, a grading result, a half-written skip reason or feedback comment with
    // it. Switching deliberately, from the tab bar, still does that; a gesture should not.
    enabled: loadingState === "success" && expandedItemId === null && graphItemId === null,
  });

  // ── Derived ─────────────────────────────────────────────────

  const nextAction = useMemo(
    () => (path ? resolveNextAction(path, { preferPhaseId: chosenPhaseId }) : null),
    [chosenPhaseId, path],
  );
  const nextItemId =
    nextAction?.kind === "step"
      ? nextAction.step.id
      : nextAction?.kind === "question"
        ? nextAction.question.id
        : null;
  const focusPhaseId =
    nextAction?.kind === "step" || nextAction?.kind === "question" ? nextAction.phase.id : null;
  const selectedPhase = phases.find((phase) => phase.id === selectedPhaseId) ?? phases[0] ?? null;
  const overall = path ? pathProgress(path) : null;
  const generationIssues = path?.generationIssues ?? [];
  const generationIssueSummary = generationIssues
    .map((issue) => `${issue.title} — ${issueStatusLabel(issue.status)}`)
    .join("\n");

  // ── Actions ─────────────────────────────────────────────────

  const phaseOf = (item: PhaseItem) =>
    phases.find(
      (phase) => phase.id === (item.kind === "step" ? item.step.phaseId : item.question.phaseId),
    );

  /** A step the member opens for the first time is started; reopening one changes nothing. */
  const beginStepIfWaiting = async (item: PhaseItem) => {
    if (item.kind !== "step" || item.step.status !== "WAITING" || item.step.locked) return;
    try {
      await onboardingService.startStep(item.step.id);
      // The rocket marks a step *beginning*.
      flyby();
      await refreshPath();
    } catch (error) {
      console.error("Failed to start onboarding step:", error);
      toast.error("The step could not be started", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  // Refreshed every render, so the arrival effect can call the latest of each without taking a
  // dependency on a function that is recreated on every render.
  useEffect(() => {
    startStepRef.current = (item) => void beginStepIfWaiting(item);
    scrollToChooserRef.current = scrollToChooser;
  });

  /**
   * The answer to a skip request has been drawn for the member, so its "new" marker goes -- here
   * and, so it stays gone on every device, on the server.
   *
   * Called by the step workspace once it has the answer on screen. Doing it from `openItem`
   * marked answers seen on the way past: "Continue" and "Up next" open steps too, and a deep link
   * opens one without going through it at all.
   */
  const acknowledgeSkipAnswer = useCallback(
    (skipId: string) => {
      const seenAt = new Date().toISOString();
      setPath((current) => (current ? withSkipAnswerSeen(current, skipId, seenAt) : current));
      onboardingService
        .markSkipAnswerSeen(skipId)
        .then(notifySkipAnswerSeen)
        .catch((error: unknown) => {
          console.error("Failed to mark skip answer as seen:", error);
          // Put back, rather than left gone for the session and back after a reload -- and
          // disagreeing with the sidebar's count in the meantime.
          setPath((current) => (current ? withSkipAnswerUnseen(current, skipId) : current));
          toast.error("The answer is still marked new", {
            description: "It could not be marked as seen. It will still be there next time.",
          });
        });
    },
    [toast],
  );

  /** Start, continue or answer: the item opens where it is -- unfolded in the list, or on the graph. */
  const openItem = (item: PhaseItem) => {
    const phase = phaseOf(item);
    if (phase) setSelectedPhaseId(phase.id);
    if (viewMode === "graph") {
      setGraphPhaseId(phase?.id ?? null);
      setGraphItemId(item.id);
    } else {
      scrollToItemRef.current = item.id;
      setExpandedItemId(item.id);
    }
    void beginStepIfWaiting(item);
  };

  const toggleItem = (item: PhaseItem) => {
    if (expandedItemId === item.id) {
      setExpandedItemId(null);
      return;
    }
    openItem(item);
  };

  const selectPhase = (phaseId: string) => {
    setSelectedPhaseId(phaseId);
    setExpandedItemId(null);
  };

  const choosePhase = (phaseId: string) => {
    setChosenPhaseId(phaseId);
    selectPhase(phaseId);
  };

  /** What "continue" does once an item in a phase is behind the member, and what its button says. */
  const continueAfter = (phaseId: string): { label: string; run: () => void } => {
    const next = path ? resolveNextAction(path, { preferPhaseId: phaseId }) : null;
    if (next?.kind === "step" || next?.kind === "question") {
      const nextId = next.kind === "step" ? next.step.id : next.question.id;
      const item = phaseItems(next.phase).find((candidate) => candidate.id === nextId);
      return {
        label:
          next.phase.id !== phaseId
            ? `On to ${next.phase.title}`
            : next.kind === "question"
              ? "Next: a question"
              : "Next step",
        run: () => {
          if (item) openItem(item);
        },
      };
    }
    if (next?.kind === "choose") {
      return {
        label: "Choose your next phase",
        run: () => {
          setExpandedItemId(null);
          setGraphItemId(null);
          setGraphPhaseId(null);
          // The chooser lives in the list; from inside the graph there is nothing to scroll to.
          chooseViewMode("list");
          scrollToChooser();
        },
      };
    }
    return {
      label: "Back to your path",
      run: () => {
        setExpandedItemId(null);
        setGraphItemId(null);
      },
    };
  };

  const handleAnswered = async (
    question: OnboardingQuestionEndpoint,
    result: QuestionAttemptResult,
  ) => {
    // The backend decides completion; nothing here is derived from the phase alone.
    if (result.onboardingCompleted) {
      completeMission();
    } else if (result.correct) {
      // Celebrate the phase, not the question: only when this answer finished its last open item.
      const phase = phases.find((candidate) => candidate.id === question.phaseId);
      const allStepsDone = phase?.steps.every(
        (step) => step.status === "FINISHED" || step.status === "SKIPPED",
      );
      const allQuestionsPassed = phase?.questions.every(
        (candidate) => candidate.status === "PASSED" || candidate.id === question.id,
      );
      if (allStepsDone && allQuestionsPassed) {
        const done = (overall?.phasesDone ?? 0) + 1;
        celebrateMoment({
          tone: "milestone",
          title: "Phase completed",
          message: phase ? `You completed the ${phase.title} phase.` : "You completed the phase.",
          progress: { current: Math.min(done, phases.length), total: phases.length },
        });
      }
    }
    await refreshPath();
  };

  /** The item itself: a step to work through, a question to answer, or why it is not open yet. */
  const renderItemBody = (item: PhaseItem, layout: "inline" | "focus") => {
    const phase = phaseOf(item);
    if (!phase) return null;
    const state = itemState(item, phase.locked);
    const next = continueAfter(phase.id);

    if (state === "locked") {
      const blockers = waitingOn(item, phaseItems(phase));
      const phaseBlockers = phase.locked ? blockingPhases(phase, phases) : [];
      return (
        <div className="space-y-3 text-sm text-app-text-muted">
          {item.kind === "step" && item.step.description ? <p>{item.step.description}</p> : null}
          <p className="flex items-start gap-2 rounded-2xl border border-dashed border-app-border bg-app-surface-muted px-3 py-2.5">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {phaseBlockers.length > 0
              ? `Opens once ${phaseBlockers.map((blocker) => blocker.title).join(" and ")} ${phaseBlockers.length === 1 ? "is" : "are"} complete.`
              : blockers.length > 0
                ? `Opens once you have finished ${blockers.map((blocker) => blocker.title).join(" and ")}.`
                : "Not open yet."}
          </p>
        </div>
      );
    }

    if (item.kind === "question") {
      return (
        <QuestionWorkspace
          key={item.id}
          question={item.question}
          onAnswered={(result) => handleAnswered(item.question, result)}
          continueLabel={next.label}
          onContinue={next.run}
        />
      );
    }
    return (
      <StepWorkspace
        key={item.id}
        stepId={item.id}
        stepStatus={item.step.status}
        layout={layout}
        onPathChanged={refreshPath}
        onSkipAnswerSeen={acknowledgeSkipAnswer}
        continueLabel={next.label}
        onContinue={next.run}
      />
    );
  };

  const requestGeneration = () => {
    if (!selectedProjectId) return;
    setConfirmRegenerate(false);
    startGeneration(selectedProjectId);
  };

  const saveLayout = useMemo(
    () => ({
      phase: async (phaseId: string, nodes: { id: string; graphX: number; graphY: number }[]) => {
        await onboardingGraphService.arrangeMyPhase(phaseId, nodes);
        void refreshPath();
      },
      path: async (nodes: { id: string; graphX: number; graphY: number }[]) => {
        await onboardingGraphService.arrangeMyPath(nodes);
        void refreshPath();
      },
    }),
    [refreshPath],
  );

  // ── Render: generating ──────────────────────────────────────

  // A failed generation never keeps this screen up, game or not: its failure (the retry below, or
  // the toast beside an existing path) has to be what the member sees.
  if (
    generation.status === "running" ||
    (isDinoActiveInGeneration && generation.status !== "error")
  ) {
    const isRunning = generation.status === "running";
    const activePhases = isRunning ? generation.phases : lastGeneration.phases;
    const startedAt = isRunning ? generation.startedAt : lastGeneration.startedAt;

    return (
      <GenerationScreen
        phases={activePhases}
        startedAt={startedAt}
        isRunning={isRunning}
        // Only a finished generation may claim "Path ready" -- and keeps claiming it after the
        // page clears the `done` status, see `lastGeneration.completed`.
        isCompleted={!isRunning && (generation.status === "done" || lastGeneration.completed)}
        onGameActiveChange={setIsDinoActiveInGeneration}
      />
    );
  }

  // ── Render: loading ─────────────────────────────────────────

  if (loadingState === "loading" || (loadingState === "empty" && isProjectLoading)) {
    return (
      <CenteredState>
        <Loader2 className="h-8 w-8 animate-spin text-app-brand" aria-hidden="true" />
        <p className="mt-4 text-sm text-app-text-muted">Loading onboarding path...</p>
      </CenteredState>
    );
  }

  if (loadingState === "error") {
    return (
      <CenteredState>
        <StateIcon tone="danger">
          <AlertCircle className="h-7 w-7" />
        </StateIcon>
        <h2 className="mt-5 text-xl font-semibold text-app-text">Onboarding could not be loaded</h2>
        <p className="mt-2 max-w-md text-sm text-app-text-muted">{errorMessage}</p>
        <Button className="mt-6" variant="primary" onClick={() => window.location.reload()}>
          Try again
        </Button>
      </CenteredState>
    );
  }

  // ── Render: no path yet ─────────────────────────────────────

  if (loadingState === "empty" || !path) {
    return (
      <EmptyJourney
        hasProject={!!selectedProjectId}
        isSwitcherEnabled={isSwitcherEnabled}
        canManage={canManageSelected}
        unavailableReason={
          journey.availability === "unavailable" ? journey.unavailableReason : null
        }
        lastError={generation.status === "error" ? generation.message : null}
        failureReason={generation.status === "error" ? (generation.reason ?? null) : null}
        checking={journey.availability === "loading"}
        onStart={requestGeneration}
      />
    );
  }

  if (!selectedPhase) {
    return (
      <CenteredState>
        <StateIcon tone="warning">
          <AlertTriangle className="h-7 w-7" />
        </StateIcon>
        <h2 className="mt-5 text-xl font-semibold text-app-text">
          {generationIssues.length > 0
            ? "No onboarding phases were generated"
            : "No onboarding phases are available"}
        </h2>
        <p className="mt-2 mb-5 max-w-lg text-sm text-app-text-muted">
          {generationIssues.length > 0
            ? "Every phase in this blueprint is written by the AI service when your path is built, and none of them could be. Nothing has been left half-finished — the journey is simply empty until one of them lands."
            : "This onboarding path does not contain any phases for your current role and skills."}
        </p>
        {generationIssues.length > 0 ? (
          <div className="w-full max-w-lg">
            <GenerationIssueSummary issues={generationIssues} />
            {/* Retrying a phase that was skipped for lack of material changes nothing, so when that
                is all there is, the button says so rather than inviting the same answer. */}
            <p className="mt-5 text-xs text-app-text-subtle">
              {retryCouldHelp(generationIssues)
                ? "Trying again re-runs assembly for every phase."
                : "Another run will produce the same result until the project has more material."}
            </p>
          </div>
        ) : null}
        <Button
          className="mt-6"
          variant={
            generationIssues.length === 0 || retryCouldHelp(generationIssues)
              ? "primary"
              : "secondary"
          }
          onClick={requestGeneration}
          icon={<RefreshCw className="h-4 w-4" />}
          disabled={!selectedProjectId}
        >
          Try generation again
        </Button>
      </CenteredState>
    );
  }

  // ── Render: the journey ─────────────────────────────────────

  const isFinished = nextAction?.kind === "done";

  return (
    <div className="min-h-screen" ref={swipeRef}>
      <header className="border-b border-app-border bg-app-bg">
        <div className="app-page-frame py-6">
          <PageHeader
            icon={Rocket}
            title="Onboarding"
            subtitle={
              isFinished
                ? "You made it through every phase. Everything stays here to look back on."
                : "Your path into the project. Phases that are open can be done in any order."
            }
            actions={
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
                  onClick={() => setConfirmRegenerate(true)}
                  icon={<RefreshCw className="h-4 w-4" />}
                  aria-label="Regenerate path with AI"
                  title="Regenerate path with AI"
                  disabled={!selectedProjectId}
                >
                  Rebuild
                </Button>
              </>
            }
          />
        </div>
      </header>

      <main className="app-page-frame space-y-5 py-6 pb-24 lg:py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <SegmentedTabs
            layoutId="onboarding-view-mode"
            ariaLabel="Onboarding view"
            value={viewMode}
            onChange={chooseViewMode}
            options={[
              { value: "list", label: "List", icon: <ListChecks className="h-4 w-4" /> },
              { value: "graph", label: "Graph", icon: <GitBranch className="h-4 w-4" /> },
            ]}
          />
          {overall ? (
            <div className="flex items-center gap-3">
              <ProgressRing value={overall.percentage} size={44} stroke={4.5}>
                <span className="text-[11px] font-bold text-app-text tabular-nums">
                  {overall.percentage}%
                </span>
              </ProgressRing>
              <div className="text-sm leading-tight">
                <p className="font-semibold text-app-text tabular-nums">
                  {overall.phasesDone} of {phases.length} phases complete
                </p>
                <p className="text-xs text-app-text-muted tabular-nums">
                  {overall.stepsDone} {overall.stepsDone === 1 ? "step" : "steps"} done
                  {overall.phasesDone > 0 ? " — keep it up" : ""}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <SlidingTabPanel activeKey={viewMode} index={VIEW_ORDER.indexOf(viewMode)}>
          {viewMode === "list" ? (
            <div className="space-y-5">
              {nextAction?.kind === "choose" ? (
                <div id="phase-chooser">
                  <PhaseChooser
                    phases={nextAction.phases}
                    allPhases={phases}
                    onChoose={choosePhase}
                  />
                </div>
              ) : nextAction && (nextAction.kind === "step" || nextAction.kind === "question") ? (
                <UpNextCard
                  phase={nextAction.phase}
                  phaseIndex={phases.findIndex((phase) => phase.id === nextAction.phase.id)}
                  item={phaseItems(nextAction.phase).find((item) => item.id === nextItemId)}
                  onPrimary={openItem}
                  onShowPhase={() => selectPhase(nextAction.phase.id)}
                />
              ) : null}

              <div className="grid items-start gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
                <PhaseNavigator
                  phases={phases}
                  selectedPhaseId={selectedPhase.id}
                  focusPhaseId={focusPhaseId}
                  onSelect={selectPhase}
                  showUpdates
                  className="lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:max-h-[44rem]"
                />

                <section aria-labelledby="phase-title" className="min-w-0 space-y-4">
                  <PhaseHeaderCard
                    phase={selectedPhase}
                    phases={phases}
                    isFocus={selectedPhase.id === focusPhaseId}
                    onSelectPhase={selectPhase}
                  />
                  <PhaseItemList
                    phase={selectedPhase}
                    nextItemId={nextItemId}
                    expandedItemId={expandedItemId}
                    onToggle={toggleItem}
                    onPrimary={openItem}
                    renderExpanded={(item) => renderItemBody(item, "inline")}
                  />
                </section>
              </div>
            </div>
          ) : (
            <JourneyGraph
              phases={phases}
              openPhaseId={openGraphPhaseId}
              onOpenPhaseChange={(phaseId) => {
                setGraphPhaseId(phaseId);
                setGraphItemId(null);
                if (phaseId) selectPhase(phaseId);
              }}
              focusPhaseId={focusPhaseId}
              nextItemId={nextItemId}
              saveLayout={saveLayout}
              selectedItemId={null}
              onSelectItem={() => undefined}
              openItemId={graphItemId}
              onOpenItemChange={(itemId) => {
                setGraphItemId(itemId);
                const item = itemId
                  ? phases.flatMap(phaseItems).find((candidate) => candidate.id === itemId)
                  : undefined;
                // The answer, if there is one, is acknowledged by the workspace that draws it.
                if (item) void beginStepIfWaiting(item);
              }}
              renderItemFocus={(item) => renderItemBody(item, "focus")}
              showMemberUpdates
            />
          )}
        </SlidingTabPanel>
      </main>

      <AlertDialog
        isOpen={confirmRegenerate}
        title="Rebuild your onboarding path?"
        description="Your path is put together again from the project's current blueprint and knowledge base. Progress on the current path is replaced."
        confirmLabel="Rebuild path"
        variant="danger"
        onClose={() => setConfirmRegenerate(false)}
        onConfirm={() => {
          requestGeneration();
          toast.info("Rebuilding your onboarding path", {
            description: "This runs in the background; you can keep using the app.",
          });
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Pieces
// ─────────────────────────────────────────────────────────────

/** Loading, error and empty states: inside the page's own chrome, so the header never blinks away. */
function CenteredState({ children }: { children: ReactNode }) {
  return (
    <PageShell
      icon={Rocket}
      title="Onboarding"
      subtitle="Your path into the project. Phases that are open can be done in any order."
    >
      <div className="flex min-h-96 flex-col items-center justify-center py-12 text-center">
        {children}
      </div>
    </PageShell>
  );
}

function StateIcon({
  tone,
  children,
}: {
  tone: "brand" | "warning" | "danger";
  children: ReactNode;
}) {
  const toneClass =
    tone === "danger"
      ? "bg-app-danger-bg text-app-danger-text"
      : tone === "warning"
        ? "bg-app-warning-bg text-app-warning-text"
        : "bg-app-brand-soft text-app-brand-text";
  return (
    <span
      className={`flex h-16 w-16 items-center justify-center rounded-3xl ${toneClass}`}
      aria-hidden="true"
    >
      {children}
    </span>
  );
}

function PhaseLinks({
  label,
  phases,
  onSelect,
}: {
  label: string;
  phases: OnboardingPhaseEndpoint[];
  onSelect: (phaseId: string) => void;
}) {
  if (phases.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="text-app-text-subtle">{label}</span>
      {phases.map((phase) => (
        <button
          key={phase.id}
          type="button"
          onClick={() => onSelect(phase.id)}
          className="inline-flex items-center gap-1 rounded-full border border-app-border px-2.5 py-1 font-medium text-app-text-muted transition-colors hover:border-app-brand-border hover:text-app-text"
        >
          {phase.title}
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

/** The selected phase: what it is, how far along, and how it hangs together with the others. */
function PhaseHeaderCard({
  phase,
  phases,
  isFocus,
  onSelectPhase,
}: {
  phase: OnboardingPhaseEndpoint;
  phases: OnboardingPhaseEndpoint[];
  isFocus: boolean;
  onSelectPhase: (phaseId: string) => void;
}) {
  const state = phaseState(phase);
  const progress = phaseProgress(phase);
  const waitsOn = blockingPhases(phase, phases);
  const unlocks = phasesUnlockedBy(phase, phases);

  return (
    <div className="rounded-3xl border border-app-border bg-app-surface p-5">
      <p className="text-xs font-semibold tracking-wide text-app-text-subtle uppercase">
        Phase {phases.indexOf(phase) + 1} of {phases.length}
        {isFocus ? <span className="text-app-brand-text"> · You are here</span> : null}
      </p>
      <h2 id="phase-title" className="mt-1 text-xl font-semibold text-app-text">
        {phase.title}
      </h2>
      {phase.description ? (
        <p className="mt-1 max-w-3xl text-sm text-app-text-muted">{phase.description}</p>
      ) : null}
      <div className="mt-3 flex items-center gap-3">
        <div className="h-1.5 w-40 overflow-hidden rounded-full bg-app-border-muted">
          <div
            className="h-full rounded-full bg-gradient-to-r from-app-brand to-app-progress-fill-end transition-[width] duration-500"
            style={{ width: `${progress.percentage}%` }}
          />
        </div>
        <span className="text-xs text-app-text-muted tabular-nums">
          {progress.completed}/{progress.total} done
        </span>
      </div>

      {state === "locked" ? (
        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-dashed border-app-border bg-app-surface-muted px-3 py-2.5 text-sm text-app-text-muted">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Opens once {waitsOn.map((blocker) => blocker.title).join(" and ")}{" "}
            {waitsOn.length === 1 ? "is" : "are"} complete. You can look around already.
          </span>
        </div>
      ) : state === "done" ? (
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-app-success-border bg-app-success-bg px-3 py-2.5 text-sm text-app-success-text">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          Phase complete.
        </div>
      ) : null}

      {waitsOn.length > 0 || unlocks.length > 0 ? (
        <div className="mt-4 space-y-2 border-t border-app-border pt-3">
          <PhaseLinks label="Waits on" phases={waitsOn} onSelect={onSelectPhase} />
          <PhaseLinks label="Leads to" phases={unlocks} onSelect={onSelectPhase} />
        </div>
      ) : null}
    </div>
  );
}

/**
 * The one thing to do next, on top of everything else.
 */
function UpNextCard({
  phase,
  phaseIndex,
  item,
  onPrimary,
  onShowPhase,
}: {
  phase: OnboardingPhaseEndpoint;
  phaseIndex: number;
  item: PhaseItem | undefined;
  onPrimary: (item: PhaseItem) => void;
  onShowPhase: () => void;
}) {
  if (!item) return null;
  const state = itemState(item, phase.locked);
  const action = primaryActionLabel(item, state) ?? "Open";
  const isQuestion = item.kind === "question";

  return (
    <div className="relative overflow-hidden rounded-3xl border border-app-brand-border bg-app-surface">
      <div className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full bg-app-brand-soft blur-3xl" />
      <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-app-brand text-white shadow-[0_10px_30px_-10px_var(--color-app-brand)]">
            {isQuestion ? (
              <CircleHelp className="h-6 w-6" aria-hidden="true" />
            ) : (
              <PlayCircle className="h-6 w-6" aria-hidden="true" />
            )}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide text-app-brand-text uppercase">
              {state === "active" ? "In progress" : isQuestion ? "Knowledge question" : "Up next"} ·{" "}
              <button
                type="button"
                onClick={onShowPhase}
                className="uppercase underline-offset-2 hover:underline"
              >
                Phase {phaseIndex + 1}: {phase.title}
              </button>
            </p>
            <h2 className="mt-1 text-lg leading-snug font-bold text-app-text sm:text-xl">
              {isQuestion ? item.question.question : item.title}
            </h2>
            {item.kind === "step" && item.step.description ? (
              <p className="mt-1 line-clamp-2 max-w-3xl text-sm text-app-text-muted">
                {item.step.description}
              </p>
            ) : isQuestion ? (
              <p className="mt-1 text-sm text-app-text-muted">
                {state === "retry"
                  ? "You got this one wrong before — answer it correctly to move on."
                  : "Answer this question to move on in your onboarding."}
              </p>
            ) : null}
          </div>
        </div>
        <Button
          variant="primary"
          size="lg"
          className="shrink-0 self-start sm:self-center"
          onClick={() => onPrimary(item)}
          trailingIcon={<ChevronRight className="h-4 w-4" />}
        >
          {action === "Start" ? "Start now" : action === "Answer" ? "Answer now" : action}
        </Button>
      </div>
    </div>
  );
}

/**
 * No path yet: either a clear way to build one, or a clear reason there is none -- never a raw
 * error from a generation that could only fail.
 */
function EmptyJourney({
  hasProject,
  isSwitcherEnabled,
  canManage,
  unavailableReason,
  lastError,
  failureReason,
  checking,
  onStart,
}: {
  hasProject: boolean;
  isSwitcherEnabled: boolean;
  canManage: boolean;
  unavailableReason: UnavailableReason | null;
  lastError: string | null;
  /** Why the last generation came back without a path, when the backend could say. */
  failureReason: GenerationFailureReason | null;
  /** Whether a start could succeed is still being worked out. */
  checking: boolean;
  onStart: () => void;
}) {
  if (!hasProject || unavailableReason === "no-project") {
    return (
      <CenteredState>
        <StateIcon tone="warning">
          <FolderKanban className="h-7 w-7" />
        </StateIcon>
        <h2 className="mt-5 text-xl font-semibold text-app-text">No project selected</h2>
        <p className="mt-2 max-w-md text-sm text-app-text-muted">
          {isSwitcherEnabled
            ? "Select a project from the project switcher before creating your personalized onboarding path."
            : "You need to be assigned to a project before a personalized onboarding path can be created. Ask your project manager or administrator for access."}
        </p>
      </CenteredState>
    );
  }

  if (
    unavailableReason === "no-blueprint" ||
    unavailableReason === "several-blueprints" ||
    unavailableReason === "no-content"
  ) {
    const several = unavailableReason === "several-blueprints";
    const noBlueprint = unavailableReason === "no-blueprint" || several;
    return (
      <CenteredState>
        <StateIcon tone="brand">
          {noBlueprint ? <GitBranch className="h-7 w-7" /> : <BookOpen className="h-7 w-7" />}
        </StateIcon>
        <h2 className="mt-5 text-xl font-semibold text-app-text">
          {several
            ? "This project has more than one onboarding blueprint"
            : noBlueprint
              ? "Onboarding isn't set up for this project yet"
              : "There's nothing to learn from yet"}
        </h2>
        <p className="mt-2 max-w-md text-sm text-app-text-muted">
          {several
            ? "An onboarding path is built from one published blueprint, and this project has several — so it can't tell which to use."
            : noBlueprint
              ? "An onboarding path is built from the project's published blueprint, and this project doesn't have one."
              : "An onboarding path is built from the project's knowledge base, and nothing has been added to it yet."}{" "}
          {canManage
            ? ""
            : "Your project manager can set this up — your path will be ready to build afterwards."}
        </p>
        {canManage ? (
          <Link
            to={noBlueprint ? "/blueprints" : "/data-ingestion"}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-app-brand px-4 py-2 text-sm font-semibold text-white hover:bg-app-brand-hover"
          >
            {noBlueprint ? "Open blueprints" : "Add knowledge"}
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : null}
      </CenteredState>
    );
  }

  // The AI ran and found nothing in the project's knowledge to build a phase from. Usually that is
  // material that was just added and is still being processed; either way another start right now
  // would end the same, so it is not the button this page leads with.
  if (failureReason === "not-enough-knowledge") {
    return (
      <CenteredState>
        <StateIcon tone="warning">
          <BookOpen className="h-7 w-7" />
        </StateIcon>
        <h2 className="mt-5 text-xl font-semibold text-app-text">
          Not enough project knowledge yet
        </h2>
        <p className="mt-2 max-w-md text-sm text-app-text-muted">
          Your path is written from what the project’s knowledge base covers, and right now that is
          not enough for any phase. If documents were added just now, they may still be processed —
          give it a few minutes.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {canManage ? (
            <Link
              to="/data-ingestion"
              className="inline-flex items-center gap-2 rounded-xl bg-app-brand px-4 py-2 text-sm font-semibold text-white hover:bg-app-brand-hover"
            >
              Add knowledge
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : null}
          <Button variant="secondary" onClick={onStart} icon={<RefreshCw className="h-4 w-4" />}>
            Check again
          </Button>
        </div>
        {canManage ? null : (
          <p className="mt-4 max-w-md text-xs text-app-text-subtle">
            Your project manager can add documentation to the knowledge base.
          </p>
        )}
      </CenteredState>
    );
  }

  if (failureReason === "no-phases") {
    return (
      <CenteredState>
        <StateIcon tone="warning">
          <GitBranch className="h-7 w-7" />
        </StateIcon>
        <h2 className="mt-5 text-xl font-semibold text-app-text">
          The blueprint has nothing for your role yet
        </h2>
        <p className="mt-2 max-w-md text-sm text-app-text-muted">
          Every phase of this project’s blueprint is meant for other roles or skills. Your project
          manager can open a phase up for you.
        </p>
      </CenteredState>
    );
  }

  const unreachable = failureReason === "ai-unavailable";

  return (
    <CenteredState>
      <StateIcon tone={unreachable ? "warning" : "brand"}>
        {unreachable ? <AlertTriangle className="h-7 w-7" /> : <Sparkles className="h-7 w-7" />}
      </StateIcon>
      <h2 className="mt-5 text-2xl font-bold text-app-text">
        {unreachable ? "The onboarding service is not reachable" : "Build your onboarding path"}
      </h2>
      <p className="mt-2 max-w-md text-sm text-app-text-muted">
        {unreachable
          ? "Your path could not be put together because the AI service did not answer. Nothing was changed — try again in a moment."
          : "Your path is put together from your project’s blueprint and knowledge base: phases, steps and a few questions to check what stuck. It takes a few minutes and keeps running in the background."}
      </p>
      {lastError && !unreachable ? (
        <div
          role="alert"
          className="mt-5 flex max-w-md items-start gap-2 rounded-2xl border border-app-danger-border bg-app-danger-bg px-4 py-3 text-left text-sm text-app-danger-text"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {lastError}
        </div>
      ) : null}
      <Button
        className="mt-6"
        variant="primary"
        size="lg"
        onClick={onStart}
        loading={checking}
        disabled={checking}
        icon={<PlayCircle className="h-4 w-4" />}
      >
        {checking ? "Checking the project…" : lastError ? "Try again" : "Start personalization"}
      </Button>
    </CenteredState>
  );
}
