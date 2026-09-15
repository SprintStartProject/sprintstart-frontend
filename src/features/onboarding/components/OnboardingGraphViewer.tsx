import {
  ArrowLeft,
  CheckCircle2,
  CircleDot,
  CircleHelp,
  GitBranch,
  ListChecks,
  Lock,
  RotateCcw,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import type { BadgeVariant } from "../../../components/ui/Badge.tsx";
import { Button } from "../../../components/ui/Button.tsx";
import {
  BlueprintGraphCanvas,
  type BlueprintGraphCanvasNode,
  type BlueprintGraphCanvasNodeProps,
} from "../../blueprints/components/BlueprintGraphCanvas.tsx";
import { BlueprintNodeCard } from "../../blueprints/components/BlueprintNodeCard.tsx";
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

/**
 * Read-only projection of a personalized onboarding path onto the Blueprint graph canvas.
 *
 * The same canvas the PM authors on, with `editable` off: the hire reads the picture their PM drew
 * rather than a second drawing of the same thing that could disagree with it. Phase nodes open
 * their copied step/question sub-graph; questions come embedded in the path, so no separate check
 * request is needed.
 *
 * **Missing edges stay missing.** An earlier version filled an absent `blockerIds` with "whatever
 * came before this in the array", which drew a chain through steps and questions that the path
 * never claimed — and in a graph whose only relation is a hard lock, an invented edge is an
 * invented reason a hire cannot start something. Absent means no prerequisite, which is also what
 * the backend means by it.
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
      sortedPhases.map((phase) => ({
        id: phase.id,
        title: phase.title,
        kind: "phase",
        graphX: phase.graphX ?? null,
        graphY: phase.graphY ?? null,
        blockerIds: phase.blockerIds ?? [],
        locked: phase.locked,
        selected: phase.id === selectedPhaseId,
      })),
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
        graphX: step.graphX ?? null,
        graphY: step.graphY ?? null,
        blockerIds: step.blockerIds ?? [],
      }));
    const questions = [...subGraphPhase.questions]
      .sort((left, right) => left.position - right.position)
      .map((question: OnboardingQuestionEndpoint) => ({
        id: question.id,
        title: question.title || question.question,
        kind: "question" as const,
        status: question.status,
        locked: question.status === "LOCKED",
        graphX: question.graphX ?? null,
        graphY: question.graphY ?? null,
        blockerIds: question.blockerIds ?? [],
      }));

    return [...steps, ...questions];
  }, [subGraphPhase]);

  function openSubGraphNode(node: OnboardingGraphNode) {
    const phase = sortedPhases.find((item) => item.id === node.id);
    if (!phase) return;
    onSelectPhase(phase.id);
    setSubGraphPhaseId(phase.id);
  }

  if (subGraphPhase) {
    return (
      <BlueprintGraphCanvas
        nodes={subGraphNodes}
        title={subGraphPhase.title}
        description="What this phase asks of you, and what has to come first."
        headerAction={
          <Button
            variant="secondary"
            size="sm"
            icon={<ArrowLeft className="h-4 w-4" />}
            onClick={() => setSubGraphPhaseId(null)}
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
        renderNode={(node, cardProps) => <OnboardingNodeCard node={node} {...cardProps} />}
      />
    );
  }

  return (
    <BlueprintGraphCanvas
      nodes={phaseNodes}
      title="Your onboarding path"
      description="Open a phase to see its steps and knowledge checks."
      libraryTitle="Phases"
      libraryDescription=""
      libraryEmptyMessage=""
      editable={false}
      showLibrary={false}
      ariaLabel="Onboarding phase graph"
      onNodeClick={openSubGraphNode}
      onPositionChange={ignoreGraphMutation}
      onRemoveNode={ignoreGraphMutation}
      onAddBlocker={ignoreGraphMutation}
      onRemoveBlocker={ignoreGraphMutation}
      renderNode={(node, cardProps) => <OnboardingNodeCard node={node} {...cardProps} />}
    />
  );
}

/** What each kind of node is called and drawn with, so the three never drift apart. */
const KIND: Record<OnboardingGraphNode["kind"], { label: string; icon: LucideIcon }> = {
  phase: { label: "Phase", icon: GitBranch },
  step: { label: "Step", icon: ListChecks },
  question: { label: "Knowledge check", icon: CircleHelp },
};

/**
 * Where a node stands, as a word and an icon.
 *
 * Never colour alone: "locked" and "passed" have to stay apart for a reader who cannot tell the
 * two chips' colours apart, which is why every one of these carries its own glyph and label.
 */
function statusFor(node: OnboardingGraphNode): {
  label: string;
  variant: BadgeVariant;
  icon?: LucideIcon;
} {
  if (node.kind === "phase") {
    return node.locked
      ? { label: "Locked", variant: "neutral", icon: Lock }
      : { label: "Open", variant: "brand", icon: CircleDot };
  }

  if (node.kind === "question") {
    switch (node.status) {
      case "PASSED":
        return { label: "Passed", variant: "success", icon: CheckCircle2 };
      case "RETRY":
        return { label: "Try again", variant: "warning", icon: RotateCcw };
      case "LOCKED":
        return { label: "Locked", variant: "neutral", icon: Lock };
      default:
        return { label: "To do", variant: "brand", icon: CircleDot };
    }
  }

  switch (node.status) {
    case "FINISHED":
      return { label: "Completed", variant: "success", icon: CheckCircle2 };
    case "SKIPPED":
      return { label: "Skipped", variant: "neutral", icon: CheckCircle2 };
    case "IN_PROGRESS":
      return { label: "In progress", variant: "brand", icon: CircleDot };
    default:
      return node.locked
        ? { label: "Locked", variant: "neutral", icon: Lock }
        : { label: "Waiting", variant: "neutral", icon: CircleDot };
  }
}

function OnboardingNodeCard({
  node,
  ...cardProps
}: { node: OnboardingGraphNode } & BlueprintGraphCanvasNodeProps) {
  return (
    <BlueprintNodeCard
      {...cardProps}
      title={node.title}
      kind={KIND[node.kind]}
      status={statusFor(node)}
      highlighted={node.selected}
    />
  );
}
