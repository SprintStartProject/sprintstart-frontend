// ============================================================
// OnBoardingPage.tsx
// ============================================================

import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  ChevronRight,
  CircleHelp,
  Clock,
  Eye,
  FolderKanban,
  GitBranch,
  ListChecks,
  Loader2,
  PlayCircle,
  RefreshCw,
  Sparkles,
  Trophy,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AlertDialog } from "../components/ui/AlertDialog";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { SegmentedTabs } from "../components/ui/SegmentedTabs";
import { SlidingTabPanel } from "../components/ui/SlidingTabPanel";
import { useToast } from "../context/useToast";
import { useSwipeableTabs } from "../hooks/useHorizontalWheelNavigation";
import { findActivePhaseIndex } from "../features/onboarding/activePhase";
import { GenerationScreen } from "../features/onboarding/components/journey/GenerationScreen";
import { ItemAside } from "../features/onboarding/components/journey/ItemAside";
import {
  PathGraphExplorer,
  type GraphScope,
} from "../features/onboarding/components/journey/PathGraphExplorer";
import { PhaseItemList } from "../features/onboarding/components/journey/PhaseItemList";
import { primaryActionLabel } from "../features/onboarding/graph/nodeLabels";
import { PhaseRail } from "../features/onboarding/components/journey/PhaseRail";
import { QuestionModal } from "../features/onboarding/components/QuestionModal";
import { StepOriginBadge } from "../features/onboarding/components/StepOriginBadge";
import { useOnboardingJourney } from "../features/onboarding/generation/OnboardingJourneyContext";
import { ProgressRing } from "../features/onboarding/graph/JourneyNodeCards";
import { usePathRevealMoment } from "../features/onboarding/hooks/usePathRevealMoment";
import {
  formatMinutes,
  itemState,
  pathProgress,
  phaseItems,
  phaseProgress,
  sortedPhases,
  type PhaseItem,
} from "../features/onboarding/journey";
import { resolveNextAction } from "../features/onboarding/nextAction";
import type {
  OnboardingPathEndpoint,
  OnboardingPhaseEndpoint,
  OnboardingQuestionEndpoint,
} from "../features/onboarding/types";
import { useMoments } from "../features/moments";
import { useProjectContext } from "../features/projects/useProjectContext";
import { ApiError } from "../services/apiClient";
import { onboardingGraphService } from "../services/onboardingGraphService";
import { onboardingService } from "../services/onboardingService";

type LoadingState = "loading" | "empty" | "success" | "error";
type ViewMode = "list" | "graph";

const VIEW_ORDER: readonly ViewMode[] = ["list", "graph"];

/**
 * The hire's onboarding path.
 *
 * Laid out for paths with many phases: every phase in a rail on the left, the selected phase on the
 * right as a list or as its graph. The list and the graph are two readings of the same thing, so they
 * share one switch -- the app's sliding segmented control, also reachable with a two-finger swipe.
 *
 * Building a path is not this page's job any more: `OnboardingJourneyProvider` owns the generation,
 * so leaving the page no longer cancels it, and coming back shows its progress again.
 */
