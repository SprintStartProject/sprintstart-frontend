import { useMemo, useRef, useState, type RefObject } from "react";
import { MINIMAP_MIN_NODES, minimapLayout } from "./cameraMath";
import type { JourneyCanvasProps } from "./canvasTypes";
import type { PickedEdge } from "./JourneyEdgeLayer";
import type { LayoutNode } from "./layout";
import { useCanvasCamera } from "./useCanvasCamera";
import { useCanvasKeys, useCanvasWheel } from "./useCanvasInput";
import { useCanvasPointer } from "./useCanvasPointer";
import { useCanvasScene } from "./useCanvasScene";

type UiState = {
  containerRef: RefObject<HTMLDivElement | null>;
  expanded: boolean;
  selectedId: string | null;
  clearSelectedEdge: () => void;
};

/** The view of the world and what the pointer and the wheel do to it. */
function useCanvasInteraction<TNode extends LayoutNode>(
  props: JourneyCanvasProps<TNode>,
  ui: UiState,
) {
  const camera = useCanvasCamera({
    containerRef: ui.containerRef,
    expanded: ui.expanded,
    positions: props.positions,
    nodeSize: props.nodeSize,
    focusId: props.focusId ?? null,
    fitKey: props.fitKey,
    enterFromId: props.enterFromId ?? null,
    cameraRef: props.cameraRef,
  });
  const pointer = useCanvasPointer({
    ...props,
    containerRef: ui.containerRef,
    viewport: camera.viewport,
    setViewport: camera.setViewport,
    cancelFlight: camera.cancelFlight,
    selectedId: ui.selectedId,
    canMove: props.canMove ?? false,
    canConnect: props.canConnect ?? false,
    clearSelectedEdge: ui.clearSelectedEdge,
  });
  useCanvasWheel({
    containerRef: ui.containerRef,
    expanded: ui.expanded,
    height: camera.size.height,
    cancelFlight: camera.cancelFlight,
    zoomAround: camera.zoomAround,
    setViewport: camera.setViewport,
  });
  return { camera, pointer };
}

/**
 * Everything the canvas is made of apart from how it looks: its camera, its pointer and keyboard,
 * what is on it and what is lit up.
 */
export function useJourneyCanvas<TNode extends LayoutNode>(props: JourneyCanvasProps<TNode>) {
  const selectedId = props.selectedId ?? null;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [selectedEdge, setSelectedEdge] = useState<PickedEdge | null>(null);
  const clearSelectedEdge = () => setSelectedEdge(null);

  const { camera, pointer } = useCanvasInteraction(props, {
    containerRef,
    expanded,
    selectedId,
    clearSelectedEdge,
  });
  const scene = useCanvasScene({
    ...props,
    dragOverride: pointer.dragOverride,
    hoveredId,
    selectedId,
    spotlightId: props.spotlightId ?? null,
    selectedEdge,
  });
  const onKeyDown = useCanvasKeys({
    ...props,
    size: camera.size,
    selectedId,
    expanded,
    selectedEdge,
    drawnEdge: scene.drawnEdge,
    zoomAround: camera.zoomAround,
    fit: camera.fit,
    clearSelectedEdge,
    setExpanded,
  });
  const { bounds } = camera;
  const nodeCount = props.nodes.length;
  const minimap = useMemo(
    () => (bounds && nodeCount >= MINIMAP_MIN_NODES ? minimapLayout(bounds) : null),
    [bounds, nodeCount],
  );

  return {
    containerRef,
    selectedId,
    expanded,
    setExpanded,
    setHoveredId,
    selectedEdge,
    setSelectedEdge,
    camera,
    pointer,
    scene,
    onKeyDown,
    minimap,
  };
}

export type JourneyCanvasModel<TNode extends LayoutNode> = ReturnType<
  typeof useJourneyCanvas<TNode>
>;
