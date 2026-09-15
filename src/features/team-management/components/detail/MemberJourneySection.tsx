import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  GitBranch,
  ListChecks,
  Lock,
  PenLine,
  PlayCircle,
  Plus,
  RotateCcw,
  SkipForward,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Button } from "../../../../components/ui/Button";
import { SegmentedTabs } from "../../../../components/ui/SegmentedTabs";
import { SlidingTabPanel } from "../../../../components/ui/SlidingTabPanel";
import { useSwipeableTabs } from "../../../../hooks/useHorizontalWheelNavigation";
import { onboardingGraphService } from "../../../../services/onboardingGraphService";
import { ItemAside } from "../../../onboarding/components/journey/ItemAside";
import {
  PathGraphExplorer,
  type GraphScope,
} from "../../../onboarding/components/journey/PathGraphExplorer";
import { PhaseRail } from "../../../onboarding/components/journey/PhaseRail";
import { StepOriginBadge } from "../../../onboarding/components/StepOriginBadge";
import { ItemKindIcon } from "../../../onboarding/graph/JourneyNodeCards";
import { itemKindLabel, itemStateLabel } from "../../../onboarding/graph/nodeLabels";
import type { GraphPoint } from "../../../onboarding/graph/layout";
import {
  formatMinutes,
  itemState,
  orderedPhaseItems,
  pathProgress,
  phaseItems,
  phaseProgress,
  sortedPhases,
  unlockedBy,
  waitingOn,
  type ItemState,
  type PhaseItem,
} from "../../../onboarding/journey";
import { resolveNextAction } from "../../../onboarding/nextAction";
import type { OnboardingPathEndpoint, OnboardingPhaseEndpoint } from "../../../onboarding/types";

type ViewMode = "list" | "graph";
const VIEW_ORDER: readonly ViewMode[] = ["list", "graph"];

/** Where a step the PM adds goes: its phase, what it opens after, what waits on it, where it sits. */
export type StepPlacementTarget = {
  phaseId: string;
  waitsOn: string[];
  unlocks: string[];
  graphX?: number;
  graphY?: number;
};

type StepTaskCount = { total: number; done: number };

type Props = {
  userId: string;
  memberName: string;
  path: OnboardingPathEndpoint | null;
  stepTaskCounts: Record<string, StepTaskCount>;
  onOpenStep: (stepId: string) => void;
  onOpenQuestions: (phaseId: string, tab: "results" | "questions") => void;
  onAddStep: (target: StepPlacementTarget) => void;
  onDeleteStep: (stepId: string) => void;
  /** Re-reads the path after a graph change. */
  onPathChanged: () => Promise<void>;
};

const markerTone: Record<ItemState, string> = {
  done: "border-app-success-border bg-app-success-bg text-app-success-text",
  skipped: "border-app-border bg-app-surface-muted text-app-text-muted",
  active: "border-app-brand bg-app-brand text-white",
  open: "border-app-brand-border bg-app-brand-soft text-app-brand-text",
  retry: "border-app-warning-border bg-app-warning-bg text-app-warning-text",
  locked: "border-dashed border-app-border bg-app-surface text-app-text-subtle",
};

const markerIcon: Record<ItemState, ReactNode> = {
  done: <CheckCircle2 className="h-4 w-4" />,
  skipped: <SkipForward className="h-4 w-4" />,
  active: <PlayCircle className="h-4 w-4" />,
  open: <Sparkles className="h-4 w-4" />,
  retry: <RotateCcw className="h-4 w-4" />,
  locked: <Lock className="h-3.5 w-3.5" />,
};

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
 * The same shape as the member's own page, so the two can be talked about side by side: every phase
 * in a rail, the selected phase as a list or as its graph. On top, the PM's tools. In the list: open
 * a step's details, add a step straight after any item, review or edit a phase's questions. In the
 * graph, with "Arrange" on: drag nodes, draw an edge from a node's port to what it should unlock,
 * select an edge to remove it, double click empty canvas to add a step exactly there. Every change is
 * made on this member's copy only; the blueprint is untouched.
 */
