import { Map as MapIcon } from "lucide-react";
import type { ReactNode, RefObject } from "react";
import { phaseHasUnseenSkipAnswer } from "../../../skipAnswers";
import { phaseState } from "../../../journey";
import { JourneyCanvas, type JourneyCameraHandle } from "../../../graph/JourneyCanvas";
import { PhaseNodeCard } from "../../../graph/JourneyNodeCards";
import { PHASE_NODE_SIZE } from "../../../graph/graphLayouts";
import type { GraphPoint } from "../../../graph/layout";
import { EdgeLegend } from "./graphKit";
import {
  MAP_EDGE_TONES,
  MAP_KEY,
  mapHint,
  phaseEdgeTone,
  phaseNodeLabel,
  type PhaseNode,
} from "./graphRules";
import type { GraphEditing } from "./graphTypes";

type JourneyMapViewProps = {
  cameraRef: RefObject<JourneyCameraHandle | null>;
  phaseNodes: PhaseNode[];
  positions: Map<string, GraphPoint>;
  focusPhaseId: string | null;
  surfacedFrom: string | null;
  divingInto: string | null;
  arranging: boolean;
  editing: GraphEditing | undefined;
  toolbar: ReactNode;
  heightClassName: string;
  showMemberUpdates: boolean;
  onDive: (phaseId: string) => void;
  onMove: (id: string, point: GraphPoint) => void;
  onConnect: (blockerId: string, nodeId: string) => void;
  onDisconnect: (blockerId: string, nodeId: string) => void;
};

function MapOverlay({ arranging, editing }: Pick<JourneyMapViewProps, "arranging" | "editing">) {
  return (
    <div className="rounded-2xl border border-app-border/70 bg-app-surface/90 px-3 py-2 shadow-lg backdrop-blur-md">
      <div className="flex items-center gap-2">
        <MapIcon className="h-4 w-4 text-app-brand-text" aria-hidden="true" />
        <span className="text-sm font-semibold text-app-text">Journey map</span>
        <span className="hidden text-xs text-app-text-subtle sm:inline">
          {mapHint(arranging, editing)}
        </span>
      </div>
      <EdgeLegend tones={MAP_EDGE_TONES} className="mt-1.5" />
    </div>
  );
}

/** The map of all phases, each a card that flies the camera into its own graph. */
export function JourneyMapView(props: JourneyMapViewProps) {
  const { arranging, editing, focusPhaseId } = props;

  return (
    <JourneyCanvas
      key="map"
      cameraRef={props.cameraRef}
      nodes={props.phaseNodes}
      positions={props.positions}
      nodeSize={PHASE_NODE_SIZE}
      ariaLabel="Journey map of all onboarding phases. Open a phase to see its steps."
      nodeLabel={phaseNodeLabel}
      fitKey={MAP_KEY}
      focusId={focusPhaseId}
      enterFromId={props.surfacedFrom}
      spotlightId={props.divingInto}
      onSelect={(id) => {
        // While arranging a click is part of moving things around; a double click still opens.
        if (id && !arranging) props.onDive(id);
      }}
      onOpen={props.onDive}
      edgeTone={phaseEdgeTone}
      canMove={arranging}
      onMove={props.onMove}
      canConnect={!!editing && arranging}
      onConnect={props.onConnect}
      onDisconnect={editing ? props.onDisconnect : undefined}
      overlay={<MapOverlay arranging={arranging} editing={editing} />}
      toolbar={props.toolbar}
      heightClassName={props.heightClassName}
      renderNode={(node, render) => (
        <PhaseNodeCard
          index={node.index}
          phase={node.phase}
          state={phaseState(node.phase)}
          render={render}
          isFocus={node.id === focusPhaseId}
          hasUpdate={props.showMemberUpdates && phaseHasUnseenSkipAnswer(node.phase)}
        />
      )}
    />
  );
}
