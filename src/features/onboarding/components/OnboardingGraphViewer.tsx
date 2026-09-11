import { ArrowLeft, CheckCircle2, CircleDot, GitBranch, Lock } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "../../../components/ui/Badge.tsx";
import { Button } from "../../../components/ui/Button.tsx";
import {
  BlueprintGraphCanvas,
  type BlueprintGraphCanvasNode,
} from "../../blueprints/components/BlueprintGraphCanvas.tsx";
import type {
  OnboardingPathEndpoint,
  OnboardingQuestionEndpoint,
  OnboardingStepEndpoint,
  StepStatus,
} from "../types.ts";

type OnboardingGraphNode = BlueprintGraphCanvasNode & {
  kind: "phase" | "step" | "question";
  status?: StepStatus | OnboardingQuestionEndpoint["status"];
  locked?: boolean;
  selected?: boolean;
};

type Props = {
  path: OnboardingPathEndpoint;
  selectedPhaseId?: string;
  onSelectPhase: (phaseId: string) => void;
};

const ignoreGraphMutation = () => Promise.resolve();

function fallbackCoordinate(index: number, count: number) {
  return {
    x: (index - (count - 1) / 2) * 280,
    y: -180,
  };
}

/**
 * Read-only projection of a personalized onboarding path onto the blueprint graph canvas.
 * Phase nodes open their copied step/question subgraph; graph authoring controls stay hidden.
 * Questions come embedded in the path, so no separate check request is needed.
 */
export function OnboardingGraphViewer({ path, selectedPhaseId, onSelectPhase }: Props) {
  // Opens directly on the phase selected in the list view: the viewer is remounted every
  // time the page switches to the graph, so this initial state is what the user sees first.
  const [subGraphPhaseId, setSubGraphPhaseId] = useState<string | null>(selectedPhaseId ?? null);
  const [syncedPhaseId, setSyncedPhaseId] = useState(selectedPhaseId);

  // Header phase tabs can change while the viewer stays mounted: re-target the sub-graph
  // during render (the sanctioned alternative to a setState effect) so a header click does
  // not leave the previously drilled phase on screen.
  if (syncedPhaseId !== selectedPhaseId) {
    setSyncedPhaseId(selectedPhaseId);
    setSubGraphPhaseId(selectedPhaseId ?? null);
  }

  const sortedPhases = useMemo(
    () => [...path.phases].sort((left, right) => left.position - right.position),
    [path.phases],
  );
  const subGraphPhase = subGraphPhaseId
    ? (sortedPhases.find((phase) => phase.id === subGraphPhaseId) ?? null)
    : null;

  const phaseNodes = useMemo<OnboardingGraphNode[]>(
    () =>
      sortedPhases.map((phase, index) => {
        const fallback = fallbackCoordinate(index, sortedPhases.length);
        return {
          id: phase.id,
          title: phase.title,
          kind: "phase",
          graphX: phase.graphX ?? fallback.x,
          graphY: phase.graphY ?? fallback.y,
          blockerIds: phase.blockerIds ?? (index > 0 ? [sortedPhases[index - 1].id] : []),
          locked: phase.locked,
          selected: phase.id === selectedPhaseId,
        };
      }),
    [selectedPhaseId, sortedPhases],
  );

  const subGraphNodes = useMemo<OnboardingGraphNode[]>(() => {
    if (!subGraphPhase) return [];
    const steps = [...subGraphPhase.steps]
      .sort((left, right) => left.position - right.position)
      .map((step: OnboardingStepEndpoint) => ({
        id: step.id,
        title: step.title,
        kind: "step" as const,
        status: step.status,
        locked: step.locked,
        graphX: step.graphX,
        graphY: step.graphY,
        blockerIds: step.blockerIds,
      }));
    const questions = [...subGraphPhase.questions]
      .sort((left, right) => left.position - right.position)
      .map((question: OnboardingQuestionEndpoint) => ({
        id: question.id,
        title: question.title || question.question,
        kind: "question" as const,
        status: question.status,
        locked: question.status === "LOCKED",
        graphX: question.graphX,
        graphY: question.graphY,
        blockerIds: question.blockerIds,
      }));
    const nodes = [...steps, ...questions];

    return nodes.map((node, index) => {
      const fallback = fallbackCoordinate(index, nodes.length);
      return {
        ...node,
        graphX: node.graphX ?? fallback.x,
        graphY: node.graphY ?? fallback.y,
        blockerIds: node.blockerIds ?? (index > 0 ? [nodes[index - 1].id] : []),
      };
    });
  }, [subGraphPhase]);

  function openSubGraphNode(node: OnboardingGraphNode) {
    const phase = sortedPhases.find((item) => item.id === node.id);
    if (!phase) return;
    onSelectPhase(phase.id);
    setSubGraphPhaseId(phase.id);
  }

  function returnToPhaseGraph() {
    setSubGraphPhaseId(null);
  }

  if (subGraphPhase) {
    return (
      <div className="space-y-3">
        <BlueprintGraphCanvas
          nodes={subGraphNodes}
          title={subGraphPhase.title}
          description="Read-only view of this phase's steps and knowledge-check questions."
          headerAction={
            <Button
              variant="secondary"
              size="sm"
              icon={<ArrowLeft className="h-4 w-4" />}
              onClick={returnToPhaseGraph}
            >
              Back to phases
            </Button>
          }
          libraryTitle="Phase content"
          libraryDescription=""
          libraryEmptyMessage=""
          editable={false}
          showLibrary={false}
          ariaLabel={`${subGraphPhase.title} onboarding subgraph`}
          onNodeClick={() => undefined}
          onPositionChange={ignoreGraphMutation}
          onRemoveNode={ignoreGraphMutation}
          onAddBlocker={ignoreGraphMutation}
          onRemoveBlocker={ignoreGraphMutation}
          renderNode={(node) => <SubGraphNodeCard node={node} />}
        />
      </div>
    );
  }

  return (
    <BlueprintGraphCanvas
      nodes={phaseNodes}
      title="Your onboarding graph"
      description="Select a phase to inspect its steps and knowledge-check dependencies."
      libraryTitle="Phases"
      libraryDescription=""
      libraryEmptyMessage=""
      editable={false}
      showLibrary={false}
      ariaLabel="Onboarding phase graph"
      onNodeClick={openSubGraphNode}
      onOpenNode={openSubGraphNode}
      onPositionChange={ignoreGraphMutation}
      onRemoveNode={ignoreGraphMutation}
      onAddBlocker={ignoreGraphMutation}
      onRemoveBlocker={ignoreGraphMutation}
      renderNode={(node, graphNodeProps) => (
        <PhaseGraphNodeCard node={node} onOpen={graphNodeProps.onClick} />
      )}
    />
  );
}

