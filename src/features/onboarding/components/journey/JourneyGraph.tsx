import { useRef, useState } from "react";
import type { JourneyCameraHandle } from "../../graph/JourneyCanvas";
import { ArrangeTools } from "./graphView/ArrangeTools";
import type { JourneyGraphProps } from "./graphView/graphTypes";
import { JourneyMapView } from "./graphView/JourneyMapView";
import { PhaseGraphView } from "./graphView/PhaseGraphView";
import { useCameraDives } from "./graphView/useCameraDives";
import { useGraphEditing } from "./graphView/useGraphEditing";
import { useGraphLayout } from "./graphView/useGraphLayout";

export type { GraphEditing } from "./graphView/graphTypes";

const DEFAULT_HEIGHT = "h-[calc(100vh-15rem)] min-h-[32rem]";

/**
 * A path as one zoomable graph: the journey map of all phases, and inside every phase the graph of
 * its steps and questions.
 *
 * Steps live *in* phases, so the two graphs are not two tabs but two depths of the same picture. Every
 * phase card on the map already shows a small drawing of its own graph; clicking it flies the camera
 * into the card and lands on that graph, and "Journey map" flies back out to where it came from.
 *
 * Shared by the hire's page and the PM's member view. Both read; the hire may *arrange* their own
 * graph, and the PM additionally gets `editing` to change what waits on what and to add steps.
 */
export function JourneyGraph(graph: JourneyGraphProps) {
  const { phases, openPhaseId, editing, saveLayout } = graph;
  const mapCamera = useRef<JourneyCameraHandle>(null);
  const phaseCamera = useRef<JourneyCameraHandle>(null);
  const [arranging, setArranging] = useState(false);

  const openPhase = phases.find((phase) => phase.id === openPhaseId) ?? null;
  const layout = useGraphLayout(phases, openPhase, saveLayout);
  const tools = useGraphEditing({
    editing,
    saveLayout,
    openPhase,
    items: layout.items,
    phaseNodes: layout.phaseNodes,
    positions: layout.positions,
    isAutomatic: layout.isAutomatic,
    viewCenter: () => phaseCamera.current?.viewCenter(),
  });
  const dives = useCameraDives({
    mapCamera,
    phaseCamera,
    openPhaseId,
    openItemId: graph.openItemId ?? null,
    onOpenPhaseChange: graph.onOpenPhaseChange,
    onOpenItemChange: graph.onOpenItemChange,
    onSelectItem: graph.onSelectItem,
    setArranging,
  });

  const toolbar =
    saveLayout || editing ? (
      <ArrangeTools
        arranging={arranging}
        editing={editing}
        onToggle={() => setArranging((current) => !current)}
        onTidy={layout.tidy}
      />
    ) : null;
  const heightClassName = graph.heightClassName ?? DEFAULT_HEIGHT;

  if (!openPhase) {
    return (
      <JourneyMapView
        cameraRef={mapCamera}
        phaseNodes={layout.phaseNodes}
        positions={layout.positions}
        focusPhaseId={graph.focusPhaseId}
        surfacedFrom={dives.surfacedFrom}
        divingInto={dives.divingInto}
        arranging={arranging}
        editing={editing}
        toolbar={toolbar}
        heightClassName={heightClassName}
        showMemberUpdates={graph.showMemberUpdates ?? false}
        onDive={(phaseId) => void dives.dive(phaseId)}
        onMove={layout.onMove}
        onConnect={tools.connect}
        onDisconnect={tools.disconnect}
      />
    );
  }

  return (
    <PhaseGraphView
      graph={{ ...graph, heightClassName }}
      phase={openPhase}
      cameraRef={phaseCamera}
      items={layout.items}
      positions={layout.positions}
      arranging={arranging}
      toolbar={toolbar}
      divingIntoItem={dives.divingIntoItem}
      onEnterItem={(itemId) => void dives.enterItem(itemId)}
      onLeaveItem={dives.leaveItem}
      onSurface={dives.surface}
      onMove={layout.onMove}
      onConnect={tools.connect}
      onDisconnect={tools.disconnect}
      onAddStepAt={tools.addStepAt}
      onAddStepInView={tools.addStepInView}
    />
  );
}
