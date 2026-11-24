import {
  useEffect,
  type Dispatch,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
  type SetStateAction,
} from "react";
import { wheelScale, ZOOM_STEP, type CanvasSize, type Viewport } from "./cameraMath";
import { keyCommand } from "./gestures";

type WheelInput = {
  containerRef: RefObject<HTMLDivElement | null>;
  /** Re-attaches the listener when the canvas element is replaced, as it is on expanding. */
  expanded: boolean;
  height: number;
  cancelFlight: () => void;
  zoomAround: (factor: number, screenX: number, screenY: number) => void;
  setViewport: Dispatch<SetStateAction<Viewport>>;
};

/**
 * Two fingers on a trackpad pan, a pinch (which browsers report as a wheel event with `ctrlKey`)
 * zooms around the pointer.
 *
 * The wheel is consumed here and not passed on, so a two-finger swipe inside the graph moves the
 * graph rather than switching the page's tabs. It is a native, non-passive listener because React's
 * wheel handlers are passive and cannot stop the page from scrolling.
 */
export function useCanvasWheel(input: WheelInput) {
  const { containerRef, expanded, height, cancelFlight, zoomAround, setViewport } = input;
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      cancelFlight();
      // Keep the gesture inside the graph; the page around it treats horizontal swipes as tab switches.
      event.stopPropagation();
      const scale = wheelScale(event.deltaMode, height);
      if (event.ctrlKey || event.metaKey) {
        const rect = element.getBoundingClientRect();
        zoomAround(
          Math.exp(-event.deltaY * scale * 0.01),
          event.clientX - rect.left,
          event.clientY - rect.top,
        );
        return;
      }
      setViewport((current) => ({
        ...current,
        x: current.x - event.deltaX * scale,
        y: current.y - event.deltaY * scale,
      }));
    };
    element.addEventListener("wheel", handleWheel, { passive: false });
    return () => element.removeEventListener("wheel", handleWheel);
  }, [cancelFlight, containerRef, expanded, height, setViewport, zoomAround]);
}

type KeyInput = {
  size: CanvasSize;
  selectedId: string | null;
  expanded: boolean;
  selectedEdge: { blockerId: string; nodeId: string } | null;
  /** The picked edge, if it is still drawn: a refetch may have taken it away since it was picked. */
  drawnEdge: { blockerId: string; nodeId: string } | undefined;
  zoomAround: (factor: number, screenX: number, screenY: number) => void;
  fit: (preferFocus: boolean) => void;
  clearSelectedEdge: () => void;
  setExpanded: Dispatch<SetStateAction<boolean>>;
  onSelect?: (id: string | null) => void;
  onOpen?: (id: string) => void;
  onDisconnect?: (blockerId: string, nodeId: string) => void;
};

/** The canvas's keyboard: zoom keys, Enter and Space on a node, Escape, and Delete on an edge. */
export function useCanvasKeys(input: KeyInput) {
  const { size, selectedId, expanded, selectedEdge, drawnEdge, zoomAround, fit } = input;
  const { clearSelectedEdge, setExpanded, onSelect, onOpen, onDisconnect } = input;

  // Close the expanded view with Escape even while focus is outside the canvas.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      // Escape in a field or a dialog belongs to it, not to the canvas behind.
      if (target?.closest?.('input, textarea, select, [role="dialog"]')) return;
      if (event.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded, setExpanded]);

  const centre = (factor: number) => zoomAround(factor, size.width / 2, size.height / 2);
  const removeEdge = () => {
    if (!drawnEdge || !onDisconnect) return;
    onDisconnect(drawnEdge.blockerId, drawnEdge.nodeId);
    clearSelectedEdge();
  };

  return (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const nodeId = target.dataset?.journeyNode;
    const command = keyCommand({
      key: event.key,
      nodeId,
      canOpen: !!onOpen,
      inField: !!target.closest("input, textarea, select"),
      edgeSelected: !!selectedEdge,
      expanded,
    });
    if (command === "open-node" || command === "activate-node") event.preventDefault();
    const actions: Record<typeof command, () => void> = {
      "open-node": () => nodeId && onOpen?.(nodeId),
      "activate-node": () => nodeId && onSelect?.(nodeId === selectedId ? null : nodeId),
      "back-out-of-edge": clearSelectedEdge,
      "back-out-of-expanded": () => setExpanded(false),
      "back-out-of-node": () => onSelect?.(null),
      "zoom-in": () => centre(ZOOM_STEP),
      "zoom-out": () => centre(1 / ZOOM_STEP),
      fit: () => fit(false),
      "remove-edge": removeEdge,
      none: () => undefined,
    };
    actions[command]();
  };
}
