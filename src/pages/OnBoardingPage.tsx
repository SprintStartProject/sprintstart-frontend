import { MainContent } from "../components/layout/MainContent";
import {
  AlertCircle,
  AlertTriangle,
  GitBranch,
  ListChecks,
  Loader2,
  Lock,
  RefreshCw,
  Rocket,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/layout/PageHeader";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { SegmentedTabs } from "../components/ui/SegmentedTabs";
import { SLIDING_PANEL_EXIT_MS, SlidingTabPanel } from "../components/ui/SlidingTabPanel";
import { useAuth } from "../context/useAuth";
import { useToast } from "../context/useToast";
import { useSwipeableTabs } from "../hooks/useHorizontalWheelNavigation";
import { CenteredState, StateIcon } from "../features/onboarding/components/journey/CenteredState";
import { EmptyJourney } from "../features/onboarding/components/journey/EmptyJourney";
import { PhaseHeaderCard } from "../features/onboarding/components/journey/PhaseHeaderCard";
import { UpNextCard } from "../features/onboarding/components/journey/UpNextCard";
import { GenerationScreen } from "../features/onboarding/components/journey/GenerationScreen";
import { JourneyGraph } from "../features/onboarding/components/journey/JourneyGraph";
import { PhaseChooser } from "../features/onboarding/components/journey/PhaseChooser";
import { PhaseItemList } from "../features/onboarding/components/journey/PhaseItemList";
import { PhaseNavigator } from "../features/onboarding/components/journey/PhaseNavigator";
import { QuestionWorkspace } from "../features/onboarding/components/journey/QuestionWorkspace";
import { StepWorkspace } from "../features/onboarding/components/journey/StepWorkspace";
import {
  useOnboardingJourney,
  type GenerationPhaseProgress,
} from "../features/onboarding/generation/OnboardingJourneyContext";
import { ProgressRing } from "../features/onboarding/graph/JourneyNodeCards";
import { usePathLoading } from "../features/onboarding/hooks/usePathLoading";
import { useGenerationFollowUp } from "../features/onboarding/hooks/useGenerationFollowUp";
import { usePathRevealMoment } from "../features/onboarding/hooks/usePathRevealMoment";
import {
  blockingPhases,
  isSkipPending,
  itemState,
  pathProgress,
  phaseItems,
  linkedCardId,
  sortedPhases,
  waitingOn,
  type PhaseItem,
} from "../features/onboarding/journey";
import { resolveNextAction } from "../features/onboarding/nextAction";
import type {
  OnboardingQuestionEndpoint,
  QuestionAttemptResult,
} from "../features/onboarding/types";
import { useMoments } from "../features/moments";
import { useProjectContext } from "../features/projects/useProjectContext";
import { AskTheBuddy } from "../features/buddy/components/AskTheBuddy";
import { onBuddyPathChanged } from "../features/buddy/aiBuddyBus";
import { setOnboardingPlace } from "../features/onboarding/onboardingPlace";
import {
  askAboutEmptyPhase,
  askAboutEmptyPhases,
  askAboutPhase,
} from "../features/onboarding/buddyDrafts";
import { onboardingGraphService } from "../services/onboardingGraphService";
import { onboardingService } from "../services/onboardingService";
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

type ViewMode = "list" | "graph";

/** How a step came to be opened: by its address, or by the member on the page. */
type StartOptions = { byAddress?: boolean };

const VIEW_ORDER: readonly ViewMode[] = ["graph", "list"];

type NavigationState = {
  focusQuestionId?: string;
  choosePhase?: boolean;
  /** A phase to land on, set by anything that sends the member here pointing at one. */
  openPhaseId?: string;
} | null;

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
  /**
   * Where a link from the buddy points: `?step=<id>`, `?question=<id>` or `?phase=<id>`.
   *
   * The mentor is handed each item's link so it can write "you are on [#3](...)" and have that be
   * clickable. In the URL rather than in router state because the model writes it into text the hire
   * can copy, keep or open in a second tab, and state survives none of that.
   *
   * A link *lands* rather than starts: the phase opens, the page scrolls to the item and lights it up
   * briefly. Unlike `/onboarding/:stepId`, nothing is unfolded or started -- following a link in a
   * conversation is a way of finding something, and starting it is the hire's own click.
   */
  const [searchParams, setSearchParams] = useSearchParams();
  const linkedStepId = searchParams.get("step");
  // `&open=1` beside `?step=`: unfold the step as well as finding it -- still without starting it.
  // What a card's "Back to" on the board sends, since the words it was kept from are inside the step.
  const linkOpensStep = searchParams.get("open") === "1";
  const linkedQuestionId = searchParams.get("question");
  const linkedPhaseId = searchParams.get("phase");

  const {
    path,
    setPath,
    loadingState,
    errorMessage,
    selectedPhaseId,
    setSelectedPhaseId,
    applyPath,
    refreshPath,
  } = usePathLoading({ focusItemId, openPhaseId, subscribeToChanges: onBuddyPathChanged });
  useGenerationFollowUp({ generation, clearGeneration, path, loadingState, applyPath });
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
        : "graph",
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
  // The item a buddy link landed on, for as long as its light plays. `key` changes per arrival, so
  // following the same link again scrolls to it again. Cleared when the light has played or the
  // member moves to another phase, so neither the scroll nor the light comes back on its own later.
  const [linkHighlight, setLinkHighlight] = useState<{ id: string; key: string } | null>(null);
  const clearLinkHighlight = useCallback(() => setLinkHighlight(null), []);

  usePathRevealMoment(loadingState === "success" ? path : null);

  const phases = useMemo(() => (path ? sortedPhases(path) : []), [path]);

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
            : linkedStepId
              ? { kind: "link-step" as const, id: linkedStepId }
              : linkedQuestionId
                ? { kind: "link-question" as const, id: linkedQuestionId }
                : linkedPhaseId
                  ? { kind: "link-phase" as const, id: linkedPhaseId }
                  : null,
    [focusQuestionId, linkedPhaseId, linkedQuestionId, linkedStepId, routeStepId, wantsChooser],
  );
  // A link carries the navigation's key as well: the hire who scrolled away and clicks the same link
  // in the conversation again should land again.
  const arrivalKey = arrival
    ? `${arrival.kind}:${arrival.id}${arrival.kind.startsWith("link") ? `:${location.key}` : ""}`
    : "";
  const handledArrivalRef = useRef("");

  // Read by the arrival effect, which must not re-run every time one of these is recreated.
  const startStepRef = useRef<(item: PhaseItem, options: StartOptions) => void>(() => undefined);
  const scrollToChooserRef = useRef<() => void>(() => undefined);
  /**
   * Takes a handled link out of the address, so a reload or the hire's own next click decides what
   * they are looking at rather than the link lighting the same card up again.
   */
  const clearLinkRef = useRef<() => void>(() => undefined);

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

      // A link is followed in the list, so a step left open on the graph is let go of too --
      // otherwise swiping stayed off and the graph reopened it on the way back.
      if (arrival.kind.startsWith("link")) setGraphItemId(null);

      if (arrival.kind === "link-phase") {
        const linkedPhase = path.phases.find((phase) => phase.id === arrival.id);
        if (linkedPhase) {
          setSelectedPhaseId(arrival.id);
          // An item open in the linked phase stays open: it may hold a typed answer.
          setExpandedItemId((current) =>
            phaseItems(linkedPhase).some((item) => item.id === current) ? current : null,
          );
        } else {
          toast.error("That phase is not on your path", {
            description: "It may have been replaced when your path was rebuilt.",
          });
        }
        clearLinkRef.current();
        return;
      }

      const owningPhase = path.phases.find((phase) =>
        phaseItems(phase).some((item) => item.id === arrival.id),
      );
      if (!owningPhase) {
        toast.error(
          arrival.kind === "question" || arrival.kind === "link-question"
            ? "That question is not on your path"
            : "That step is not on your path",
          { description: "It may have been replaced when your path was rebuilt." },
        );
        // Only the step has an address of its own to go back from; a question arrives in router
        // state, which is dropped by navigating to the same place without it.
        void navigate("/onboarding", { replace: true, state: null });
        return;
      }

      if (arrival.kind === "link-step" || arrival.kind === "link-question") {
        setSelectedPhaseId(owningPhase.id);
        // "You're on #3" is most likely clicked while #3 is open -- collapsing it would throw away
        // a typed answer or skip reason. A link that asks for the step open unfolds it instead.
        if (arrival.kind === "link-step" && linkOpensStep) {
          scrollToItemRef.current = arrival.id;
          setExpandedItemId(arrival.id);
        } else {
          setExpandedItemId((current) => (current === arrival.id ? current : null));
        }
        setLinkHighlight({ id: arrival.id, key: arrivalKey });
        clearLinkRef.current();
        return;
      }

      setSelectedPhaseId(owningPhase.id);
      scrollToItemRef.current = arrival.id;
      setExpandedItemId(arrival.id);

      // A step opened by its address is started like one opened by a click -- including the
      // second link of a visit, which the load-time version could not see.
      const item = phaseItems(owningPhase).find((candidate) => candidate.id === arrival.id);
      if (item) startStepRef.current(item, { byAddress: true });
    });
  }, [arrival, arrivalKey, linkOpensStep, loadingState, navigate, path, setSelectedPhaseId, toast]);

  useEffect(() => {
    clearLinkRef.current = () =>
      setSearchParams(
        (params) => {
          params.delete("step");
          params.delete("question");
          params.delete("phase");
          params.delete("open");
          return params;
        },
        { replace: true },
      );
  }, [setSearchParams]);

  // Scrolls to the card a link landed on, once per link. A link followed from the graph switches to
  // the list, which `SlidingTabPanel` mounts only after the graph has slid out -- so a card that is
  // not there yet is looked for again once it can be, the same wait `scrollToChooser` makes.
  const scrolledLinkRef = useRef("");
  useEffect(() => {
    if (loadingState !== "success" || !linkHighlight) return;
    if (scrolledLinkRef.current === linkHighlight.key) return;
    const scroll = () => {
      const card = document.getElementById(linkedCardId(linkHighlight.id));
      if (!card) return false;
      scrolledLinkRef.current = linkHighlight.key;
      card.scrollIntoView?.({ behavior: "smooth", block: "center" });
      return true;
    };
    if (scroll()) return;
    const timer = window.setTimeout(scroll, SLIDING_PANEL_EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [linkHighlight, loadingState, selectedPhaseId, viewMode]);

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

  // Where the hire is on this page, for whatever they keep on their board from here: the step they
  // have open, or the phase they are looking at. See `onboardingPlace.ts`.
  useEffect(() => {
    const openItemId = viewMode === "graph" ? graphItemId : expandedItemId;
    const shownPhase =
      viewMode === "graph"
        ? (phases.find((phase) => phase.id === openGraphPhaseId) ?? null)
        : selectedPhase;
    const openItem = openItemId
      ? phases.flatMap(phaseItems).find((item) => item.id === openItemId)
      : undefined;
    // A question is not a place a note is kept *about*; its phase is.
    const itemPhase =
      openItem?.kind === "question"
        ? phases.find((phase) => phase.id === openItem.question.phaseId)
        : undefined;
    const phase = itemPhase ?? shownPhase;

    setOnboardingPlace(
      openItem?.kind === "step"
        ? { kind: "step", id: openItem.id, title: openItem.title }
        : phase
          ? { kind: "phase", id: phase.id, title: phase.title }
          : null,
    );
  }, [expandedItemId, graphItemId, openGraphPhaseId, phases, selectedPhase, viewMode]);

  useEffect(() => () => setOnboardingPlace(null), []);
  const overall = path ? pathProgress(path) : null;
  const generationIssues = path?.generationIssues ?? [];
  const generationIssueSummary = generationIssues
    .map((issue) => `${issue.title} — ${issueStatusLabel(issue.status)}`)
    .join("\n");

  const phaseOf = (item: PhaseItem) =>
    phases.find(
      (phase) => phase.id === (item.kind === "step" ? item.step.phaseId : item.question.phaseId),
    );

  /** A step the member opens for the first time is started; reopening one changes nothing. */
  const beginStepIfWaiting = async (item: PhaseItem, { byAddress = false }: StartOptions = {}) => {
    if (item.kind !== "step" || item.step.status !== "WAITING" || item.step.locked) return;
    // Arriving at `/onboarding/<id>` for a step with a skip request open is arriving to change or
    // withdraw it, not to begin the step; its own "Start step" button still does that. Only the
    // address: the list's button says "Start", and a click on it should do what it says.
    if (byAddress && isSkipPending(item.step.skip)) return;
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
    startStepRef.current = (item, options) => void beginStepIfWaiting(item, options);
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
    [setPath, toast],
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
    setLinkHighlight(null);
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
          phaseTitle={phase.title}
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
            {canManageSelected && (
              <p className="mt-5 text-xs text-app-text-subtle">
                {retryCouldHelp(generationIssues)
                  ? "Trying again re-runs assembly for every phase."
                  : "Another run will produce the same result until the project has more material."}
              </p>
            )}
          </div>
        ) : null}
        {/* Building an existing path again replaces it, which is the project manager's call: the
            backend refuses it to members, so they are pointed at the PM instead of a button that
            can only fail. */}
        {canManageSelected ? (
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
        ) : (
          <p className="mt-6 max-w-lg text-sm text-app-text-muted">
            Your project manager can rebuild your path from your page in the team area.
          </p>
        )}
        {/* Generating again is the wrong hope when the corpus is what was thin -- it comes back
            empty a second time. The conversation is the one thing here that can produce
            something, so it is offered beside the retry (or the pointer to the PM) rather than
            instead of it. */}
        {generationIssues.length > 0 ? (
          <AskTheBuddy
            question={askAboutEmptyPhases(generationIssues.map((issue) => issue.title))}
            label="Work it out with your buddy instead"
          />
        ) : null}
      </CenteredState>
    );
  }

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
            // Rebuilding a path throws the member's progress away, so it is the PM's call: it lives
            // on the member's page in the PM area, not here.
            actions={
              generationIssues.length > 0 && (
                <span
                  role="status"
                  aria-label={`${generationIssues.length} onboarding ${generationIssues.length === 1 ? "phase" : "phases"} could not be generated`}
                >
                  <Badge variant="warning" size="sm" title={generationIssueSummary}>
                    <AlertTriangle className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                    {generationIssues.length}
                  </Badge>
                </span>
              )
            }
          />
        </div>
      </header>

      <MainContent className="app-page-frame space-y-5 py-6 pb-24 lg:py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <SegmentedTabs
            layoutId="onboarding-view-mode"
            ariaLabel="Onboarding view"
            value={viewMode}
            onChange={chooseViewMode}
            options={[
              { value: "graph", label: "Graph", icon: <GitBranch className="h-4 w-4" /> },
              { value: "list", label: "List", icon: <ListChecks className="h-4 w-4" /> },
            ]}
          />
          {overall ? (
            <div className="flex items-center gap-3">
              <ProgressRing value={overall.percentage} size={44} stroke={4.5}>
                <span className="text-2xs font-bold text-app-text tabular-nums">
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
                    renderBuddy={(isEmpty) => (
                      <AskTheBuddy
                        question={
                          isEmpty
                            ? askAboutEmptyPhase(selectedPhase.title)
                            : askAboutPhase(selectedPhase)
                        }
                        label={
                          isEmpty
                            ? "This phase is empty — talk it through with your buddy"
                            : "Ask your buddy about this phase"
                        }
                      />
                    )}
                  />
                  <PhaseItemList
                    phase={selectedPhase}
                    nextItemId={nextItemId}
                    expandedItemId={expandedItemId}
                    linkedItemId={linkHighlight?.id ?? null}
                    onLinkHighlightEnd={clearLinkHighlight}
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
      </MainContent>
    </div>
  );
}
