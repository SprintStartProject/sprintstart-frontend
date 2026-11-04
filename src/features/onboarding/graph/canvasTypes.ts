import type { ReactNode, Ref } from "react";
import type { GraphPoint, LayoutNode } from "./layout";

/** Camera moves a caller can ask for -- the zoom into a phase, the view centre for "add here". */
export type JourneyCameraHandle = {
  /** Flies the view into a node until it fills the canvas. Resolves when the flight is over. */
  zoomIntoNode: (id: string, durationMs?: number) => Promise<void>;
  /** Where the middle of the visible canvas is, in world coordinates. */
  viewCenter: () => GraphPoint;
  /** Flies back out to the whole graph. */
  flyToFit: (durationMs?: number) => Promise<void>;
  /**
   * Pans, at the zoom it is on, until the node is comfortably inside the view. Does nothing when
   * it already is -- moving the picture under somebody who can see what they picked is worse than
   * not moving it. It follows an arrow-key selection, which could otherwise walk off screen.
   */
  revealNode: (id: string, durationMs?: number) => Promise<void>;
};

export type { JourneyEdgeTone } from "../../graph-diagram";
import type { JourneyEdgeTone } from "../../graph-diagram";

/** How a node relates to the one under the pointer or selected. */
export type JourneyNodeEmphasis = "focus" | "related" | "dimmed" | "none";

export type JourneyNodeRenderState = {
  selected: boolean;
  emphasis: JourneyNodeEmphasis;
  dragging: boolean;
  /**
   * The canvas's current zoom, for a card that wants to size a label against it.
   *
   * Everything on the canvas shrinks with the zoom, which is right for the picture and wrong for
   * the words in it: at the zoom where a large graph fits at once, 13px type is under five pixels
   * on screen. A card that divides by this keeps a label roughly constant on screen however far
   * out the reader is -- the graph becomes a map with labels rather than a smear. Cards with
   * nothing to scale ignore it.
   */
  zoom: number;
};

/** What a caller gives the journey canvas. */
export type JourneyCanvasProps<TNode extends LayoutNode> = {
  nodes: readonly TNode[];
  positions: ReadonlyMap<string, GraphPoint>;
  /** Every node is drawn at this size; edges attach to the middle of its top and bottom edge. */
  nodeSize: { width: number; height: number };
  renderNode: (node: TNode, state: JourneyNodeRenderState) => ReactNode;
  /** Accessible name of a node, since the card itself is only a picture of it. */
  nodeLabel: (node: TNode) => string;
  edgeTone?: (blocker: TNode, node: TNode) => JourneyEdgeTone;
  ariaLabel: string;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  /** Double click or Enter on a node. */
  onOpen?: (id: string) => void;
  /** Node the first view centres on when the whole graph is too large to read at once. */
  focusId?: string | null;
  /** The view is refitted whenever this changes -- a different phase, a different graph. */
  fitKey: string;
  /** Nodes can be dragged. The canvas shows the move straight away; the caller persists it. */
  canMove?: boolean;
  onMove?: (id: string, position: GraphPoint) => void;
  /** Edges can be drawn from a node's port and removed by selecting them. */
  canConnect?: boolean;
  onConnect?: (blockerId: string, nodeId: string) => void;
  onDisconnect?: (blockerId: string, nodeId: string) => void;
  /** Double click on empty canvas, in world coordinates -- e.g. "add a step here". */
  onCanvasDoubleClick?: (position: GraphPoint) => void;
  /** Extra controls, rendered in the floating toolbar. */
  toolbar?: ReactNode;
  /** Shown over the canvas, top left -- a breadcrumb, a legend. */
  overlay?: ReactNode;
  /** Shown over the canvas, right -- the details of the selected node. */
  aside?: ReactNode;
  heightClassName?: string;
  cameraRef?: Ref<JourneyCameraHandle>;
  /** Start zoomed into this node and fly out to the whole graph -- the way back out of a phase. */
  enterFromId?: string | null;
  /** Fades every node but this one -- used while flying into it. */
  spotlightId?: string | null;
  /** Drawn over the whole canvas, above everything -- a node zoomed into until it is a page. */
  cover?: ReactNode;
};
