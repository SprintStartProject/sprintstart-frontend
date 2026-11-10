import {
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
  type Ref,
} from "react";
import {
  fitViewport,
  graphBounds,
  revealShift,
  viewCenter,
  viewportIntoNode,
  zoomedAround,
  type CanvasSize,
  type Viewport,
} from "./cameraMath";
import type { JourneyCameraHandle } from "./canvasTypes";
import type { GraphPoint } from "./layout";
import { useViewportFlight } from "./useViewportFlight";

type NodeSize = { width: number; height: number };

type CameraInput = {
  containerRef: RefObject<HTMLDivElement | null>;
  expanded: boolean;
  positions: ReadonlyMap<string, GraphPoint>;
  nodeSize: NodeSize;
  focusId: string | null;
  fitKey: string;
  enterFromId: string | null;
  cameraRef?: Ref<JourneyCameraHandle>;
};

/** The size of the canvas element, kept up to date as it is resized. */
function useCanvasSize(containerRef: RefObject<HTMLDivElement | null>, expanded: boolean) {
  const [size, setSize] = useState<CanvasSize>({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const update = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [containerRef, expanded]);
  return size;
}

type CameraTools = {
  size: CanvasSize;
  nodeSize: NodeSize;
  positions: ReadonlyMap<string, GraphPoint>;
  viewportRef: RefObject<Viewport>;
  fitTarget: (preferFocus: boolean) => Viewport | null;
  flyTo: (target: Viewport, durationMs: number) => Promise<void>;
  intoNode: (id: string) => Viewport | null;
};

/** The moves the canvas lets its owner make through `cameraRef`. */
function useCameraHandle(cameraRef: Ref<JourneyCameraHandle> | undefined, tools: CameraTools) {
  const { size, positions, viewportRef, fitTarget, flyTo, intoNode } = tools;
  const { width, height } = tools.nodeSize;
  useImperativeHandle(
    cameraRef,
    () => ({
      zoomIntoNode: async (id, durationMs = 460) => {
        const target = intoNode(id);
        if (target) await flyTo(target, durationMs);
      },
      flyToFit: async (durationMs = 520) => {
        const target = fitTarget(false);
        if (target) await flyTo(target, durationMs);
      },
      viewCenter: () => viewCenter(viewportRef.current, size),
      revealNode: async (id, durationMs = 220) => {
        const point = positions.get(id);
        if (!point || !size.width || !size.height) return;
        const current = viewportRef.current;
        const { dx, dy } = revealShift(point, current, size, { width, height });
        if (dx === 0 && dy === 0) return;
        await flyTo({ ...current, x: current.x + dx, y: current.y + dy }, durationMs);
      },
    }),
    [fitTarget, flyTo, height, intoNode, positions, size, viewportRef, width],
  );
}

type RefitInput = {
  fitKey: string;
  expanded: boolean;
  width: number;
  enterFromId: string | null;
  viewportRef: RefObject<Viewport>;
  setViewport: (viewport: Viewport) => void;
  fit: (preferFocus: boolean) => void;
  fitTarget: (preferFocus: boolean) => Viewport | null;
  flyTo: (target: Viewport, durationMs: number) => Promise<void>;
  intoNode: (id: string) => Viewport | null;
};

/**
 * Refits when the graph itself changes or the canvas first gets a size -- not on every position
 * change, or dragging a node would yank the view out from under the pointer.
 */
function useRefit(input: RefitInput) {
  const { fitKey, expanded, width, enterFromId, viewportRef, setViewport } = input;
  const { fit, fitTarget, flyTo, intoNode } = input;
  const fittedRef = useRef<string | null>(null);
  useLayoutEffect(() => {
    const key = `${fitKey}|${expanded}|${width > 0}`;
    if (!width || fittedRef.current === key) return;
    const isFirstFit = fittedRef.current === null;
    fittedRef.current = key;
    const from = isFirstFit && enterFromId ? intoNode(enterFromId) : null;
    if (from) {
      setViewport(from);
      viewportRef.current = from;
      const target = fitTarget(true);
      if (target) void flyTo(target, 560);
      return;
    }
    fit(true);
  }, [
    enterFromId,
    expanded,
    fit,
    fitKey,
    fitTarget,
    flyTo,
    intoNode,
    setViewport,
    viewportRef,
    width,
  ]);
}

type TargetsInput = {
  positions: ReadonlyMap<string, GraphPoint>;
  size: CanvasSize;
  nodeSize: NodeSize;
  focusId: string | null;
};

/** The views the canvas can be taken to: the whole graph, or one node filling it. */
function useCameraTargets({ positions, size, nodeSize, focusId }: TargetsInput) {
  const { width, height } = nodeSize;
  const bounds = useMemo(
    () => graphBounds(positions.values(), { width, height }),
    [height, positions, width],
  );
  const fitTarget = useCallback(
    (preferFocus: boolean): Viewport | null => {
      if (!bounds || !size.width || !size.height) return null;
      const focus = preferFocus && focusId ? positions.get(focusId) : undefined;
      return fitViewport(bounds, size, focus);
    },
    [bounds, focusId, positions, size],
  );
  const intoNode = useCallback(
    (id: string): Viewport | null => {
      const point = positions.get(id);
      if (!point || !size.width || !size.height) return null;
      return viewportIntoNode(point, size, { width, height });
    },
    [height, positions, size, width],
  );
  return { bounds, fitTarget, intoNode };
}

/**
 * The canvas's view of the world: its size, where it is panned and zoomed to, and the moves that
 * change that -- fit, zoom, the flights behind `cameraRef`.
 */
export function useCanvasCamera(input: CameraInput) {
  const { containerRef, expanded, positions, nodeSize, focusId, fitKey, enterFromId } = input;
  const size = useCanvasSize(containerRef, expanded);
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  const viewportRef = useRef(viewport);
  useLayoutEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);
  const { flyTo, cancelFlight } = useViewportFlight(viewportRef, setViewport);

  const { bounds, fitTarget, intoNode } = useCameraTargets({ positions, size, nodeSize, focusId });
  const fit = useCallback(
    (preferFocus: boolean) => {
      const target = fitTarget(preferFocus);
      if (target) setViewport(target);
    },
    [fitTarget],
  );
  const zoomAround = useCallback((factor: number, screenX: number, screenY: number) => {
    setViewport((current) => zoomedAround(current, factor, screenX, screenY));
  }, []);

  useCameraHandle(input.cameraRef, {
    size,
    nodeSize,
    positions,
    viewportRef,
    fitTarget,
    flyTo,
    intoNode,
  });
  useRefit({
    fitKey,
    expanded,
    width: size.width,
    enterFromId,
    viewportRef,
    setViewport,
    fit,
    fitTarget,
    flyTo,
    intoNode,
  });

  return { size, viewport, setViewport, bounds, zoomAround, fit, cancelFlight };
}
