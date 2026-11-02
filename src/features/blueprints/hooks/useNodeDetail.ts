import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useHorizontalWheelNavigation } from "../../../hooks/useHorizontalWheelNavigation.ts";
import type { JourneyCameraHandle } from "../graphKit.ts";
import type { BlueprintGraphCanvasNode, Props } from "../components/blueprintGraphCanvasTypes.ts";
import { neighbourSteps } from "../nodeSteps.ts";

type Camera = RefObject<JourneyCameraHandle | null>;

/**
 * What happens around a node being opened into the canvas and shut again.
 *
 * Flies back out when the opened node is shut -- only on the way out; flying in is done before the
 * caller is told the node was clicked, so that what opens is already what fills the screen. Stepping
 * from one node to the next takes the graph underneath with it, so closing lands on the node that
 * was actually being read. And Escape is how everything in this app that took the screen gives it
 * back: inside a field or a dialog it belongs to that, because a confirmation about unsaved work is
 * the worst possible thing to dismiss by closing the thing it is asking about.
 */
function useDetailLifecycle(params: {
  camera: Camera;
  openNodeId: string | null;
  isOpen: boolean;
  onClose: (() => void) | undefined;
}) {
  const { camera, openNodeId, isOpen, onClose } = params;
  const wasOpenRef = useRef<string | null>(null);

  useEffect(() => {
    const previous = wasOpenRef.current;
    wasOpenRef.current = openNodeId;
    if (previous && !openNodeId) void camera.current?.flyToFit();
    if (previous && openNodeId && previous !== openNodeId) {
      void camera.current?.zoomIntoNode(openNodeId, 260);
    }
  }, [camera, openNodeId]);

  useEffect(() => {
    if (!isOpen || !onClose) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest('input, textarea, select, [role="dialog"]')
      ) {
        return;
      }
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);
}

type Params<TNode extends BlueprintGraphCanvasNode> = {
  nodes: TNode[];
  nodeById: Map<string, TNode>;
  camera: Camera;
} & Pick<
  Props<TNode>,
  "openNodeId" | "renderNodeDetail" | "onNodeClick" | "onCloseNodeDetail" | "onNavigateNodeDetail"
>;

/** A node opened into the canvas: the page it becomes, the steps either side, and how it opens. */
export function useNodeDetail<TNode extends BlueprintGraphCanvasNode>(params: Params<TNode>) {
  const { nodes, nodeById, camera, renderNodeDetail, onNodeClick } = params;
  const { onCloseNodeDetail, onNavigateNodeDetail } = params;
  const openNodeId = params.openNodeId ?? null;
  /** The node the camera is on its way into. Everything else fades while it travels. */
  const [flyingInto, setFlyingInto] = useState<string | null>(null);

  const openNode = openNodeId ? (nodeById.get(openNodeId) ?? null) : null;
  const detail = openNode && renderNodeDetail ? renderNodeDetail(openNode) : null;
  const neighbours = useMemo(() => neighbourSteps(nodes, openNode), [nodes, openNode]);

  const goToNeighbour = useCallback(
    (side: "previous" | "next") => {
      const target = neighbours[side];
      if (target) onNavigateNodeDetail?.(target.node.id);
    },
    [neighbours, onNavigateNodeDetail],
  );

  /**
   * A two-finger swipe across the opened page steps to the neighbour the arrows point at. Scoped to
   * the page itself: the graph under it marks the whole pane as somewhere the page's own swipe must
   * keep its hands off, because a swipe there pans the canvas.
   */
  const swipeRef = useHorizontalWheelNavigation<HTMLDivElement>({
    onNext: () => goToNeighbour("next"),
    onPrevious: () => goToNeighbour("previous"),
    enabled: !!detail && !!onNavigateNodeDetail,
    boundary: "self",
  });

  useDetailLifecycle({ camera, openNodeId, isOpen: !!detail, onClose: onCloseNodeDetail });

  const openNodeById = useCallback(
    (id: string) => {
      const node = nodeById.get(id);
      if (!node) return;
      if (!renderNodeDetail) {
        onNodeClick?.(node);
        return;
      }
      // The camera lands first and the node opens into what it landed on. Telling the caller first
      // would open a page over a graph still on its way there, which reads as two things happening
      // rather than one thing being entered.
      setFlyingInto(id);
      void (async () => {
        await camera.current?.zoomIntoNode(id, 380);
        setFlyingInto(null);
        onNodeClick?.(node);
      })();
    },
    [camera, nodeById, onNodeClick, renderNodeDetail],
  );

  return { openNode, detail, neighbours, goToNeighbour, swipeRef, flyingInto, openNodeById };
}
