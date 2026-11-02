import { MainContent } from "../components/layout/MainContent";
import { useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { SlidingTabPanel } from "../components/ui/SlidingTabPanel";
import { useAuth } from "../context/useAuth";
import { useSwipeableTabs } from "../hooks/useHorizontalWheelNavigation";
import {
  LoadErrorScreen,
  LoadingScreen,
} from "../features/onboarding/components/journey/StatusScreens";
import { EmptyJourney } from "../features/onboarding/components/journey/EmptyJourney";
import { ItemBody } from "../features/onboarding/components/journey/ItemBody";
import {
  JourneyHeader,
  ViewToolbar,
} from "../features/onboarding/components/journey/JourneyHeader";
import { ListPanel } from "../features/onboarding/components/journey/ListPanel";
import { NoPhasesState } from "../features/onboarding/components/journey/NoPhasesState";
import { GenerationScreen } from "../features/onboarding/components/journey/GenerationScreen";
import { JourneyGraph } from "../features/onboarding/components/journey/JourneyGraph";
import { useOnboardingJourney } from "../features/onboarding/generation/OnboardingJourneyContext";
import { useOnboardingPlace } from "../features/onboarding/hooks/useOnboardingPlace";
import { useItemNavigation } from "../features/onboarding/hooks/useItemNavigation";
import { useStepActions } from "../features/onboarding/hooks/useStepActions";
import {
  useArrival,
  useScrollToChooser,
  useScrollToOpened,
} from "../features/onboarding/hooks/useArrival";
import { useGenerationScreen } from "../features/onboarding/hooks/useGenerationScreen";
import { useJourneyView, type ViewMode } from "../features/onboarding/hooks/useJourneyView";
import { usePathLoading } from "../features/onboarding/hooks/usePathLoading";
import { useGenerationFollowUp } from "../features/onboarding/hooks/useGenerationFollowUp";
import { usePathRevealMoment } from "../features/onboarding/hooks/usePathRevealMoment";
import {
  pathProgress,
  phaseItems,
  sortedPhases,
  type PhaseItem,
} from "../features/onboarding/journey";
import { resolveNextAction } from "../features/onboarding/nextAction";
import { useMoments } from "../features/moments";
import { useProjectContext } from "../features/projects/useProjectContext";
import { AskTheBuddy } from "../features/buddy/components/AskTheBuddy";
import { onBuddyPathChanged } from "../features/buddy/aiBuddyBus";
import {
  askAboutEmptyPhase,
  askAboutEmptyPhases,
  askAboutPhase,
} from "../features/onboarding/buddyDrafts";
import { onboardingGraphService } from "../services/onboardingGraphService";
import { hireJourneyViewKey } from "../features/onboarding/journeyViewMemory";

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
  // Whose remembered view this is. Browser storage is per browser, so without this two accounts
  // on one machine share the List/Graph mode and the phase the graph was left on. Empty only
  // before the profile is there, which `AuthGuard` does not render this page without -- the
  // fallbacks below keep that case from writing under the wrong key anyway.
  const viewerId = useAuth().profile?.id ?? "";
  const viewKey = viewerId ? hireJourneyViewKey(viewerId) : null;
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
  // The item unfolded in the list, and the one zoomed into on the graph.
  const [expandedItemId, setExpandedItemId] = useState<string | null>(focusItemId ?? null);
  const [graphItemId, setGraphItemId] = useState<string | null>(null);
  const scrollToChooser = useScrollToChooser();
  const {
    lastGeneration,
    isDinoActive: isDinoActiveInGeneration,
    setIsDinoActive: setIsDinoActiveInGeneration,
  } = useGenerationScreen(generation);
  const scrollWhenOpened = useScrollToOpened(
    focusItemId ?? null,
    expandedItemId,
    loadingState,
    selectedPhaseId,
  );

  usePathRevealMoment(loadingState === "success" ? path : null);

  const phases = useMemo(() => (path ? sortedPhases(path) : []), [path]);
  const { viewMode, chooseViewMode, showListByArrival, setGraphPhaseId, openGraphPhaseId } =
    useJourneyView({
      viewKey,
      arrivedForList: Boolean(
        routeStepId || navigationState?.focusQuestionId || navigationState?.choosePhase,
      ),
      openPhaseId,
      phases,
      loadingState,
    });

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

  useOnboardingPlace({
    viewMode,
    phases,
    selectedPhase,
    openGraphPhaseId,
    expandedItemId,
    graphItemId,
  });
  const overall = path ? pathProgress(path) : null;
  const generationIssues = path?.generationIssues ?? [];

  const { beginStepIfWaiting, acknowledgeSkipAnswer, handleAnswered } = useStepActions({
    phases,
    phasesDone: overall?.phasesDone ?? 0,
    setPath,
    refreshPath,
    moments: { celebrate: celebrateMoment, completeMission, flyby },
  });

  const { linkHighlight, clearLinkHighlight } = useArrival({
    path,
    loadingState,
    selectedPhaseId,
    viewMode,
    effects: {
      showListByArrival,
      setSelectedPhaseId,
      setExpandedItemId,
      setGraphItemId,
      scrollToChooser,
      scrollWhenOpened,
      startStep: (item) => void beginStepIfWaiting(item, { byAddress: true }),
    },
  });

  const { phaseOf, openItem, toggleItem, selectPhase, choosePhase, continueFrom } =
    useItemNavigation({
      path,
      phases,
      viewMode,
      expandedItemId,
      setExpandedItemId,
      setGraphItemId,
      setGraphPhaseId,
      setSelectedPhaseId,
      setChosenPhaseId,
      chooseViewMode,
      scrollToChooser,
      scrollWhenOpened,
      clearLinkHighlight,
      beginStepIfWaiting,
    });

  /** The item itself: a step to work through, a question to answer, or why it is not open yet. */
  const renderItemBody = (item: PhaseItem, layout: "inline" | "focus") => {
    const phase = phaseOf(item);
    if (!phase) return null;
    return (
      <ItemBody
        item={item}
        phase={phase}
        phases={phases}
        layout={layout}
        next={continueFrom(phase.id)}
        onAnswered={handleAnswered}
        onPathChanged={refreshPath}
        onSkipAnswerSeen={acknowledgeSkipAnswer}
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
    return <LoadingScreen />;
  }

  if (loadingState === "error") return <LoadErrorScreen message={errorMessage} />;

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
      <NoPhasesState
        issues={generationIssues}
        canManage={canManageSelected}
        hasProject={!!selectedProjectId}
        onStart={requestGeneration}
        buddy={
          <AskTheBuddy
            question={askAboutEmptyPhases(generationIssues.map((issue) => issue.title))}
            label="Work it out with your buddy instead"
          />
        }
      />
    );
  }

  return (
    <div className="min-h-screen" ref={swipeRef}>
      <JourneyHeader isFinished={nextAction?.kind === "done"} issues={generationIssues} />

      <MainContent className="app-page-frame space-y-5 py-6 pb-24 lg:py-8">
        <ViewToolbar
          viewMode={viewMode}
          onChange={chooseViewMode}
          overall={overall}
          phaseCount={phases.length}
        />

        <SlidingTabPanel activeKey={viewMode} index={VIEW_ORDER.indexOf(viewMode)}>
          {viewMode === "list" ? (
            <ListPanel
              phases={phases}
              selectedPhase={selectedPhase}
              nextAction={nextAction}
              nextItemId={nextItemId}
              focusPhaseId={focusPhaseId}
              expandedItemId={expandedItemId}
              linkedItemId={linkHighlight?.id ?? null}
              onLinkHighlightEnd={clearLinkHighlight}
              onChoosePhase={choosePhase}
              onSelectPhase={selectPhase}
              onToggle={toggleItem}
              onPrimary={openItem}
              renderExpanded={(item) => renderItemBody(item, "inline")}
              renderBuddy={(isEmpty) => (
                <AskTheBuddy
                  question={
                    isEmpty ? askAboutEmptyPhase(selectedPhase.title) : askAboutPhase(selectedPhase)
                  }
                  label={
                    isEmpty
                      ? "This phase is empty — talk it through with your buddy"
                      : "Ask your buddy about this phase"
                  }
                />
              )}
            />
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
