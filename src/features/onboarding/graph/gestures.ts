import { snapPoint, type Viewport } from "./cameraMath";
import type { GraphPoint } from "./layout";

/** How far the pointer must travel before a press counts as a drag rather than a click. */
export const DRAG_THRESHOLD_PX = 4;

/** Anything inside this belongs to a control laid over the canvas, not to the canvas itself. */
export const CONTROL_SELECTOR = "[data-canvas-control]";

/** A press on the background: drags pan the view, a click selects the node it landed on, if any. */
export type PanGesture = {
  kind: "pan";
  pointerId: number;
  startX: number;
  startY: number;
  origin: Viewport;
  moved: boolean;
  nodeId: string | null;
};

/** A press on a node that can be moved: drags move it, a click selects it. */
export type NodeGesture = {
  kind: "node";
  pointerId: number;
  startX: number;
  startY: number;
  nodeId: string;
  origin: GraphPoint;
  moved: boolean;
};

/** A press on a node's port: drags draw an edge towards whatever it is dropped on. */
export type ConnectGesture = { kind: "connect"; pointerId: number; sourceId: string };

export type Gesture = PanGesture | NodeGesture | ConnectGesture;

export type PointerFacts = { pointerId: number; clientX: number; clientY: number };

export type GestureRules = {
  canConnect: boolean;
  canMove: boolean;
  positions: ReadonlyMap<string, GraphPoint>;
  viewport: Viewport;
};

/** What a press on `target` starts, given what the canvas lets the reader do. */
export function gestureFor(
  target: HTMLElement,
  pointer: PointerFacts,
  rules: GestureRules,
): Gesture {
  const port = target.closest<HTMLElement>("[data-port-for]");
  if (port?.dataset.portFor && rules.canConnect) {
    return { kind: "connect", pointerId: pointer.pointerId, sourceId: port.dataset.portFor };
  }
  const nodeId = target.closest<HTMLElement>("[data-journey-node]")?.dataset.journeyNode ?? null;
  const origin = nodeId && rules.canMove ? rules.positions.get(nodeId) : undefined;
  const start = { pointerId: pointer.pointerId, startX: pointer.clientX, startY: pointer.clientY };
  if (nodeId && origin) return { kind: "node", ...start, nodeId, origin, moved: false };
  return { kind: "pan", ...start, origin: rules.viewport, moved: false, nodeId };
}

/** Whether the pointer has not yet gone far enough from where it was pressed to count as a drag. */
export const belowDragThreshold = (deltaX: number, deltaY: number) =>
  Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD_PX;

/** The view after a pan gesture has moved by (deltaX, deltaY) screen pixels. */
export const pannedViewport = (gesture: PanGesture, deltaX: number, deltaY: number): Viewport => ({
  ...gesture.origin,
  x: gesture.origin.x + deltaX,
  y: gesture.origin.y + deltaY,
});

/** Where a dragged node is after the pointer has moved by (deltaX, deltaY) screen pixels. */
export const draggedPosition = (
  gesture: NodeGesture,
  deltaX: number,
  deltaY: number,
  zoom: number,
): GraphPoint => ({
  x: gesture.origin.x + deltaX / zoom,
  y: gesture.origin.y + deltaY / zoom,
});

/** What letting go of a pan or node gesture asks the caller for. */
export type Release =
  | { type: "none" }
  | { type: "select"; id: string | null }
  | { type: "move"; id: string; position: GraphPoint };

export type ReleaseFacts = {
  cancelled: boolean;
  selectedId: string | null;
  /** Where the dragged node is now, when one is being dragged. */
  dragged: GraphPoint | null;
};

/** What a finished pan or node gesture means: a move onto the grid, a selection, or nothing. */
export function releaseOutcome(gesture: PanGesture | NodeGesture, facts: ReleaseFacts): Release {
  if (facts.cancelled) return { type: "none" };
  if (gesture.kind === "node") {
    if (gesture.moved) {
      return facts.dragged
        ? { type: "move", id: gesture.nodeId, position: snapPoint(facts.dragged) }
        : { type: "none" };
    }
    return { type: "select", id: gesture.nodeId === facts.selectedId ? null : gesture.nodeId };
  }
  if (gesture.moved) return { type: "none" };
  const picked = gesture.nodeId && gesture.nodeId !== facts.selectedId ? gesture.nodeId : null;
  return { type: "select", id: picked };
}

/** The node under a point of the page, found when an edge being drawn is let go. */
export function nodeAtPoint(clientX: number, clientY: number): string | undefined {
  return document.elementFromPoint?.(clientX, clientY)?.closest<HTMLElement>("[data-journey-node]")
    ?.dataset.journeyNode;
}

/** What a double click on `target` means. */
export type DoubleClick = { type: "open"; id: string } | { type: "canvas" } | { type: "none" };

export function doubleClickOn(target: HTMLElement): DoubleClick {
  if (target.closest(CONTROL_SELECTOR)) return { type: "none" };
  const id = target.closest<HTMLElement>("[data-journey-node]")?.dataset.journeyNode;
  return id ? { type: "open", id } : { type: "canvas" };
}

/** What a key press asks of the canvas. */
export type KeyCommand =
  | "activate-node"
  | "open-node"
  | "back-out-of-edge"
  | "back-out-of-expanded"
  | "back-out-of-node"
  | "zoom-in"
  | "zoom-out"
  | "fit"
  | "remove-edge"
  | "none";

export type KeyFacts = {
  key: string;
  /** The node the key was pressed on, if it was pressed on one. */
  nodeId: string | undefined;
  /** Whether there is an "open" to run for Enter. */
  canOpen: boolean;
  /** Whether focus is in a field, where the keys belong to the field. */
  inField: boolean;
  edgeSelected: boolean;
  expanded: boolean;
};

function escapeCommand(facts: KeyFacts): KeyCommand {
  // One step back per press: the selected edge first, then the expanded view, then the node.
  if (facts.edgeSelected) return "back-out-of-edge";
  return facts.expanded ? "back-out-of-expanded" : "back-out-of-node";
}

const FIELD_KEYS: Record<string, KeyCommand> = {
  "+": "zoom-in",
  "=": "zoom-in",
  "-": "zoom-out",
  "0": "fit",
  Delete: "remove-edge",
  Backspace: "remove-edge",
};

/** What a key press means, given where it was pressed and what the canvas is showing. */
export function keyCommand(facts: KeyFacts): KeyCommand {
  const activates = facts.key === "Enter" || facts.key === " ";
  if (facts.nodeId && activates) {
    // Enter opens where there is an "open"; otherwise it does what a click does, like Space.
    return facts.key === "Enter" && facts.canOpen ? "open-node" : "activate-node";
  }
  if (facts.key === "Escape") return escapeCommand(facts);
  if (facts.inField) return "none";
  return FIELD_KEYS[facts.key] ?? "none";
}