export function OnBoardingPage() {
  const navigate = useNavigate();
  const location = useLocation();
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

  const [path, setPath] = useState<OnboardingPathEndpoint | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedPhaseId, setSelectedPhaseId] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [graphScope, setGraphScope] = useState<GraphScope>("phase");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  // null follows the view: the graph wants the width, the list reads better beside the full rail.
  const [railCollapsed, setRailCollapsed] = useState<boolean | null>(null);
  const isRailCollapsed = railCollapsed ?? viewMode === "graph";
  const [questionToAnswer, setQuestionToAnswer] = useState<{
    question: OnboardingQuestionEndpoint;
    phaseTitle: string;
  } | null>(null);

  // Set by the step page when a knowledge-check question is what stands between the user and the
  // rest of their path, so this page can land on the question's phase.
  const focusQuestionId = (location.state as { focusQuestionId?: string } | null)?.focusQuestionId;

  usePathRevealMoment(loadingState === "success" ? path : null);

  const phases = useMemo(() => (path ? sortedPhases(path) : []), [path]);

  const applyPath = useCallback(
    (next: OnboardingPathEndpoint, { keepSelection }: { keepSelection: boolean }) => {
      setPath(next);
      setSelectedPhaseId((current) => {
        const ordered = sortedPhases(next);
        if (keepSelection && ordered.some((phase) => phase.id === current)) return current;
        const requested = focusQuestionId
          ? ordered.find((phase) =>
              phase.questions.some((question) => question.id === focusQuestionId),
            )
          : undefined;
        const active = ordered[findActivePhaseIndex({ ...next, phases: ordered })];
        return requested?.id ?? active?.id ?? "";
      });
      setLoadingState("success");
    },
    [focusQuestionId],
  );

  // ── Loading ─────────────────────────────────────────────────

  const hasLoadedRef = useRef(false);
  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    void (async () => {
      try {
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
    }
  }, [applyPath]);

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

  // Brings the question the user was sent for into view, once per visit.
  const hasFocusedQuestionRef = useRef(false);
  useEffect(() => {
    if (loadingState !== "success" || !focusQuestionId || hasFocusedQuestionRef.current) return;
    hasFocusedQuestionRef.current = true;
    document
      .querySelector(`[data-item-id="${focusQuestionId}"]`)
      ?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  }, [loadingState, focusQuestionId]);

  const swipeRef = useSwipeableTabs<ViewMode, HTMLDivElement>({
    order: VIEW_ORDER,
    value: viewMode,
    onChange: setViewMode,
    enabled: loadingState === "success" && !questionToAnswer,
  });

  // ── Derived ─────────────────────────────────────────────────

  const nextAction = useMemo(() => (path ? resolveNextAction(path) : null), [path]);
  const nextItemId =
    nextAction?.kind === "step"
      ? nextAction.step.id
      : nextAction?.kind === "question"
        ? nextAction.question.id
        : null;
  const currentPhaseId = nextAction && nextAction.kind !== "done" ? nextAction.phase.id : null;
  const selectedPhase = phases.find((phase) => phase.id === selectedPhaseId) ?? phases[0] ?? null;
  const selectedPhaseIndex = selectedPhase ? phases.indexOf(selectedPhase) : -1;
  const overall = path ? pathProgress(path) : null;
  const generationIssues = path?.generationIssues ?? [];
  const generationIssueSummary = generationIssues
    .map(
      (issue) =>
        `${issue.title} (${issue.status === "TIMED_OUT" ? "timed out" : issue.status.toLowerCase()})`,
    )
    .join(", ");

  // ── Actions ─────────────────────────────────────────────────

  const openStep = (stepId: string) => void navigate(`/onboarding/${stepId}`);

  const startStep = async (stepId: string) => {
    try {
      await onboardingService.startStep(stepId);
    } catch (error) {
      console.error("Failed to start onboarding step:", error);
    }
    // The rocket marks a step *beginning*; reopening a started step gets nothing.
    flyby();
    openStep(stepId);
  };

  const phaseOf = (item: PhaseItem) =>
    phases.find(
      (phase) => phase.id === (item.kind === "step" ? item.step.phaseId : item.question.phaseId),
    );

  const runPrimary = (item: PhaseItem) => {
    if (item.kind === "question") {
      setQuestionToAnswer({ question: item.question, phaseTitle: phaseOf(item)?.title ?? "" });
      return;
    }
    if (item.step.status === "IN_PROGRESS") openStep(item.step.id);
    else void startStep(item.step.id);
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
    const answeredQuestion = questionToAnswer;
    setQuestionToAnswer(null);

    // The backend decides completion; nothing here is derived from the phase alone.
    if (onboardingCompleted) {
      completeMission();
    } else if (correct && answeredQuestion) {
      // Celebrate the phase, not the question: only when this answer finished its last open item.
      const phase = phases.find((item) => item.id === answeredQuestion.question.phaseId);
      const phaseIndex = phases.findIndex((item) => item.id === answeredQuestion.question.phaseId);
      const allStepsDone = phase?.steps.every(
        (step) => step.status === "FINISHED" || step.status === "SKIPPED",
      );
      const allQuestionsPassed = phase?.questions.every(
        (question) => question.status === "PASSED" || question.id === answeredQuestion.question.id,
      );
      if (allStepsDone && allQuestionsPassed) {
        celebrateMoment({
          tone: "milestone",
          title: "Phase completed",
          message: phase ? `You completed the ${phase.title} phase.` : "You completed the phase.",
          progress: phaseIndex >= 0 ? { current: phaseIndex + 1, total: phases.length } : undefined,
        });
      }
    }
    if (answered) void refreshPath();
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

  if (generation.status === "running") {
    return <GenerationScreen phases={generation.phases} startedAt={generation.startedAt} />;
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
        <p className="mt-2 max-w-md text-sm text-app-text-muted">
          {generationIssues.length > 0
            ? "The generated phases were empty, could not be assembled, or timed out, so they have been left out of your journey."
            : "This onboarding path does not contain any phases for your current role and skills."}
        </p>
        {generationIssues.length > 0 ? (
          <p className="mt-2 max-w-md text-xs text-app-text-subtle">{generationIssueSummary}</p>
        ) : null}
        <Button
          className="mt-6"
          variant="primary"
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

  const phaseProgressValue = phaseProgress(selectedPhase);
  const selectedPhaseItems = phaseItems(selectedPhase);
  const openInPhase = selectedPhaseItems.filter((item) => {
    const state = itemState(item, selectedPhase.locked);
    return state === "open" || state === "active" || state === "retry";
  }).length;

  return (
    <div className="min-h-screen" ref={swipeRef}>
      {/* ── Hero ── */}
      <header className="border-b border-app-border bg-app-bg/90 backdrop-blur-xl">
        <div className="app-page-content flex flex-col gap-5 py-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-5">
            <ProgressRing value={overall?.percentage ?? 0} size={72} stroke={6}>
              <span className="text-lg font-bold text-app-text tabular-nums">
                {overall?.percentage ?? 0}%
              </span>
            </ProgressRing>
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-[0.14em] text-app-brand-text uppercase">
                Onboarding journey
              </p>
              <h1 className="mt-1 text-2xl font-bold text-app-text sm:text-3xl">
                {nextAction?.kind === "done" ? "You made it through" : "Your path into the project"}
              </h1>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-app-text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <ListChecks className="h-4 w-4" aria-hidden="true" />
                  {overall?.completed}/{overall?.total} items
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Trophy className="h-4 w-4" aria-hidden="true" />
                  {overall?.phasesDone}/{phases.length} phases
                </span>
                {overall && overall.remainingMinutes > 0 ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="h-4 w-4" aria-hidden="true" />~
                    {formatMinutes(overall.remainingMinutes)} left
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start lg:self-center">
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
              size="sm"
              onClick={() => setConfirmRegenerate(true)}
              icon={<RefreshCw className="h-4 w-4" />}
              aria-label="Regenerate path with AI"
              title="Regenerate path with AI"
              disabled={!selectedProjectId}
            >
              Rebuild
            </Button>
          </div>
        </div>
      </header>

      <main className="app-page-content space-y-6 py-6 pb-24">
        {nextAction && nextAction.kind !== "done" ? (
          <UpNextCard
            phase={nextAction.phase}
            phaseIndex={phases.findIndex((phase) => phase.id === nextAction.phase.id)}
            item={phaseItems(nextAction.phase).find((item) => item.id === nextItemId)}
            onPrimary={runPrimary}
          />
        ) : null}

        <div
          className={`grid items-start gap-6 transition-[grid-template-columns] duration-300 ${
            isRailCollapsed
              ? "lg:grid-cols-[4.25rem_minmax(0,1fr)]"
              : "lg:grid-cols-[18rem_minmax(0,1fr)]"
          }`}
        >
          <PhaseRail
            phases={phases}
            selectedPhaseId={selectedPhase.id}
            currentPhaseId={currentPhaseId}
            onSelect={(phaseId) => {
              setSelectedPhaseId(phaseId);
              setSelectedItemId(null);
            }}
            className="lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)]"
            collapsed={isRailCollapsed}
            onCollapsedChange={setRailCollapsed}
          />

          <section aria-labelledby="phase-title" className="min-w-0 space-y-4">
            <div className="flex flex-col gap-4 rounded-3xl border border-app-border bg-app-surface p-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold tracking-wide text-app-text-subtle uppercase">
                  Phase {selectedPhaseIndex + 1} of {phases.length}
                  {selectedPhase.locked
                    ? " · Locked"
                    : openInPhase > 0
                      ? ` · ${openInPhase} ready`
                      : ""}
                </p>
                <h2 id="phase-title" className="mt-1 text-xl font-semibold text-app-text">
                  {selectedPhase.title}
                </h2>
                {selectedPhase.description ? (
                  <p className="mt-1 max-w-2xl text-sm text-app-text-muted">
                    {selectedPhase.description}
                  </p>
                ) : null}
                <div className="mt-3 flex items-center gap-3">
                  <div className="h-1.5 w-40 overflow-hidden rounded-full bg-app-border-muted">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-app-brand to-app-progress-fill-end transition-[width] duration-500"
                      style={{ width: `${phaseProgressValue.percentage}%` }}
                    />
                  </div>
                  <span className="text-xs text-app-text-muted tabular-nums">
                    {phaseProgressValue.completed}/{phaseProgressValue.total} done
                  </span>
                </div>
              </div>
              <SegmentedTabs
                layoutId="onboarding-view-mode"
                ariaLabel="Onboarding view"
                value={viewMode}
                onChange={(mode) => {
                  setViewMode(mode);
                  setSelectedItemId(null);
                }}
                options={[
                  { value: "list", label: "List", icon: <ListChecks className="h-4 w-4" /> },
                  { value: "graph", label: "Graph", icon: <GitBranch className="h-4 w-4" /> },
                ]}
                className="shrink-0 self-start"
              />
            </div>

            {selectedPhase.locked ? (
              <div className="flex items-center gap-3 rounded-2xl border border-dashed border-app-border bg-app-surface-muted px-4 py-3 text-sm text-app-text-muted">
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                This phase opens once the phases before it are complete. You can look around
                already.
              </div>
            ) : null}

            <SlidingTabPanel activeKey={viewMode} index={VIEW_ORDER.indexOf(viewMode)}>
              {viewMode === "list" ? (
                <PhaseItemList
                  phase={selectedPhase}
                  nextItemId={nextItemId}
                  onPrimary={runPrimary}
                  onView={(item) => openStep(item.id)}
                />
              ) : (
                <PathGraphExplorer
                  phases={phases}
                  selectedPhaseId={selectedPhase.id}
                  onSelectPhase={(phaseId) => {
                    setSelectedPhaseId(phaseId);
                    setSelectedItemId(null);
                  }}
                  scope={graphScope}
                  onScopeChange={setGraphScope}
                  nextItemId={nextItemId}
                  currentPhaseId={currentPhaseId}
                  saveLayout={saveLayout}
                  selectedItemId={selectedItemId}
                  onSelectItem={setSelectedItemId}
                  onOpenItem={(item) => {
                    const state = itemState(item, selectedPhase.locked);
                    if (primaryActionLabel(item, state)) runPrimary(item);
                    else if (item.kind === "step" && state !== "locked") openStep(item.id);
                  }}
                  hint="Hover a node to trace what it needs and unlocks"
                  renderItemAside={(item, phase) => {
                    const state = itemState(item, phase.locked);
                    const action = primaryActionLabel(item, state);
                    return (
                      <ItemAside
                        item={item}
                        phase={phase}
                        onClose={() => setSelectedItemId(null)}
                        onSelect={setSelectedItemId}
                        actions={
                          <>
                            {action ? (
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => runPrimary(item)}
                                trailingIcon={<ChevronRight className="h-4 w-4" />}
                              >
                                {action}
                              </Button>
                            ) : null}
                            {item.kind === "step" && state !== "locked" ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => openStep(item.id)}
                                icon={<Eye className="h-4 w-4" />}
                              >
                                Open step
                              </Button>
                            ) : null}
                          </>
                        }
                      >
                        {item.kind === "step" ? <StepOriginBadge step={item.step} /> : null}
                      </ItemAside>
                    );
                  }}
                />
              )}
            </SlidingTabPanel>
          </section>
        </div>
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

      {questionToAnswer && (
        <QuestionModal
          question={questionToAnswer.question}
          phaseTitle={questionToAnswer.phaseTitle}
          onClose={closeQuestionModal}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Pieces
// ─────────────────────────────────────────────────────────────

function CenteredState({ children }: { children: ReactNode }) {
  return (
    <div className="app-page-content flex min-h-screen flex-col items-center justify-center py-12 text-center">
      {children}
    </div>
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

/**
 * The one thing to do next, on top of everything else.
 */
function UpNextCard({
  phase,
  phaseIndex,
  item,
  onPrimary,
}: {
  phase: OnboardingPhaseEndpoint;
  phaseIndex: number;
  item: PhaseItem | undefined;
  onPrimary: (item: PhaseItem) => void;
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
              {state === "active" ? "In progress" : isQuestion ? "Knowledge question" : "Up next"} ·
              Phase {phaseIndex + 1}: {phase.title}
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
  onStart,
}: {
  hasProject: boolean;
  isSwitcherEnabled: boolean;
  canManage: boolean;
  unavailableReason: "no-project" | "no-blueprint" | "no-content" | null;
  lastError: string | null;
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

  if (unavailableReason === "no-blueprint" || unavailableReason === "no-content") {
    const noBlueprint = unavailableReason === "no-blueprint";
    return (
      <CenteredState>
        <StateIcon tone="brand">
          {noBlueprint ? <GitBranch className="h-7 w-7" /> : <BookOpen className="h-7 w-7" />}
        </StateIcon>
        <h2 className="mt-5 text-xl font-semibold text-app-text">
          {noBlueprint
            ? "Onboarding isn't set up for this project yet"
            : "There's nothing to learn from yet"}
        </h2>
        <p className="mt-2 max-w-md text-sm text-app-text-muted">
          {noBlueprint
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

  return (
    <CenteredState>
      <StateIcon tone="brand">
        <Sparkles className="h-7 w-7" />
      </StateIcon>
      <h2 className="mt-5 text-2xl font-bold text-app-text">Build your onboarding path</h2>
      <p className="mt-2 max-w-md text-sm text-app-text-muted">
        Your path is put together from your project’s blueprint and knowledge base: phases, steps
        and a few questions to check what stuck. It takes a few minutes and keeps running in the
        background.
      </p>
      {lastError ? (
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
        icon={<PlayCircle className="h-4 w-4" />}
      >
        {lastError ? "Try again" : "Start personalization"}
      </Button>
    </CenteredState>
  );
}
