import {
  useRef,
  useState,
  type Dispatch,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type SetStateAction,
} from "react";
import { snapPoint, toWorldPoint, type Viewport } from "./cameraMath";
import {
  belowDragThreshold,
  CONTROL_SELECTOR,
  doubleClickOn,
  draggedPosition,
  gestureFor,
  nodeAtPoint,
  pannedViewport,
  releaseOutcome,
  type Gesture,
  type NodeGesture,
  type PanGesture,
} from "./gestures";
import type { GraphPoint } from "./layout";

type Dragging = { id: string; position: GraphPoint };
type Connection = { sourceId: string; pointer: GraphPoint };
type CanvasPointerEvent = ReactPointerEvent<HTMLDivElement>;

type PointerInput = {
  containerRef: RefObject<HTMLDivElement | null>;
  viewport: Viewport;
  setViewport: Dispatch<SetStateAction<Viewport>>;
  positions: ReadonlyMap<string, GraphPoint>;
  cancelFlight: () => void;
  selectedId: string | null;
  canMove: boolean;
  canConnect: boolean;
  clearSelectedEdge: () => void;
  onSelect?: (id: string | null) => void;
  onOpen?: (id: string) => void;
  onMove?: (id: string, position: GraphPoint) => void;
  onConnect?: (blockerId: string, nodeId: string) => void;
  onCanvasDoubleClick?: (position: GraphPoint) => void;
};

/** What the gesture handlers work with: the owner's input, the gesture in progress and what is drawn of it. */
type Session = {
  input: PointerInput;
  gestureRef: RefObject<Gesture | null>;
  dragOverride: Dragging | null;
  setDragOverride: Dispatch<SetStateAction<Dragging | null>>;
  setConnection: Dispatch<SetStateAction<Connection | null>>;
  toWorld: (clientX: number, clientY: number) => GraphPoint;
};

function beginGesture(session: Session, event: CanvasPointerEvent) {
  const { input, gestureRef, setConnection, toWorld } = session;
  if (event.button !== 0) return;
  const target = event.target as HTMLElement;
  if (target.closest(CONTROL_SELECTOR)) return;
  input.cancelFlight();
  const gesture = gestureFor(target, event, input);
  gestureRef.current = gesture;
  if (gesture.kind === "connect") {
    event.preventDefault();
    const pointer = toWorld(event.clientX, event.clientY);
    setConnection({ sourceId: gesture.sourceId, pointer });
  } else {
    input.clearSelectedEdge();
  }
  event.currentTarget.setPointerCapture?.(event.pointerId);
}

function dragBy(session: Session, gesture: PanGesture | NodeGesture, delta: GraphPoint) {
  if (gesture.kind === "pan") {
    session.input.setViewport(pannedViewport(gesture, delta.x, delta.y));
    return;
  }
  const position = draggedPosition(gesture, delta.x, delta.y, session.input.viewport.zoom);
  session.setDragOverride({ id: gesture.nodeId, position });
}

function moveGesture(session: Session, event: CanvasPointerEvent) {
  const gesture = session.gestureRef.current;
  if (!gesture || gesture.pointerId !== event.pointerId) return;
  if (gesture.kind === "connect") {
    const pointer = session.toWorld(event.clientX, event.clientY);
    session.setConnection({ sourceId: gesture.sourceId, pointer });
    return;
  }
  const delta = { x: event.clientX - gesture.startX, y: event.clientY - gesture.startY };
  if (!gesture.moved && belowDragThreshold(delta.x, delta.y)) return;
  gesture.moved = true;
  dragBy(session, gesture, delta);
}

/** Lets go of an edge being drawn: it connects when it is dropped on another node. */
function endConnect(
  session: Session,
  event: CanvasPointerEvent,
  sourceId: string,
  cancelled: boolean,
) {
  session.setConnection(null);
  const nodeId = cancelled ? undefined : nodeAtPoint(event.clientX, event.clientY);
  if (nodeId && nodeId !== sourceId) session.input.onConnect?.(sourceId, nodeId);
}

/** Lets go of a pan or a node: whatever it amounted to -- a move, a selection -- is asked of the owner. */
function endDrag(session: Session, gesture: PanGesture | NodeGesture, cancelled: boolean) {
  const { input, dragOverride } = session;
  const outcome = releaseOutcome(gesture, {
    cancelled,
    selectedId: input.selectedId,
    dragged: dragOverride?.position ?? null,
  });
  if (outcome.type === "move") input.onMove?.(outcome.id, outcome.position);
  if (outcome.type === "select") input.onSelect?.(outcome.id);
  if (gesture.kind === "node") session.setDragOverride(null);
}

function endGesture(session: Session, event: CanvasPointerEvent, cancelled: boolean) {
  const gesture = session.gestureRef.current;
  if (!gesture || gesture.pointerId !== event.pointerId) return;
  session.gestureRef.current = null;
  if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }
  if (gesture.kind === "connect") endConnect(session, event, gesture.sourceId, cancelled);
  else endDrag(session, gesture, cancelled);
}

function doubleClick(session: Session, event: ReactMouseEvent<HTMLDivElement>) {
  const { input, toWorld } = session;
  const action = doubleClickOn(event.target as HTMLElement);
  if (action.type === "open") input.onOpen?.(action.id);
  if (action.type === "canvas") {
    input.onCanvasDoubleClick?.(snapPoint(toWorld(event.clientX, event.clientY)));
  }
}

/**
 * What the pointer does on the canvas: pans the view, moves a node, draws an edge from a port,
 * selects on a click and opens on a double click.
 *
 * The gesture in progress lives in a ref -- it changes on every pointer move and none of it is
 * drawn. What is drawn of it (the node being dragged, the edge being drawn) is state.
 */
export function useCanvasPointer(input: PointerInput) {
  const gestureRef = useRef<Gesture | null>(null);
  const [dragOverride, setDragOverride] = useState<Dragging | null>(null);
  const [connection, setConnection] = useState<Connection | null>(null);

  const toWorld = (clientX: number, clientY: number): GraphPoint => {
    const rect = input.containerRef.current?.getBoundingClientRect();
    const origin = { left: rect?.left ?? 0, top: rect?.top ?? 0 };
    return toWorldPoint({ x: clientX, y: clientY }, origin, input.viewport);
  };
  const session: Session = {
    input,
    gestureRef,
    dragOverride,
    setDragOverride,
    setConnection,
    toWorld,
  };

  return {
    dragOverride,
    connection,
    handlers: {
      onPointerDown: (event: CanvasPointerEvent) => beginGesture(session, event),
      onPointerMove: (event: CanvasPointerEvent) => moveGesture(session, event),
      onPointerUp: (event: CanvasPointerEvent) => endGesture(session, event, false),
      onPointerCancel: (event: CanvasPointerEvent) => endGesture(session, event, true),
      onDoubleClick: (event: ReactMouseEvent<HTMLDivElement>) => doubleClick(session, event),
    },
  };
}