export function MemberJourneySection({
  userId,
  memberName,
  path,
  stepTaskCounts,
  onOpenStep,
  onOpenQuestions,
  onAddStep,
  onDeleteStep,
  onPathChanged,
}: Props) {
  const phases = useMemo(() => (path ? sortedPhases(path) : []), [path]);
  const nextAction = useMemo(() => (path ? resolveNextAction(path) : null), [path]);
  const currentPhaseId = nextAction && nextAction.kind !== "done" ? nextAction.phase.id : null;
  const nextItemId =
    nextAction?.kind === "step"
      ? nextAction.step.id
      : nextAction?.kind === "question"
        ? nextAction.question.id
        : null;

  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [graphScope, setGraphScope] = useState<GraphScope>("phase");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [railCollapsed, setRailCollapsed] = useState<boolean | null>(null);
  const isRailCollapsed = railCollapsed ?? viewMode === "graph";

  const swipeRef = useSwipeableTabs<ViewMode, HTMLElement>({
    order: VIEW_ORDER,
    value: viewMode,
    onChange: setViewMode,
    enabled: phases.length > 0,
  });

  const phase =
    phases.find((candidate) => candidate.id === selectedPhaseId) ??
    phases.find((candidate) => candidate.id === currentPhaseId) ??
    phases[0];

  const editing = useMemo(
    () => ({
      connectItems: async (_phaseId: string, blockerId: string, nodeId: string) => {
        const node = phases.flatMap(phaseItems).find((item) => item.id === nodeId);
        if (!node || node.blockerIds.includes(blockerId)) return;
        await onboardingGraphService.replaceNodeBlockers(nodeId, [...node.blockerIds, blockerId]);
        await onPathChanged();
      },
      disconnectItems: async (_phaseId: string, blockerId: string, nodeId: string) => {
        const node = phases.flatMap(phaseItems).find((item) => item.id === nodeId);
        if (!node) return;
        await onboardingGraphService.replaceNodeBlockers(
          nodeId,
          node.blockerIds.filter((id) => id !== blockerId),
        );
        await onPathChanged();
      },
      connectPhases: async (blockerId: string, phaseId: string) => {
        const target = phases.find((candidate) => candidate.id === phaseId);
        const blockers = target?.blockerIds ?? [];
        if (!target || blockers.includes(blockerId)) return;
        await onboardingGraphService.replacePhaseBlockers(phaseId, [...blockers, blockerId]);
        await onPathChanged();
      },
      disconnectPhases: async (blockerId: string, phaseId: string) => {
        const target = phases.find((candidate) => candidate.id === phaseId);
        if (!target) return;
        await onboardingGraphService.replacePhaseBlockers(
          phaseId,
          (target.blockerIds ?? []).filter((id) => id !== blockerId),
        );
        await onPathChanged();
      },
      addStepAt: (phaseId: string, point: GraphPoint) =>
        onAddStep({ phaseId, waitsOn: [], unlocks: [], graphX: point.x, graphY: point.y }),
    }),
    [onAddStep, onPathChanged, phases],
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

  const addAfter = (item: PhaseItem, items: PhaseItem[]) => {
    if (!phase) return;
    onAddStep({
      phaseId: phase.id,
      waitsOn: [item.id],
      unlocks: unlockedBy(item, items).map((dependent) => dependent.id),
    });
  };

  const overall = path ? pathProgress(path) : null;
  const allSteps = phases.flatMap((candidate) => candidate.steps);
  const skipped = allSteps.filter((step) => step.status === "SKIPPED").length;
  const pendingSkips = allSteps.filter(
    (step) => (step.skip as { status?: string } | null)?.status === "PENDING",
  ).length;

  return (
    <section
      ref={swipeRef}
      aria-labelledby="member-journey-title"
      className="rounded-3xl border border-app-border bg-app-surface/60 p-4 sm:p-6"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-app-brand-text uppercase">
            Onboarding journey
          </p>
          <h2 id="member-journey-title" className="mt-1 text-xl font-semibold text-app-text">
            {memberName}’s path
          </h2>
          <p className="mt-1 text-sm text-app-text-muted">
            Changes here apply to {memberName.split(" ")[0] || "this member"}’s copy only, never to
            the blueprint.
          </p>
        </div>
        {overall ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label="Done" value={`${overall.completed}/${overall.total}`} />
            <Metric label="Phases" value={`${overall.phasesDone}/${phases.length}`} />
            <Metric label="Remaining" value={formatMinutes(overall.remainingMinutes)} />
            <Metric
              label={pendingSkips > 0 ? "Skip requests" : "Skipped"}
              value={String(pendingSkips > 0 ? pendingSkips : skipped)}
              warning={pendingSkips > 0}
            />
          </div>
        ) : null}
      </div>

      {!path || phases.length === 0 || !phase ? (
        <div className="mt-6 rounded-2xl border border-dashed border-app-border bg-app-surface-muted px-4 py-10 text-center text-sm text-app-text-muted">
          {memberName.split(" ")[0] || "This member"} has no onboarding path yet. It appears here
          once they build it from the project’s blueprint.
        </div>
      ) : (
        <div
          className={`mt-6 grid items-start gap-5 ${
            isRailCollapsed
              ? "lg:grid-cols-[4.25rem_minmax(0,1fr)]"
              : "lg:grid-cols-[17rem_minmax(0,1fr)]"
          }`}
        >
          <PhaseRail
            phases={phases}
            selectedPhaseId={phase.id}
            currentPhaseId={currentPhaseId}
            onSelect={(phaseId) => {
              setSelectedPhaseId(phaseId);
              setSelectedItemId(null);
            }}
            collapsed={isRailCollapsed}
            onCollapsedChange={setRailCollapsed}
            className="lg:sticky lg:top-6 lg:h-[min(44rem,calc(100vh-3rem))]"
          />

          <div className="min-w-0 space-y-4">
            <PhaseHeader
              phase={phase}
              index={phases.indexOf(phase)}
              total={phases.length}
              viewMode={viewMode}
              onViewModeChange={(mode) => {
                setViewMode(mode);
                setSelectedItemId(null);
              }}
              onAddStep={() => onAddStep({ phaseId: phase.id, waitsOn: [], unlocks: [] })}
              onOpenQuestions={(tab) => onOpenQuestions(phase.id, tab)}
            />

            <SlidingTabPanel activeKey={viewMode} index={VIEW_ORDER.indexOf(viewMode)}>
              {viewMode === "list" ? (
                <MemberItemList
                  phase={phase}
                  nextItemId={nextItemId}
                  stepTaskCounts={stepTaskCounts}
                  onOpenItem={(item) =>
                    item.kind === "step"
                      ? onOpenStep(item.id)
                      : onOpenQuestions(phase.id, "results")
                  }
                  onAddAfter={addAfter}
                />
              ) : (
                <PathGraphExplorer
                  phases={phases}
                  selectedPhaseId={phase.id}
                  onSelectPhase={(phaseId) => {
                    setSelectedPhaseId(phaseId);
                    setSelectedItemId(null);
                  }}
                  scope={graphScope}
                  onScopeChange={setGraphScope}
                  nextItemId={nextItemId}
                  currentPhaseId={currentPhaseId}
                  saveLayout={saveLayout}
                  editing={editing}
                  selectedItemId={selectedItemId}
                  onSelectItem={setSelectedItemId}
                  onOpenItem={(item) =>
                    item.kind === "step"
                      ? onOpenStep(item.id)
                      : onOpenQuestions(phase.id, "results")
                  }
                  heightClassName="h-[min(44rem,75vh)]"
                  hint={
                    <>
                      <PenLine className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
                      Arrange to move nodes and drag from a node’s port to connect. Double click to
                      add a step.
                    </>
                  }
                  renderItemAside={(item, asidePhase) => {
                    const items = phaseItems(asidePhase);
                    return (
                      <ItemAside
                        item={item}
                        phase={asidePhase}
                        onClose={() => setSelectedItemId(null)}
                        onSelect={setSelectedItemId}
                        actions={
                          <>
                            {item.kind === "step" ? (
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => onOpenStep(item.id)}
                              >
                                Details & tasks
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
                            <Button
                              size="sm"
                              variant="secondary"
                              icon={<Plus className="h-4 w-4" />}
                              onClick={() => addAfter(item, items)}
                            >
                              Add step after
                            </Button>
                            {item.kind === "step" ? (
                              <Button
                                size="sm"
                                variant="dangerSoft"
                                iconOnly
                                aria-label={`Delete ${item.title}`}
                                onClick={() => onDeleteStep(item.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            ) : null}
                          </>
                        }
                      >
                        {item.kind === "step" ? (
                          <StepFacts item={item} taskCount={stepTaskCounts[item.id]} />
                        ) : null}
                      </ItemAside>
                    );
                  }}
                />
              )}
            </SlidingTabPanel>
          </div>
        </div>
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
  index,
  total,
  viewMode,
  onViewModeChange,
  onAddStep,
  onOpenQuestions,
}: {
  phase: OnboardingPhaseEndpoint;
  index: number;
  total: number;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onAddStep: () => void;
  onOpenQuestions: (tab: "results" | "questions") => void;
}) {
  const progress = phaseProgress(phase);
  const questions = phase.questions ?? [];
  const passed = questions.filter((question) => question.status === "PASSED").length;

  return (
    <div className="rounded-3xl border border-app-border bg-app-surface p-4 sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-app-text-subtle uppercase">
            Phase {index + 1} of {total}
            {phase.locked ? " · Locked for the member" : ""}
          </p>
          <h3 className="mt-1 text-lg font-semibold text-app-text">{phase.title}</h3>
          {phase.description ? (
            <p className="mt-1 max-w-2xl text-sm text-app-text-muted">{phase.description}</p>
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
          </div>
        </div>
        <SegmentedTabs
          layoutId="member-journey-view-mode"
          ariaLabel="Member onboarding view"
          value={viewMode}
          onChange={onViewModeChange}
          options={[
            { value: "list", label: "List", icon: <ListChecks className="h-4 w-4" /> },
            { value: "graph", label: "Graph", icon: <GitBranch className="h-4 w-4" /> },
          ]}
          className="shrink-0 self-start"
        />
      </div>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-app-border pt-4">
        <Button size="sm" variant="primary" icon={<Plus className="h-4 w-4" />} onClick={onAddStep}>
          Add step
        </Button>
        <Button size="sm" variant="secondary" onClick={() => onOpenQuestions("results")}>
          Question results
        </Button>
        <Button size="sm" variant="secondary" onClick={() => onOpenQuestions("questions")}>
          {questions.length > 0 ? "Edit questions" : "Add questions"}
        </Button>
      </div>
    </div>
  );
}

function StepFacts({ item, taskCount }: { item: PhaseItem; taskCount?: StepTaskCount }) {
  if (item.kind !== "step") return null;
  const actual = actualMinutesOf(item);
  const delta = actual && item.step.estimatedMinutes ? actual - item.step.estimatedMinutes : null;
  const skip = item.step.skip as { status?: string; reason?: string } | null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <StepOriginBadge step={item.step} />
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
      {skip?.reason ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-app-warning-border bg-app-warning-bg px-2 py-0.5 font-medium text-app-warning-text">
          <AlertTriangle className="h-3 w-3" aria-hidden="true" />
          {item.step.status === "SKIPPED" ? "Skipped" : "Skip requested"}
        </span>
      ) : null}
    </div>
  );
}

function MemberItemList({
  phase,
  nextItemId,
  stepTaskCounts,
  onOpenItem,
  onAddAfter,
}: {
  phase: OnboardingPhaseEndpoint;
  nextItemId: string | null;
  stepTaskCounts: Record<string, StepTaskCount>;
  onOpenItem: (item: PhaseItem) => void;
  onAddAfter: (item: PhaseItem, items: PhaseItem[]) => void;
}) {
  const items = orderedPhaseItems(phase);

  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-app-border bg-app-surface-muted px-6 py-10 text-center text-sm text-app-text-muted">
        This phase has no steps or questions yet. Add a step to give it one.
      </div>
    );
  }

  return (
    <ol className="relative space-y-1.5" aria-label={`${phase.title}: steps and questions`}>
      <span aria-hidden="true" className="absolute top-6 bottom-6 left-[27px] w-px bg-app-border" />
      {items.map((item) => {
        const state = itemState(item, phase.locked);
        const isNext = item.id === nextItemId;
        const blockers = state === "locked" ? waitingOn(item, items) : [];
        return (
          <li key={item.id} className="group/item relative">
            <div
              className={`flex items-start gap-4 rounded-2xl border p-3 transition-colors ${
                isNext
                  ? "border-app-brand bg-app-brand-soft/50"
                  : "border-transparent hover:border-app-border hover:bg-app-surface"
              }`}
            >
              <span
                aria-hidden="true"
                className={`relative z-10 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${markerTone[state]}`}
              >
                {markerIcon[state]}
              </span>
              <button
                type="button"
                onClick={() => onOpenItem(item)}
                className="min-w-0 flex-1 rounded-lg text-left focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
              >
                <span className="flex flex-wrap items-center gap-2">
                  {isNext ? (
                    <span className="rounded-full bg-app-brand px-2 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase">
                      Member is here
                    </span>
                  ) : null}
                  <span
                    className={`text-sm font-semibold ${
                      state === "done" || state === "skipped"
                        ? "text-app-text-muted"
                        : "text-app-text"
                    }`}
                  >
                    {item.kind === "question" ? item.question.question : item.title}
                  </span>
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-app-text-subtle">
                  <span className="inline-flex items-center gap-1">
                    <ItemKindIcon item={item} />
                    {itemKindLabel(item)}
                  </span>
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
                    <StepFacts item={item} taskCount={stepTaskCounts[item.id]} />
                  </span>
                ) : null}
                {blockers.length > 0 ? (
                  <span className="mt-1.5 block text-xs text-app-text-muted">
                    Waits on {blockers.map((blocker) => blocker.title).join(", ")}
                  </span>
                ) : null}
              </button>
              <Button
                size="sm"
                variant="ghost"
                iconOnly
                aria-label={`Add a step after ${item.title}`}
                title="Add a step after this"
                onClick={() => onAddAfter(item, items)}
                className="opacity-0 transition-opacity group-focus-within/item:opacity-100 group-hover/item:opacity-100"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
