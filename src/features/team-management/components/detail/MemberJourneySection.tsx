import {
  AlertTriangle,
  ClipboardCheck,
  Clock,
  GitBranch,
  ListChecks,
  Lock,
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
  JourneyGraph,
  type GraphEditing,
} from "../../../onboarding/components/journey/JourneyGraph";
import { PhaseNavigator } from "../../../onboarding/components/journey/PhaseNavigator";
import { StepOriginBadge } from "../../../onboarding/components/StepOriginBadge";
import { ItemGlyph, ItemKindIcon } from "../../../onboarding/graph/JourneyNodeCards";
import { itemKindLabel, itemStateLabel } from "../../../onboarding/graph/nodeLabels";
import {
  blockingPhases,
  formatMinutes,
  itemState,
  orderedPhaseItems,
  pathProgress,
  phaseItems,
  phaseProgress,
  phaseState,
  sortedPhases,
  waitingOn,
  type PhaseItem,
} from "../../../onboarding/journey";
import { resolveNextAction } from "../../../onboarding/nextAction";
import type { OnboardingPathEndpoint, OnboardingPhaseEndpoint } from "../../../onboarding/types";
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
  onPathChanged,
}: Props) {
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
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [graphPhaseId, setGraphPhaseId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [freshStepId, setFreshStepId] = useState<string | null>(null);

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

  const editing = useMemo<GraphEditing>(
    () => ({
      connectItems: async (_phaseId, blockerId, nodeId) => {
        const node = phases.flatMap(phaseItems).find((item) => item.id === nodeId);
        if (!node || node.blockerIds.includes(blockerId)) return;
        await onboardingGraphService.replaceNodeBlockers(nodeId, [...node.blockerIds, blockerId]);
        await onPathChanged();
      },
      disconnectItems: async (_phaseId, blockerId, nodeId) => {
        const node = phases.flatMap(phaseItems).find((item) => item.id === nodeId);
        if (!node) return;
        await onboardingGraphService.replaceNodeBlockers(
          nodeId,
          node.blockerIds.filter((id) => id !== blockerId),
        );
        await onPathChanged();
      },
      connectPhases: async (blockerId, phaseId) => {
        const target = phases.find((candidate) => candidate.id === phaseId);
        const blockers = target?.blockerIds ?? [];
        if (!target || blockers.includes(blockerId)) return;
        await onboardingGraphService.replacePhaseBlockers(phaseId, [...blockers, blockerId]);
        await onPathChanged();
      },
      disconnectPhases: async (blockerId, phaseId) => {
        const target = phases.find((candidate) => candidate.id === phaseId);
        if (!target) return;
        await onboardingGraphService.replacePhaseBlockers(
          phaseId,
          (target.blockerIds ?? []).filter((id) => id !== blockerId),
        );
        await onPathChanged();
      },
      addStep: async (phaseId, point) => {
        const target = phases.find((candidate) => candidate.id === phaseId);
        if (!target) return;
        // A blank step, connected to nothing: the PM draws its connections and names it next.
        const created = await onboardingGraphService.createConnectedStep(phaseId, {
          step: {
            position: target.steps.length,
            title: NEW_STEP_TITLE,
            description: "",
            type: "TASK",
            estimatedMinutes: 30,
            expectedOutcome: "",
          },
          waitsOn: [],
          unlocks: [],
          graphX: point.x,
          graphY: point.y,
        });
        await onPathChanged();
        setFreshStepId(created.id);
        setSelectedItemId(created.id);
      },
    }),
    [onPathChanged, phases],
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
  const pendingSkips = allSteps.filter(
    (step) => (step.skip as { status?: string } | null)?.status === "PENDING",
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
                    tools={questionTools(phase)}
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
                  />
                </div>
              </div>
            ) : (
              <JourneyGraph
                phases={phases}
                openPhaseId={graphPhaseId}
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
                renderPhaseActions={questionTools}
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
}: {
  phase: OnboardingPhaseEndpoint;
  nextItemId: string | null;
  stepTaskCounts: Record<string, StepTaskCount>;
  onOpenItem: (item: PhaseItem) => void;
}) {
  const items = orderedPhaseItems(phase);

  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-app-border bg-app-surface-muted px-6 py-10 text-center text-sm text-app-text-muted">
        This phase has no steps or questions yet. Add one in the graph.
      </div>
    );
  }

  return (
    <ol className="space-y-1.5" aria-label={`${phase.title}: steps and questions`}>
      {items.map((item) => {
        const state = itemState(item, phase.locked);
        const isNext = item.id === nextItemId;
        const blockers = state === "locked" ? waitingOn(item, items) : [];
        return (
          <li key={item.id} className="group/item relative">
            <div
              className={`flex items-start gap-4 rounded-2xl border p-3 transition-colors ${
                item.kind === "question"
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
              <button
                type="button"
                onClick={() => onOpenItem(item)}
                className="min-w-0 flex-1 rounded-lg text-left focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
              >
                <span className="flex flex-wrap items-center gap-2">
                  {isNext ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase ${
                        item.kind === "question" ? "bg-app-question-solid" : "bg-app-brand"
                      }`}
                    >
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
            </div>
          </li>
        );
      })}
    </ol>
  );
}
