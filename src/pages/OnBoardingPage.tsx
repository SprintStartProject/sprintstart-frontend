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
import { useLocation, useParams } from "react-router-dom";
import { PageHeader } from "../components/layout/PageHeader";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { SegmentedTabs } from "../components/ui/SegmentedTabs";
import { SLIDING_PANEL_EXIT_MS, SlidingTabPanel } from "../components/ui/SlidingTabPanel";
import { useAuth } from "../context/useAuth";
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
import { useOnboardingJourney } from "../features/onboarding/generation/OnboardingJourneyContext";
import { ProgressRing } from "../features/onboarding/graph/JourneyNodeCards";
import { continueAfter } from "../features/onboarding/pageRules";
import { useOnboardingPlace } from "../features/onboarding/hooks/useOnboardingPlace";
import { useStepActions } from "../features/onboarding/hooks/useStepActions";
import { useArrival, useScrollToOpened } from "../features/onboarding/hooks/useArrival";
import { useGenerationScreen } from "../features/onboarding/hooks/useGenerationScreen";
import { useJourneyView, type ViewMode } from "../features/onboarding/hooks/useJourneyView";
import { usePathLoading } from "../features/onboarding/hooks/usePathLoading";
import { useGenerationFollowUp } from "../features/onboarding/hooks/useGenerationFollowUp";
import { usePathRevealMoment } from "../features/onboarding/hooks/usePathRevealMoment";
import {
  blockingPhases,
  itemState,
  pathProgress,
  phaseItems,
  sortedPhases,
  waitingOn,
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
import { GenerationIssueSummary } from "../features/onboarding/components/GenerationIssueSummary";
import { issueStatusLabel, retryCouldHelp } from "../features/onboarding/generationIssues";
import { hireJourneyViewKey } from "../features/onboarding/journeyViewMemory";

/** How a step came to be opened: by its address, or by the member on the page. */

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
  const generationIssueSummary = generationIssues
    .map((issue) => `${issue.title} — ${issueStatusLabel(issue.status)}`)
    .join("\n");

  const phaseOf = (item: PhaseItem) =>
    phases.find(
      (phase) => phase.id === (item.kind === "step" ? item.step.phaseId : item.question.phaseId),
    );

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

  /** Start, continue or answer: the item opens where it is -- unfolded in the list, or on the graph. */
  const openItem = (item: PhaseItem) => {
    const phase = phaseOf(item);
    if (phase) setSelectedPhaseId(phase.id);
    if (viewMode === "graph") {
      setGraphPhaseId(phase?.id ?? null);
      setGraphItemId(item.id);
    } else {
      scrollWhenOpened(item.id);
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
    clearLinkHighlight();
  };

  const choosePhase = (phaseId: string) => {
    setChosenPhaseId(phaseId);
    selectPhase(phaseId);
  };

  /** What "continue" does once an item in a phase is behind the member, and what its button says. */
  const continueFrom = (phaseId: string): { label: string; run: () => void } => {
    const step = continueAfter(path, phaseId);
    if (step.kind === "item") {
      return {
        label: step.label,
        run: () => {
          if (step.item) openItem(step.item);
        },
      };
    }
    if (step.kind === "choose") {
      return {
        label: step.label,
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
      label: step.label,
      run: () => {
        setExpandedItemId(null);
        setGraphItemId(null);
      },
    };
  };

  /** The item itself: a step to work through, a question to answer, or why it is not open yet. */
  const renderItemBody = (item: PhaseItem, layout: "inline" | "focus") => {
    const phase = phaseOf(item);
    if (!phase) return null;
    const state = itemState(item, phase.locked);
    const next = continueFrom(phase.id);

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
