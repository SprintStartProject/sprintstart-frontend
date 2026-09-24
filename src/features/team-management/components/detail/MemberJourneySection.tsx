import {
  ClipboardCheck,
  Clock,
  GitBranch,
  ListChecks,
  Lock,
  ListPlus,
  Plus,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "../../../../components/ui/Button";
import { SegmentedTabs } from "../../../../components/ui/SegmentedTabs";
import { SlidingTabPanel } from "../../../../components/ui/SlidingTabPanel";
import { useSwipeableTabs } from "../../../../hooks/useHorizontalWheelNavigation";
import { useToast } from "../../../../context/useToast";
import { onboardingGraphService } from "../../../../services/onboardingGraphService";
import { useAuth } from "../../../../context/useAuth";
import { isSkipPending } from "../../../onboarding/journey";
import { computeRanks } from "../../../onboarding/graph/layout";
import {
  memberJourneyViewKey,
  readJourneyView,
  writeJourneyView,
} from "../../../onboarding/journeyViewMemory";
import { ItemAside } from "../../../onboarding/components/journey/ItemAside";
import {
  JourneyGraph,
  type GraphEditing,
} from "../../../onboarding/components/journey/JourneyGraph";
import { PhaseNavigator } from "../../../onboarding/components/journey/PhaseNavigator";
import { StepOriginBadge } from "../../../onboarding/components/StepOriginBadge";
import { ItemFlags, ItemGlyph, ItemKindIcon } from "../../../onboarding/graph/JourneyNodeCards";
import { itemKindLabel, itemStateLabel } from "../../../onboarding/graph/nodeLabels";
import {
  blockingPhases,
  formatMinutes,
  itemState,
  orderedPhaseItems,
  pathProgress,
  skipRequestOf,
  phaseItems,
  phaseProgress,
  phaseState,
  sortedPhases,
  unlockedBy,
  waitingOn,
  type PhaseItem,
} from "../../../onboarding/journey";
import { resolveNextAction } from "../../../onboarding/nextAction";
import type { OnboardingPathEndpoint, OnboardingPhaseEndpoint } from "../../../onboarding/types";
import type { OnboardingFeedback } from "../../../../services/teamManagementService";
import { FeedbackNote } from "./FeedbackNote";
import { SkipReview, type SkipReviewAction } from "./SkipReview";
import { StepQuickEdit } from "./StepQuickEdit";

type ViewMode = "list" | "graph";
const VIEW_ORDER: readonly ViewMode[] = ["list", "graph"];

type StepTaskCount = { total: number; done: number };

type Props = {
  userId: string;
  memberName: string;
  path: OnboardingPathEndpoint | null;
  stepTaskCounts: Record<string, StepTaskCount>;
  onOpenStep: (stepId: string) => void;
  onOpenQuestions: (phaseId: string, tab: "results" | "questions") => void;
  onDeleteStep: (stepId: string) => void;
  /** Answers a step's pending skip request. */
  onReviewSkip?: (skipId: string, action: SkipReviewAction, comment: string) => Promise<void>;
  /** The member's feedback, shown with the step it is about. */
  feedbackItems?: OnboardingFeedback[];
  onMarkFeedbackRead?: (feedbackId: string) => void;
  markingFeedbackId?: string | null;
  /** Re-reads the path after a change. */
  onPathChanged: () => Promise<void>;
};

const NEW_STEP_TITLE = "New step";

function actualMinutesOf(item: PhaseItem): number | null {
  if (item.kind !== "step" || !item.step.startedAt || !item.step.completedAt) return null;
  return Math.max(
    1,
    Math.round(
      (new Date(item.step.completedAt).getTime() - new Date(item.step.startedAt).getTime()) / 60000,
    ),
  );
}

/**
 * A member's onboarding path as their PM sees it -- and changes it.
 *
 * The same two readings as the member's own page, behind the same slider: a list to look through
 * phases and steps, and the zoomable graph. Changing the path happens in the graph only, because the
 * graph is what a change is made of: add a blank step, draw what it waits on and what it opens, name
 * it in the details beside it. With "Edit" on, nodes move and connections can be drawn and removed,
 * on the journey map as well as inside a phase. Every change is made on this member's copy only; the
 * blueprint is untouched.
 */
export function MemberJourneySection({
  userId,
  memberName,
  path,
  stepTaskCounts,
  onOpenStep,
  onOpenQuestions,
  onDeleteStep,
  onReviewSkip,
  feedbackItems = [],
  onMarkFeedbackRead,
  markingFeedbackId = null,
  onPathChanged,
}: Props) {
  const toast = useToast();
  // Who is looking. The remembered view is per manager as well as per member: browser storage is
  // per browser, so a key without this hands one manager's view to whoever signs in next.
  const viewerId = useAuth().profile?.id ?? "";
  const firstName = memberName.split(" ")[0] || "this member";
  const phases = useMemo(() => (path ? sortedPhases(path) : []), [path]);
  const nextAction = useMemo(() => (path ? resolveNextAction(path) : null), [path]);
  const focusPhaseId =
    nextAction?.kind === "step" || nextAction?.kind === "question" ? nextAction.phase.id : null;
  const nextItemId =
    nextAction?.kind === "step"
      ? nextAction.step.id
      : nextAction?.kind === "question"
        ? nextAction.question.id
        : null;

  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(
    () => readJourneyView(memberJourneyViewKey(viewerId, userId)).mode,
  );
  const [graphPhaseId, setGraphPhaseId] = useState<string | null>(
    () => readJourneyView(memberJourneyViewKey(viewerId, userId)).graphPhaseId,
  );
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [freshStepId, setFreshStepId] = useState<string | null>(null);

  // A remembered phase of another member's path is simply not there: that opens the map.
  const openGraphPhaseId = phases.some((candidate) => candidate.id === graphPhaseId)
    ? graphPhaseId
    : null;
  useEffect(() => {
    if (phases.length === 0 || !viewerId) return;
    writeJourneyView(memberJourneyViewKey(viewerId, userId), {
      mode: viewMode,
      graphPhaseId: openGraphPhaseId,
    });
  }, [openGraphPhaseId, phases.length, userId, viewerId, viewMode]);

  const swipeRef = useSwipeableTabs<ViewMode, HTMLElement>({
    order: VIEW_ORDER,
    value: viewMode,
    onChange: setViewMode,
    enabled: phases.length > 0,
  });

  const phase =
    phases.find((candidate) => candidate.id === selectedPhaseId) ??
    phases.find((candidate) => candidate.id === focusPhaseId) ??
    phases.find((candidate) => phaseState(candidate) !== "done") ??
    phases[0];

  // One step per gesture, across all five ways of asking for one. A double click created two,
  // wired into the member's live path with the same prerequisites -- both computed from the same
  // pre-refresh snapshot -- and only the second opened for naming, leaving the first as an unnamed
  // orphan to hunt down. The ref is the guard, the state is what the buttons read.
  const addingStep = useRef(false);
  const [isAddingStep, setIsAddingStep] = useState(false);

  /** A blank step the PM names next -- dropped on the graph, or put in between two list rows. */
  const createBlankStep = useCallback(
    async (
      target: OnboardingPhaseEndpoint,
      placement: {
        position: number;
        waitsOn: string[];
        unlocks: string[];
        graphX?: number;
        graphY?: number;
      },
    ) => {
      if (addingStep.current) return null;
      addingStep.current = true;
      setIsAddingStep(true);
      try {
        const created = await onboardingGraphService.createConnectedStep(target.id, {
          step: {
            position: Math.min(placement.position, target.steps.length),
            title: NEW_STEP_TITLE,
            description: "",
            type: "TASK",
            estimatedMinutes: 30,
            expectedOutcome: "",
          },
          waitsOn: placement.waitsOn,
          unlocks: placement.unlocks,
          graphX: placement.graphX,
          graphY: placement.graphY,
        });
        await onPathChanged();
        setFreshStepId(created.id);
        return created;
      } finally {
        addingStep.current = false;
        setIsAddingStep(false);
      }
    },
    [onPathChanged],
  );

  const addStepInList = async (target: OnboardingPhaseEndpoint, after: PhaseItem | null) => {
    const items = phaseItems(target);
    // After an item: in between it and what waited on it. At the end: after everything that nothing
    // else waits on, so it really comes last.
    const waitsOn = after
      ? [after.id]
      : items
          .filter((candidate) => !items.some((other) => other.blockerIds.includes(candidate.id)))
          .map((candidate) => candidate.id);
    const unlocks = after ? unlockedBy(after, items).map((dependent) => dependent.id) : [];
    try {
      await createBlankStep(target, {
        position: after?.kind === "step" ? after.step.position + 1 : target.steps.length,
        waitsOn,
        unlocks,
      });
    } catch (error) {
      toast.error("Couldn't add the step", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  // Blocker lists sent but not yet back in `phases`. The endpoints replace the whole list, so a
  // second edit to the same node computed from the stale snapshot would drop the first one.
  const pendingBlockers = useRef(new Map<string, string[]>());

  const rewire = useCallback(
    async (
      id: string,
      current: string[] | undefined,
      change: (blockers: string[]) => string[],
      save: (id: string, blockers: string[]) => Promise<unknown>,
    ) => {
      const before = pendingBlockers.current.get(id) ?? current ?? [];
      const next = change(before);
      if (next.length === before.length && next.every((blocker, i) => blocker === before[i])) {
        return;
      }
      pendingBlockers.current.set(id, next);
      try {
        await save(id, next);
        await onPathChanged();
      } finally {
        // Only this edit's own entry: a later edit to the same node has put its list there by now.
        if (pendingBlockers.current.get(id) === next) pendingBlockers.current.delete(id);
      }
    },
    [onPathChanged],
  );

  const editing = useMemo<GraphEditing>(
    () => ({
      connectItems: async (_phaseId, blockerId, nodeId) => {
        const node = phases.flatMap(phaseItems).find((item) => item.id === nodeId);
        if (!node) return;
        await rewire(
          nodeId,
          node.blockerIds,
          (blockers) => (blockers.includes(blockerId) ? blockers : [...blockers, blockerId]),
          (id, blockers) => onboardingGraphService.replaceNodeBlockers(id, blockers),
        );
      },
      disconnectItems: async (_phaseId, blockerId, nodeId) => {
        const node = phases.flatMap(phaseItems).find((item) => item.id === nodeId);
        if (!node) return;
        await rewire(
          nodeId,
          node.blockerIds,
          (blockers) => blockers.filter((id) => id !== blockerId),
          (id, blockers) => onboardingGraphService.replaceNodeBlockers(id, blockers),
        );
      },
      connectPhases: async (blockerId, phaseId) => {
        const target = phases.find((candidate) => candidate.id === phaseId);
        if (!target) return;
        await rewire(
          phaseId,
          target.blockerIds,
          (blockers) => (blockers.includes(blockerId) ? blockers : [...blockers, blockerId]),
          (id, blockers) => onboardingGraphService.replacePhaseBlockers(id, blockers),
        );
      },
      disconnectPhases: async (blockerId, phaseId) => {
        const target = phases.find((candidate) => candidate.id === phaseId);
        if (!target) return;
        await rewire(
          phaseId,
          target.blockerIds,
          (blockers) => blockers.filter((id) => id !== blockerId),
          (id, blockers) => onboardingGraphService.replacePhaseBlockers(id, blockers),
        );
      },
      addStep: async (phaseId, point) => {
        const target = phases.find((candidate) => candidate.id === phaseId);
        if (!target) return;
        // Connected to nothing: the PM draws its connections next.
        const created = await createBlankStep(target, {
          position: target.steps.length,
          waitsOn: [],
          unlocks: [],
          graphX: point.x,
          graphY: point.y,
        });
        if (created) setSelectedItemId(created.id);
      },
    }),
    [createBlankStep, phases, rewire],
  );

  const saveLayout = useMemo(
    () => ({
      phase: async (phaseId: string, nodes: { id: string; graphX: number; graphY: number }[]) => {
        await onboardingGraphService.arrangePhase(phaseId, nodes);
        await onPathChanged();
      },
      path: async (nodes: { id: string; graphX: number; graphY: number }[]) => {
        await onboardingGraphService.arrangeUserPath(userId, nodes);
        await onPathChanged();
      },
    }),
    [onPathChanged, userId],
  );

  const overall = path ? pathProgress(path) : null;
  const allSteps = phases.flatMap((candidate) => candidate.steps);
  const skipped = allSteps.filter((step) => step.status === "SKIPPED").length;
  // `accepted` is null while the PM has not answered yet.
  const pendingSkips = allSteps.filter(
    (step) => isSkipPending(step.skip) && step.status !== "SKIPPED",
  ).length;

  const questionTools = (target: OnboardingPhaseEndpoint) => (
    <>
      <Button
        size="sm"
        variant="secondary"
        icon={<ClipboardCheck className="h-3.5 w-3.5" />}
        onClick={() => onOpenQuestions(target.id, "results")}
      >
        Question results
      </Button>
      <Button size="sm" variant="ghost" onClick={() => onOpenQuestions(target.id, "questions")}>
        {(target.questions ?? []).length > 0 ? "Edit questions" : "Add questions"}
      </Button>
    </>
  );

  return (
    <section
      ref={swipeRef}
      aria-labelledby="member-journey-title"
      className="space-y-5 rounded-3xl border border-app-border bg-app-surface/60 p-4 shadow-sm sm:p-6"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 id="member-journey-title" className="text-xl font-semibold text-app-text">
            Onboarding path
          </h2>
          <p className="mt-1 text-sm text-app-text-muted">
            Changes apply to {firstName}’s copy only, never to the blueprint. Edit the path in the
            graph.
          </p>
        </div>
        {overall ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label="Items done" value={`${overall.completed}/${overall.total}`} />
            <Metric label="Phases" value={`${overall.phasesDone}/${phases.length}`} />
            <Metric label="Steps finished" value={String(overall.stepsDone)} />
            <Metric
              label={pendingSkips > 0 ? "Skip requests" : "Skipped"}
              value={String(pendingSkips > 0 ? pendingSkips : skipped)}
              warning={pendingSkips > 0}
            />
          </div>
        ) : null}
      </div>

      {!path || phases.length === 0 || !phase ? (
        <div className="rounded-3xl border border-dashed border-app-border bg-app-surface-muted px-4 py-10 text-center text-sm text-app-text-muted">
          {memberName.split(" ")[0] || "This member"} has no onboarding path yet. It appears here
          once they build it from the project’s blueprint.
        </div>
      ) : (
        <>
          <SegmentedTabs
            layoutId="member-journey-view-mode"
            ariaLabel="Member onboarding view"
            value={viewMode}
            onChange={(mode) => {
              setViewMode(mode);
              setSelectedItemId(null);
            }}
            options={[
              { value: "list", label: "List", icon: <ListChecks className="h-4 w-4" /> },
              { value: "graph", label: "Graph", icon: <GitBranch className="h-4 w-4" /> },
            ]}
          />

          <SlidingTabPanel activeKey={viewMode} index={VIEW_ORDER.indexOf(viewMode)}>
            {viewMode === "list" ? (
              <div className="grid items-start gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
                <PhaseNavigator
                  phases={phases}
                  selectedPhaseId={phase.id}
                  focusPhaseId={focusPhaseId}
                  onSelect={setSelectedPhaseId}
                  className="lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:max-h-[44rem]"
                />
                <div className="min-w-0 space-y-4">
                  <PhaseHeader
                    phase={phase}
                    phases={phases}
                    isFocus={phase.id === focusPhaseId}
                    firstName={firstName}
                    tools={
                      <>
                        <Button
                          size="sm"
                          variant="primary"
                          icon={<ListPlus className="h-4 w-4" />}
                          loading={isAddingStep}
                          disabled={isAddingStep}
                          onClick={() => void addStepInList(phase, null)}
                        >
                          Add step
                        </Button>
                        {questionTools(phase)}
                      </>
                    }
                  />
                  <MemberItemList
                    phase={phase}
                    nextItemId={nextItemId}
                    stepTaskCounts={stepTaskCounts}
                    onOpenItem={(item) =>
                      item.kind === "step"
                        ? onOpenStep(item.id)
                        : onOpenQuestions(phase.id, "results")
                    }
                    onAddAfter={(item) => void addStepInList(phase, item)}
                    freshStepId={freshStepId}
                    renderFreshStep={(item) =>
                      item.kind === "step" ? (
                        <StepQuickEdit
                          key={item.step.id}
                          step={item.step}
                          startEditing
                          onSaved={async () => {
                            setFreshStepId(null);
                            await onPathChanged();
                          }}
                        />
                      ) : null
                    }
                  />
                </div>
              </div>
            ) : (
              <JourneyGraph
                phases={phases}
                openPhaseId={openGraphPhaseId}
                onOpenPhaseChange={(phaseId) => {
                  setGraphPhaseId(phaseId);
                  if (phaseId) setSelectedPhaseId(phaseId);
                }}
                focusPhaseId={focusPhaseId}
                nextItemId={nextItemId}
                saveLayout={saveLayout}
                editing={editing}
                selectedItemId={selectedItemId}
                onSelectItem={(id) => {
                  setSelectedItemId(id);
                  if (id !== freshStepId) setFreshStepId(null);
                }}
                onOpenItem={(item) =>
                  item.kind === "step"
                    ? onOpenStep(item.id)
                    : onOpenQuestions(item.question.phaseId, "results")
                }
                renderItemAside={(item, asidePhase) => (
                  <ItemAside
                    key={item.id}
                    item={item}
                    phase={asidePhase}
                    onClose={() => setSelectedItemId(null)}
                    onSelect={setSelectedItemId}
                    actions={
                      <>
                        {item.kind === "step" ? (
                          <Button size="sm" variant="primary" onClick={() => onOpenStep(item.id)}>
                            Tasks & details
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => onOpenQuestions(asidePhase.id, "results")}
                          >
                            View attempts
                          </Button>
                        )}
                        {item.kind === "step" ? (
                          <Button
                            size="sm"
                            variant="dangerSoft"
                            icon={<Trash2 className="h-4 w-4" />}
                            onClick={() => onDeleteStep(item.id)}
                          >
                            Delete
                          </Button>
                        ) : null}
                      </>
                    }
                  >
                    {item.kind === "step" ? (
                      <>
                        <StepFacts item={item} taskCount={stepTaskCounts[item.id]} />
                        {onReviewSkip && skipRequestOf(item) === "pending" && item.step.skip?.id ? (
                          <SkipReview
                            key={item.step.skip.id}
                            reason={item.step.skip.reason}
                            onReview={(action, comment) =>
                              onReviewSkip(item.step.skip!.id, action, comment)
                            }
                          />
                        ) : null}
                        {feedbackItems
                          .filter((feedback) => feedback.stepId === item.id)
                          .map((feedback) => (
                            <FeedbackNote
                              key={feedback.id}
                              feedback={feedback}
                              marking={markingFeedbackId === feedback.id}
                              onMarkRead={onMarkFeedbackRead}
                            />
                          ))}
                        <StepQuickEdit
                          key={`${item.step.id}:${item.step.title}:${item.step.description}`}
                          step={item.step}
                          startEditing={item.id === freshStepId}
                          onSaved={async () => {
                            setFreshStepId(null);
                            await onPathChanged();
                          }}
                        />
                      </>
                    ) : null}
                  </ItemAside>
                )}
              />
            )}
          </SlidingTabPanel>
        </>
      )}
    </section>
  );
}

function Metric({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div
      className={`min-w-24 rounded-2xl border px-3 py-2 ${
        warning ? "border-app-warning-border bg-app-warning-bg" : "border-app-border bg-app-surface"
      }`}
    >
      <p className="text-[11px] text-app-text-muted">{label}</p>
      <p
        className={`mt-0.5 text-sm font-semibold tabular-nums ${warning ? "text-app-warning-text" : "text-app-text"}`}
      >
        {value}
      </p>
    </div>
  );
}

function PhaseHeader({
  phase,
  phases,
  isFocus,
  firstName,
  tools,
}: {
  phase: OnboardingPhaseEndpoint;
  phases: OnboardingPhaseEndpoint[];
  isFocus: boolean;
  firstName: string;
  tools: ReactNode;
}) {
  const progress = phaseProgress(phase);
  const questions = phase.questions ?? [];
  const passed = questions.filter((question) => question.status === "PASSED").length;
  const waitsOn = blockingPhases(phase, phases);

  return (
    <div className="rounded-3xl border border-app-border bg-app-surface p-4 sm:p-5">
      <p className="text-xs font-semibold tracking-wide text-app-text-subtle uppercase">
        Phase {phases.indexOf(phase) + 1} of {phases.length}
        {isFocus ? <span className="text-app-brand-text"> · {firstName} is here</span> : null}
      </p>
      <h3 className="mt-1 text-lg font-semibold text-app-text">{phase.title}</h3>
      {phase.description ? (
        <p className="mt-1 max-w-3xl text-sm text-app-text-muted">{phase.description}</p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-app-text-muted">
        <span className="inline-flex items-center gap-2">
          <span className="h-1.5 w-28 overflow-hidden rounded-full bg-app-border-muted">
            <span
              className="block h-full rounded-full bg-gradient-to-r from-app-brand to-app-progress-fill-end"
              style={{ width: `${progress.percentage}%` }}
            />
          </span>
          <span className="tabular-nums">
            {progress.completed}/{progress.total} done
          </span>
        </span>
        <span className="inline-flex items-center gap-1">
          <ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" />
          {questions.length === 0
            ? "No questions"
            : `${passed}/${questions.length} questions passed`}
        </span>
        {waitsOn.length > 0 ? (
          <span className="inline-flex items-center gap-1">
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            Opens for {firstName} after {waitsOn.map((blocker) => blocker.title).join(", ")}
          </span>
        ) : null}
      </div>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-app-border pt-4">{tools}</div>
    </div>
  );
}

function StepFacts({ item, taskCount }: { item: PhaseItem; taskCount?: StepTaskCount }) {
  if (item.kind !== "step") return null;
  const actual = actualMinutesOf(item);
  const delta = actual && item.step.estimatedMinutes ? actual - item.step.estimatedMinutes : null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <StepOriginBadge step={item.step} viewer="reviewer" />
      {taskCount ? (
        <span className="rounded-full bg-app-surface-muted px-2 py-0.5 text-app-text-muted">
          {taskCount.done}/{taskCount.total} tasks
        </span>
      ) : null}
      {actual ? (
        <span
          className={`rounded-full px-2 py-0.5 ${
            delta !== null && delta > 0
              ? "bg-app-warning-bg text-app-warning-text"
              : "bg-app-success-bg text-app-success-text"
          }`}
        >
          Took {formatMinutes(actual)}
          {delta ? ` (${delta > 0 ? "+" : "-"}${formatMinutes(Math.abs(delta))})` : ""}
        </span>
      ) : null}
      <ItemFlags item={item} inline />
    </div>
  );
}

/** Groups a phase's items into the rows of its graph: each stage opens once the ones above it are done. */
function stagesOf(phase: OnboardingPhaseEndpoint): PhaseItem[][] {
  const ranks = computeRanks(phaseItems(phase));
  const stages: PhaseItem[][] = [];
  orderedPhaseItems(phase).forEach((item) => {
    const rank = ranks.get(item.id) ?? 0;
    (stages[rank] ??= []).push(item);
  });
  return stages.filter(Boolean);
}

function MemberItemList({
  phase,
  nextItemId,
  stepTaskCounts,
  onOpenItem,
  onAddAfter,
  freshStepId,
  renderFreshStep,
}: {
  phase: OnboardingPhaseEndpoint;
  nextItemId: string | null;
  stepTaskCounts: Record<string, StepTaskCount>;
  onOpenItem: (item: PhaseItem) => void;
  /** Adds a blank step after an item, or at the end of the phase for null. */
  onAddAfter: (item: PhaseItem | null) => void;
  freshStepId: string | null;
  renderFreshStep: (item: PhaseItem) => ReactNode;
}) {
  const items = phaseItems(phase);
  const stages = stagesOf(phase);

  const addAtEnd = (
    <button
      type="button"
      onClick={() => onAddAfter(null)}
      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-app-border px-4 py-3 text-sm font-medium text-app-text-muted transition-colors hover:border-app-brand-border hover:bg-app-brand-soft/30 hover:text-app-brand-text"
    >
      <Plus className="h-4 w-4" aria-hidden="true" />
      {items.length === 0 ? "Add the first step" : "Add a step at the end"}
    </button>
  );

  if (items.length === 0) {
    return (
      <div className="space-y-3">
        <div className="rounded-3xl border border-dashed border-app-border bg-app-surface-muted px-6 py-10 text-center text-sm text-app-text-muted">
          This phase has no steps or questions yet.
        </div>
        {addAtEnd}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {stages.map((stage, stageIndex) => (
        <section
          key={stage[0].id}
          aria-label={`Stage ${stageIndex + 1}`}
          className="relative pl-5 before:absolute before:top-7 before:bottom-2 before:left-[7px] before:w-px before:bg-app-border"
        >
          <h4 className="relative mb-1.5 -ml-5 flex items-center gap-2 text-[11px] font-semibold tracking-wide text-app-text-subtle uppercase">
            <span className="flex h-[15px] w-[15px] items-center justify-center rounded-full border border-app-border bg-app-surface text-[9px] tabular-nums">
              {stageIndex + 1}
            </span>
            {stageIndex === 0 ? "First" : "Then"}
            {stage.length > 1 ? (
              <span className="font-normal tracking-normal normal-case">
                · {stage.length} in any order
              </span>
            ) : null}
          </h4>
          <ol className="space-y-1" aria-label={`${phase.title}, stage ${stageIndex + 1}`}>
            {stage.map((item) => (
              <MemberItemRow
                key={item.id}
                item={item}
                items={items}
                phase={phase}
                isNext={item.id === nextItemId}
                taskCount={stepTaskCounts[item.id]}
                onOpen={() => onOpenItem(item)}
                onAddAfter={() => onAddAfter(item)}
                fresh={item.id === freshStepId ? renderFreshStep(item) : null}
              />
            ))}
          </ol>
        </section>
      ))}
      {addAtEnd}
    </div>
  );
}

function MemberItemRow({
  item,
  items,
  phase,
  isNext,
  taskCount,
  onOpen,
  onAddAfter,
  fresh,
}: {
  item: PhaseItem;
  items: PhaseItem[];
  phase: OnboardingPhaseEndpoint;
  isNext: boolean;
  taskCount?: StepTaskCount;
  onOpen: () => void;
  onAddAfter: () => void;
  fresh: ReactNode;
}) {
  const state = itemState(item, phase.locked);
  const blockers = waitingOn(item, items);
  const allBlockers = items.filter((candidate) => item.blockerIds.includes(candidate.id));
  const leadsTo = unlockedBy(item, items);
  const isQuestion = item.kind === "question";

  return (
    <li className="group/item relative">
      <div
        className={`flex items-start gap-4 rounded-2xl border p-3 transition-colors ${
          fresh
            ? "border-app-brand-border bg-app-surface shadow-lg"
            : isQuestion
              ? isNext
                ? "border-app-question-solid bg-app-question-bg/60"
                : "border-app-question-border/60 bg-app-question-bg/30 hover:bg-app-question-bg/60"
              : isNext
                ? "border-app-brand bg-app-brand-soft/50"
                : "border-transparent hover:border-app-border hover:bg-app-surface"
        }`}
      >
        <span className="mt-0.5">
          <ItemGlyph item={item} state={state} />
        </span>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={onOpen}
            className="w-full rounded-lg text-left focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
          >
            <span className="flex flex-wrap items-center gap-2">
              {isNext ? (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase ${
                    isQuestion ? "bg-app-question-solid" : "bg-app-brand"
                  }`}
                >
                  Member is here
                </span>
              ) : null}
              <span
                className={`text-sm font-semibold ${
                  state === "done" || state === "skipped" ? "text-app-text-muted" : "text-app-text"
                }`}
              >
                {isQuestion ? item.question.question : item.title}
              </span>
            </span>
            <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-app-text-subtle">
              {isQuestion ? (
                <span className="rounded-full bg-app-question-solid/15 px-2 py-px font-semibold text-app-question-text">
                  Question · {itemKindLabel(item)}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <ItemKindIcon item={item} />
                  {itemKindLabel(item)}
                </span>
              )}
              {item.kind === "step" && item.step.estimatedMinutes ? (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  {formatMinutes(item.step.estimatedMinutes)}
                </span>
              ) : null}
              <span className="font-medium">{itemStateLabel[state]}</span>
            </span>
            {item.kind === "step" ? (
              <span className="mt-2 block">
                <StepFacts item={item} taskCount={taskCount} />
              </span>
            ) : null}
            {blockers.length > 0 && state === "locked" ? (
              <span className="mt-1.5 block text-xs text-app-text-muted">
                Waits on {blockers.map((blocker) => blocker.title).join(", ")}
              </span>
            ) : null}
          </button>
          {fresh ? (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-app-text-muted">
                {allBlockers.length > 0
                  ? `Opens after ${allBlockers.map((blocker) => blocker.title).join(", ")}`
                  : "Open from the start of the phase"}
                {leadsTo.length > 0
                  ? ` · leads to ${leadsTo.map((next) => next.title).join(", ")}`
                  : ""}
                . Connections can be changed in the graph.
              </p>
              {fresh}
            </div>
          ) : null}
        </div>
      </div>
      {/* In between this row and the next: where a new step goes. Visible on hover and focus, so the
          list stays calm while it is only being read. */}
      {/* Always there, quiet until pointed at: a small "+" on a dashed line, which names itself on
          hover. Hidden entirely it was too easy to miss that steps can be put in between. */}
      <div className="group/insert relative flex h-5 items-center justify-center">
        <span
          aria-hidden="true"
          className="absolute inset-x-10 top-1/2 border-t border-dashed border-app-border opacity-0 transition-opacity group-hover/insert:opacity-100"
        />
        <button
          type="button"
          onClick={onAddAfter}
          aria-label={`Add a step after ${item.title}`}
          title={`Add a step after ${item.title}`}
          className="relative z-10 inline-flex items-center gap-1 rounded-full border border-app-brand-border bg-app-surface px-1.5 py-0.5 text-[11px] font-semibold text-app-brand-text shadow-sm transition-all hover:bg-app-brand-soft hover:px-2.5 focus-visible:px-2.5"
        >
          <Plus className="h-3 w-3" aria-hidden="true" />
          <span className="hidden group-focus-within/insert:inline group-hover/insert:inline">
            Add step here
          </span>
        </button>
      </div>
    </li>
  );
}