function PhaseGraphNodeCard({ node, onOpen }: { node: OnboardingGraphNode; onOpen: () => void }) {
  return (
    <button
      type="button"
      data-graph-node
      onClick={onOpen}
      className={`min-h-20 w-full rounded-xl border p-3 text-left shadow-sm transition-colors ${
        node.selected
          ? "border-app-brand bg-app-brand-soft"
          : "border-app-border bg-app-surface hover:border-app-brand-border-strong"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="line-clamp-2 text-sm font-semibold text-app-text">{node.title}</span>
        <GitBranch className="h-4 w-4 shrink-0 text-app-text-muted" aria-hidden="true" />
      </div>
      <div className="mt-3">
        {node.locked ? (
          <Badge variant="neutral" className="gap-1">
            <Lock className="h-3 w-3" /> Locked
          </Badge>
        ) : (
          <Badge variant="brand">Open phase</Badge>
        )}
      </div>
    </button>
  );
}

function SubGraphNodeCard({ node }: { node: OnboardingGraphNode }) {
  const isStep = node.kind === "step";
  const isComplete = isStep
    ? node.status === "FINISHED" || node.status === "SKIPPED"
    : node.status === "PASSED";

  const label = isStep
    ? node.status === "FINISHED"
      ? "Completed"
      : node.status === "SKIPPED"
        ? "Skipped"
        : node.status === "IN_PROGRESS"
          ? "In progress"
          : node.locked
            ? "Locked"
            : "Waiting"
    : node.status === "PASSED"
      ? "Passed"
      : node.status === "RETRY"
        ? "Try again"
        : node.locked
          ? "Locked"
          : "To do";

  return (
    <div
      data-graph-node
      className="min-h-20 rounded-xl border border-app-border bg-app-surface p-3 shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 text-sm font-semibold text-app-text">{node.title}</p>
        {isComplete ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-app-success-solid" aria-hidden="true" />
        ) : (
          <CircleDot className="h-4 w-4 shrink-0 text-app-brand" aria-hidden="true" />
        )}
      </div>
      <div className="mt-3">
        <Badge variant={isComplete ? "success" : "neutral"}>{label}</Badge>
      </div>
    </div>
  );
}
