import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  ConnectionLineType,
  ConnectionMode,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
  useStore,
  type Connection,
  type Edge,
  type EdgeProps,
  type EdgeTypes,
  type IsValidConnection,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Flag,
  KeyRound,
  LayoutGrid,
  Maximize2,
  Minimize2,
  Info,
  Plus,
  Search,
  Waypoints,
  X,
} from "lucide-react";
import { Badge } from "../../../components/ui/Badge.tsx";
import { Button } from "../../../components/ui/Button.tsx";
import { Spinner } from "../../../components/ui/Spinner.tsx";
import { useFocusMode } from "../../../context/useFocusMode.ts";
import { SWIPE_IGNORE_ATTRIBUTE } from "../../../hooks/useHorizontalWheelNavigation.ts";
import { LOCK_SENTENCE } from "../../graph-diagram/lockWords.ts";
import {
  EDGE_REFUSAL_MESSAGE,
  GRAPH_NODE_HEIGHT,
  GRAPH_NODE_WIDTH,
  arrangementFor,
  autoLayoutPositions,
  blueprintEdgePath,
  canConnect,
  chainPositions,
  edgeRefusal,
  edgeSides,
  blockersBehind,
  dependentsAhead,
  entryPointIds,
  separateOverlaps,
  EDGE_TONES,
  detailForZoom,
  keyboardNeighbour,
  type ChainPosition,
  type GraphDirection,
  type GraphDetail,
  type GraphEdgeTone,
  type GraphPositions,
  type GraphSide,
} from "../../graph-diagram/graphLayout.ts";

/** The common graph fields persisted for both Blueprint phases and phase-subgraph nodes. */
export type BlueprintGraphCanvasNode = {
  id: string;
  title: string;
  graphX: number | null;
  graphY: number | null;
  blockerIds: string[];
};

/** What a domain-specific node card is told about the state it is drawn in. */
export type BlueprintGraphCanvasNodeProps = {
  /** True while a graph mutation is in flight; the card should not invite another click. */
  disabled: boolean;
  /** Opens this node's details panel. */
  onClick: () => void;
  /** Drills into this node, on the surfaces that have somewhere to drill to. */
  onOpen?: () => void;
  /**
   * How much of the card is worth drawing.
   *
   * A sixteen-phase blueprint has to be readable at the zoom where all of it fits, and at that size
   * a description is a grey smear nobody reads. See {@link detailForZoom} for where the lines are.
   */
  detail: GraphDetail;
  /**
   * The canvas's current zoom, so a compact card can size its title against it.
   *
   * Everything on the canvas shrinks with the zoom, which is right for the picture and wrong for
   * the words in it: at the zoom where sixteen phases fit, a 14px title is under 5px on screen.
   * A compact card divides by this instead, so its title stays roughly the same size on screen no
   * matter how far out the reader is — the graph becomes a map with labels rather than a smear.
   */
  zoom: number;
  /** True when the card is drawn in the library list rather than on the canvas. */
  inLibrary: boolean;
  /**
   * True when this is the node the reader is pointing at, whose run is lit.
   *
   * The card that started a highlight has to be findable again: on a graph where half the nodes are
   * lit, "which one did I point at" is a question the lighting cannot answer by itself.
   */
  highlighted?: boolean;
  /**
   * Where this node sits in the chain it belongs to, or `undefined` when it belongs to none.
   *
   * Absent is the common case and it means something: this node is in no particular order relative
   * to anything else, and the card says so rather than leaving the reader to guess.
   */
  chainPosition?: ChainPosition;
};

type Props<TNode extends BlueprintGraphCanvasNode> = {
  nodes: TNode[];
  title: string;
  description: string;
  headerAction?: ReactNode;
  editable: boolean;
  /**
   * How tall the canvas makes itself.
   *
   * `"page"` is a surface that owns its share of the screen: it takes most of the viewport height
   * and never less than about 34rem, which is what an editor wants. `"fill"` takes exactly the box
   * it is given, which is what anything embedded wants — a strip on a board, a panel about one
   * card. Getting this wrong is not a cosmetic error: a `"page"` canvas inside a 10rem box does not
   * shrink, it overflows, and paints itself over everything under it.
   */
  height?: "page" | "fill";
  ariaLabel?: string;
  /** Headline for the overlay drawn when nothing is placed. */
  emptyTitle?: string;
  onNodeClick: (node: TNode) => void;
  onOpenNode?: (node: TNode) => void;
  onPositionChange: (node: TNode, x: number, y: number) => Promise<void>;
  onAddBlocker: (node: TNode, blockerId: string) => Promise<void>;
  onRemoveBlocker: (node: TNode, blockerId: string) => Promise<void>;
  /**
   * What this canvas can make, and what each one is called on the button that makes it.
   *
   * A path graph has one kind of node; a phase's sub-graph has two. Empty on a canvas that only
   * shows what is already there.
   */
  createKinds?: { id: string; label: string }[];
  /** Makes one, at a point on the canvas. */
  onCreateNode?: (kindId: string, x: number, y: number) => Promise<void>;
  renderNode: (node: TNode, props: BlueprintGraphCanvasNodeProps) => ReactNode;
  /**
   * Who put this arrow here, where that is a question the graph can answer.
   *
   * Left out by every Blueprint surface: there, one author wrote all of them, and three line styles
   * for one kind of thing would be three claims where there is one.
   */
  edgeTone?: (node: TNode, blockerId: string) => GraphEdgeTone;
};

/** What a dragged "make one of these" button carries. */
const CREATE_KIND_MIME = "application/x-blueprint-create-kind";

type FlowNodeData = {
  render: () => ReactNode;
  ariaLabel: string;
  dimmed: boolean;
  isEntryPoint: boolean;
  hasHandles: boolean;
  /** Drills into this node's own graph, on the surfaces that have one. */
  onOpen?: () => void;
  openLabel: string;
};

type BlueprintFlowNode = Node<FlowNodeData, "blueprint">;

/**
 * Reusable canvas for arranging Blueprint nodes and the prerequisites between them.
 *
 * Built on React Flow, which is what the rest of this app draws node-link diagrams with
 * (`features/graph-diagram/DiagramCanvas`) and what the earlier n8n-style card-blueprint canvas
 * used. That is not only a consistency argument: pan, zoom-to-cursor, fit-to-view, the minimap, the
 * connection affordances and edge routing are the parts of a canvas that are easy to build badly,
 * and a graph the author cannot see all of is the complaint this rewrite exists to answer.
 *
 * **What an edge means, and what it does not.** An arrow from A to B says B cannot start until A is
 * finished — a hard lock. Nodes with no arrow between them are not ordered at all; the reader is
 * free to take them in any order. The legend on the canvas says exactly this, because a graph whose
 * one relation is unexplained gets read as a suggested route, which is the opposite of what it is.
 *
 * **Coordinates are centres, not corners.** That is how they were stored before this canvas existed
 * and how the backend seed writes them, so they are converted on the way in and back on the way
 * out rather than reinterpreted — reinterpreting would shift every seeded blueprint by half a card.
 */
export function BlueprintGraphCanvas<TNode extends BlueprintGraphCanvasNode>(props: Props<TNode>) {
  return (
    <ReactFlowProvider>
      <BlueprintGraphSurface {...props} />
    </ReactFlowProvider>
  );
}

function BlueprintGraphSurface<TNode extends BlueprintGraphCanvasNode>({
  nodes,
  title,
  description,
  headerAction,
  editable,
  height = "page",
  ariaLabel = "Blueprint graph canvas",
  emptyTitle = "Nothing on the canvas yet",
  onNodeClick,
  onOpenNode,
  onPositionChange,
  onAddBlocker,
  onRemoveBlocker,
  createKinds = [],
  onCreateNode,
  renderNode,
  edgeTone,
}: Props<TNode>) {
  const { screenToFlowPosition, fitView, getNode, getViewport, setCenter } = useReactFlow();
  /** The pane's own box, for deciding whether a node is already on screen. */
  const paneRef = useRef<HTMLDivElement | null>(null);
  const zoom = useStore((state) => state.transform[2]);
  const { isFocused, setFocused } = useFocusMode();

  // The posture belongs to the canvas, not to the app: leaving the graph — switching to the list
  // editor, or navigating away — has to give the sidebar and the header band back.
  useEffect(() => () => setFocused(false), [setFocused]);

  /** Escape is how every mode in this app that took the furniture away gives it back. */
  useEffect(() => {
    if (!isFocused) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFocused(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFocused, setFocused]);

  // Refit once the surface has actually changed size: React Flow's own ResizeObserver sees the new
  // height a frame later, and fitting against the old one wastes the room that was just won.
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void fitView({ padding: 0.15, maxZoom: 1, duration: 240 });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [fitView, isFocused]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  /**
   * The node under the pointer, which lights its run without committing to it.
   *
   * Selection stays for the node somebody is working on; hover is for the far more common act of
   * sweeping across a graph asking "what is this one tangled up with". Making that cost a click
   * meant that on a sixteen-phase graph nobody ever asked.
   */
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  /**
   * Hides everything outside the lit run instead of dimming it.
   *
   * Dimming answers "which of these matter" on a graph somebody can see all of. On forty nodes it
   * leaves forty ghosts, and the run being looked at is still buried in them.
   */
  const [chainOnly, setChainOnly] = useState(false);

  // A surface with no library has nowhere to put an unplaced node, so it draws every node and lets
  // `withFallbackPositions` find a free cell for the ones the author never dragged. A personalized
  // path copied from a blueprint whose graph was never opened is exactly that case, and an empty
  // canvas is the wrong answer to it.
  /**
   * Every node, drawn.
   *
   * There used to be a second list — the ones with no stored coordinate, held in a panel beside the
   * canvas. It read as a staging area for things not yet in the blueprint, and that was false:
   * a phase with no coordinate is in the blueprint, has its steps, and reaches every hire exactly
   * like the ones on the canvas. All the panel really held was the fact that nobody had dragged
   * them anywhere, which is not a fact about the blueprint at all.
   *
   * Nothing is hidden now. A node without a coordinate gets a free grid cell from
   * {@link arrangementFor}, the same way the hire's read-only view has always drawn them.
   */
  const placedNodes = nodes;
  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

  /**
   * The nodes whose titles match what was typed, or null when nothing was.
   *
   * Matching rather than filtering: a node that matches is lit and the rest go quiet, so the
   * *shape* of the graph stays on screen. Removing the others would answer "where is the one about
   * deployment" by throwing away the thing that says where it sits.
   */
  const matchIds = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle === "") return null;
    return new Set(
      placedNodes
        .filter((node) => node.title.toLowerCase().includes(needle))
        .map((node) => node.id),
    );
  }, [placedNodes, query]);

  const entryPoints = useMemo(() => entryPointIds(placedNodes), [placedNodes]);
  const chainPositionById = useMemo(() => chainPositions(placedNodes), [placedNodes]);
  /**
   * The run being lit, split into the half in front and the half behind.
   *
   * Hover wins over selection: the pointer is the more recent statement of interest, and a
   * selection that refused to give way while somebody swept the graph would be the graph arguing.
   */
  const focusId = hoveredId ?? selectedId;

  const focus = useMemo(() => {
    if (!focusId) return null;
    return {
      id: focusId,
      behind: blockersBehind(placedNodes, focusId),
      ahead: dependentsAhead(placedNodes, focusId),
    };
  }, [placedNodes, focusId]);

  const chainIds = useMemo(
    () => (focus ? new Set([focus.id, ...focus.behind, ...focus.ahead]) : null),
    [focus],
  );

  const detail = detailForZoom(zoom);

  // Stable for the life of the canvas: React Flow remounts every node when `nodeTypes` changes
  // identity, which would end a drag the moment it started.
  const nodeTypes = useMemo<NodeTypes>(() => ({ blueprint: BlueprintFlowNodeCard }), []);
  const edgeTypes = useMemo<EdgeTypes>(() => ({ blueprint: BlueprintFlowEdge }), []);

  /**
   * A proposed arrangement, held on the canvas and not yet saved.
   *
   * "Tidy up" moves every card at once and is the only thing in this editor with no way back, so
   * it shows its result and asks. Until it is accepted, this is what the canvas draws and what a
   * drag edits — so an author can lay the graph out, nudge two cards, and still throw all of it
   * away.
   */
  const [preview, setPreview] = useState<GraphPositions | null>(null);
  /**
   * The furniture a canvas carries is furniture for a canvas somebody works in.
   *
   * In a strip a few hundred pixels tall, a minimap, a zoom column and a legend panel cover the
   * thing they are meant to help with. What is left there is the graph.
   */
  const isEmbedded = height === "fill";
  const [isLegendOpen, setIsLegendOpen] = useState(!isEmbedded);

  // Stored coordinates can overlap — the seeded blueprint's do — so what gets drawn is the
  // arrangement with any collisions pushed apart. Nothing here is written back. Shared with the
  // edges, which pick the side of each card they attach to from where the two cards ended up.
  const positions = useMemo(
    () => separateOverlaps(placedNodes, preview ?? arrangementFor(placedNodes)),
    [placedNodes, preview],
  );

  const computedNodes = useMemo<BlueprintFlowNode[]>(
    () => {
      const drawnNodes =
        chainOnly && chainIds !== null
          ? placedNodes.filter((node) => chainIds.has(node.id))
          : placedNodes;

      return drawnNodes.map((node) => {
        const centre = positions[node.id];
        const isEntryPoint = entryPoints.has(node.id);

        return {
          id: node.id,
          type: "blueprint" as const,
          // Stored centre → React Flow's top-left.
          position: {
            x: centre.x - GRAPH_NODE_WIDTH / 2,
            y: centre.y - GRAPH_NODE_HEIGHT / 2,
          },
          deletable: false,
          draggable: editable,
          selected: node.id === selectedId,
          data: {
            render: () =>
              renderNode(node, {
                disabled: isSaving,
                detail,
                zoom,
                inLibrary: false,
                highlighted: node.id === focusId,
                chainPosition: chainPositionById.get(node.id),
                onClick: () => onNodeClick(node),
              }),
            ariaLabel: [
              node.title,
              isEntryPoint ? "nothing has to happen first" : null,
              node.blockerIds.length > 0
                ? `waits for ${node.blockerIds
                    .map((blockerId) => nodeById.get(blockerId)?.title)
                    .filter(Boolean)
                    .join(", ")}`
                : null,
            ]
              .filter(Boolean)
              .join(", "),
            // Two reasons a node goes quiet, and they stack: it is outside the run being looked at,
            // or it does not match what was typed.
            dimmed:
              (chainIds !== null && !chainIds.has(node.id)) ||
              (matchIds !== null && !matchIds.has(node.id)),
            isEntryPoint,
            hasHandles: editable,
            onOpen: onOpenNode ? () => onOpenNode(node) : undefined,
            openLabel: `Open ${node.title}`,
          },
        };
      });
    },
    // `detail` is derived from the zoom but only ever holds two values, so this rebuilds when the
    // threshold is crossed rather than on every wheel notch.
    [
      placedNodes,
      positions,
      entryPoints,
      chainIds,
      chainOnly,
      matchIds,
      focusId,
      chainPositionById,
      editable,
      selectedId,
      nodeById,
      detail,
      zoom,
      isSaving,
      renderNode,
      onNodeClick,
      onOpenNode,
    ],
  );

  // React Flow only moves a node during a drag when it owns the node list, so the derived nodes are
  // pushed into its state rather than passed straight through.
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState<BlueprintFlowNode>(computedNodes);
  useEffect(() => setFlowNodes(computedNodes), [computedNodes, setFlowNodes]);

  const edges = useMemo<Edge[]>(() => {
    const drawn = new Set(placedNodes.map((node) => node.id));

    return placedNodes.flatMap((node) =>
      node.blockerIds
        .filter((blockerId) => drawn.has(blockerId))
        .map((blockerId) => {
          // Which side of each card this edge uses is read off where the two cards are, not fixed
          // at right-out/left-in: a card below the one it waits on is reached from below.
          const sides = edgeSides(positions[blockerId], positions[node.id]);
          const tone = EDGE_TONES[edgeTone?.(node, blockerId) ?? "rule"];
          // Which half of the lit run this arrow belongs to, if either. An arrow behind the focus
          // is a reason it is shut; one ahead of it is something it is holding up. The arrowhead
          // already carries the direction — the colour is what makes the two halves separable at a
          // glance, which is the whole point of pointing at a node in a crowded graph.
          const direction = !focus
            ? null
            : (focus.behind.has(blockerId) || blockerId === focus.id) &&
                (focus.behind.has(node.id) || node.id === focus.id)
              ? "behind"
              : (focus.ahead.has(node.id) || node.id === focus.id) &&
                  (focus.ahead.has(blockerId) || blockerId === focus.id)
                ? "ahead"
                : null;

          return {
            id: `${blockerId}->${node.id}`,
            source: blockerId,
            target: node.id,
            sourceHandle: sides.source,
            targetHandle: sides.target,
            // Our own curve — see `blueprintEdgePath`. The library's shapes are a staircase or a
            // bezier too shy to read as one across a sixteen-phase graph.
            type: "blueprint" as const,
            focusable: true,
            deletable: editable,
            style: {
              // React Flow's own stroke is a fixed light grey that vanishes on the dark theme, so
              // the edge carries the brand token and a weight that survives being zoomed out.
              stroke:
                direction === "behind"
                  ? "var(--color-app-warning-solid)"
                  : "var(--color-app-brand)",
              strokeWidth: direction === null ? tone.width : tone.width + 1,
              strokeDasharray: tone.dash,
              strokeLinecap: "round" as const,
              // A twelfth was erasing rather than quieting: the point of dimming is that the rest
              // of the graph stays legible as context, and at that opacity it was gone. A third is
              // what the journey graph on `feature/onboarding-path-rework` settled on, and it reads.
              opacity: focus !== null && direction === null ? 0.35 : 1,
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 18,
              height: 18,
              color:
                direction === "behind"
                  ? "var(--color-app-warning-solid)"
                  : "var(--color-app-brand)",
            },
            ariaLabel: `${nodeById.get(blockerId)?.title ?? "A node"} must be finished before ${node.title}${edgeTone ? `, ${tone.said}` : ""}`,
          };
        }),
    );
  }, [placedNodes, positions, focus, editable, edgeTone, nodeById]);

  /** Runs one graph mutation, holding the canvas still and surfacing the reason if it fails. */
  const runMutation = useCallback(
    async (mutation: () => Promise<void>, fallbackMessage: string) => {
      setIsSaving(true);
      setSaveError(null);
      try {
        await mutation();
      } catch (reason) {
        setSaveError(reason instanceof Error ? reason.message : fallbackMessage);
      } finally {
        setIsSaving(false);
      }
    },
    [],
  );

  const isValidConnection = useCallback<IsValidConnection>(
    (connection) => {
      const { source, target } = connection;
      if (!source || !target) return false;
      return canConnect(placedNodes, target, source);
    },
    [placedNodes],
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      const { source, target } = connection;
      if (!source || !target) return;

      const refusal = edgeRefusal(placedNodes, target, source);
      if (refusal) {
        setSaveError(EDGE_REFUSAL_MESSAGE[refusal]);
        return;
      }

      const blocked = nodeById.get(target);
      if (!blocked) return;
      void runMutation(() => onAddBlocker(blocked, source), "The connection could not be saved.");
    },
    [nodeById, onAddBlocker, placedNodes, runMutation],
  );

  /**
   * Moves one end of an existing arrow to another node.
   *
   * A prerequisite set on the wrong node could only be cut and drawn again — two gestures and a
   * moment where the graph says something false. Dragging the end of an arrow is how every other
   * graph editor moves one, and the same refusals apply as when drawing it: the new edge is
   * checked before the old one is dropped, so a move that would make a ring leaves the arrow alone.
   */
  const handleReconnect = useCallback(
    (previous: Edge, next: Connection) => {
      const { source, target } = next;
      if (!source || !target) return;
      if (source === previous.source && target === previous.target) return;

      const refusal = edgeRefusal(placedNodes, target, source);
      if (refusal) {
        setSaveError(EDGE_REFUSAL_MESSAGE[refusal]);
        return;
      }

      const wasBlocked = nodeById.get(previous.target);
      const nowBlocked = nodeById.get(target);
      if (!wasBlocked || !nowBlocked) return;

      void runMutation(async () => {
        await onAddBlocker(nowBlocked, source);
        await onRemoveBlocker(wasBlocked, previous.source);
      }, "The connection could not be moved.");
    },
    [nodeById, onAddBlocker, onRemoveBlocker, placedNodes, runMutation],
  );

  const handleEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      for (const edge of deleted) {
        const blocked = nodeById.get(edge.target);
        if (!blocked) continue;
        void runMutation(
          () => onRemoveBlocker(blocked, edge.source),
          "The connection could not be removed.",
        );
      }
    },
    [nodeById, onRemoveBlocker, runMutation],
  );

  const handleNodeDragStop = useCallback(
    (_event: unknown, dragged: Node) => {
      const node = nodeById.get(dragged.id);
      if (!node) return;

      const centre = {
        x: Math.round(dragged.position.x + GRAPH_NODE_WIDTH / 2),
        y: Math.round(dragged.position.y + GRAPH_NODE_HEIGHT / 2),
      };

      // A drag while an arrangement is being reviewed edits that arrangement rather than saving on
      // its own: saving one card out of a layout the author has not accepted would leave the graph
      // half in each.
      if (preview) {
        setPreview({ ...preview, [node.id]: centre });
        return;
      }

      void runMutation(
        () => onPositionChange(node, centre.x, centre.y),
        "The node position could not be saved.",
      );
    },
    [nodeById, onPositionChange, preview, runMutation],
  );

  /**
   * Makes a node at a point on the canvas.
   *
   * Three ways in, all of which say *where* the node goes: a double-click puts it under the
   * pointer, the toolbar button puts it in the middle of what is on screen, and a kind can be
   * dragged onto the spot it belongs. The old way — dragging a tile out of a panel that starts
   * closed, in a product where nothing else is made by dragging — was the only one.
   */
  const createAt = useCallback(
    (kindId: string, screenX: number, screenY: number) => {
      if (!onCreateNode) return;
      const centre = screenToFlowPosition({ x: screenX, y: screenY });
      void runMutation(
        () => onCreateNode(kindId, Math.round(centre.x), Math.round(centre.y)),
        "The node could not be created.",
      );
    },
    [onCreateNode, runMutation, screenToFlowPosition],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      const kindId = event.dataTransfer.getData(CREATE_KIND_MIME);
      if (!kindId) return;
      event.preventDefault();
      createAt(kindId, event.clientX, event.clientY);
    },
    [createAt],
  );

  /** Lays every placed node out again and shows the result, without saving any of it. */
  const handleTidyUp = useCallback(() => {
    setPreview(autoLayoutPositions(placedNodes));
    // Every card has moved; the view that framed the old arrangement no longer frames this one.
    window.requestAnimationFrame(() => void fitView({ padding: 0.15, maxZoom: 1, duration: 240 }));
  }, [fitView, placedNodes]);

  /** Writes the proposed arrangement back, one card at a time, and only where it differs. */
  const handleAcceptPreview = useCallback(() => {
    if (!preview) return;
    const accepted = preview;

    void runMutation(async () => {
      for (const node of placedNodes) {
        const target = accepted[node.id];
        if (!target) continue;
        const x = Math.round(target.x);
        const y = Math.round(target.y);
        if (node.graphX === x && node.graphY === y) continue;
        await onPositionChange(node, x, y);
      }
      setPreview(null);
    }, "The layout could not be saved.");
  }, [onPositionChange, placedNodes, preview, runMutation]);

  const handleDiscardPreview = useCallback(() => {
    setPreview(null);
    window.requestAnimationFrame(() => void fitView({ padding: 0.15, maxZoom: 1, duration: 240 }));
  }, [fitView]);

  /**
   * Brings a node fully into view, and only when it is not already.
   *
   * Centring on every selection would move the graph under somebody who clicked a node they were
   * already looking at — the most common case by far, and the one where a camera move reads as the
   * page having lost its place. So the camera only travels when it has to, and when it does it
   * travels rather than cuts.
   */
  const bringIntoView = useCallback(
    (nodeId: string) => {
      const node = getNode(nodeId);
      const pane = paneRef.current;
      if (!node || !pane) return;

      const { x, y, zoom: scale } = getViewport();
      const rect = pane.getBoundingClientRect();
      const left = node.position.x * scale + x;
      const top = node.position.y * scale + y;
      const margin = 24;

      const fullyVisible =
        left >= margin &&
        top >= margin &&
        left + GRAPH_NODE_WIDTH * scale <= rect.width - margin &&
        top + GRAPH_NODE_HEIGHT * scale <= rect.height - margin;
      if (fullyVisible) return;

      void setCenter(
        node.position.x + GRAPH_NODE_WIDTH / 2,
        node.position.y + GRAPH_NODE_HEIGHT / 2,
        { zoom: scale, duration: 420 },
      );
    },
    [getNode, getViewport, setCenter],
  );

  /**
   * Arrow keys move between nodes; Escape lets go of the one being looked at.
   *
   * Listened for on the pane rather than on a node, because the node that has focus is a React Flow
   * concern and the direction is ours. See {@link keyboardNeighbour} for what "left" means.
   */
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const directions: Record<string, GraphDirection> = {
        ArrowLeft: "left",
        ArrowRight: "right",
        ArrowUp: "up",
        ArrowDown: "down",
      };
      const direction = directions[event.key];
      if (!direction) return;
      // Inside a field, an arrow key is a cursor.
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select")) {
        return;
      }

      const from = selectedId ?? [...entryPoints][0] ?? placedNodes[0]?.id;
      if (!from) return;

      const next =
        selectedId === null ? from : keyboardNeighbour(placedNodes, positions, from, direction);
      if (!next) return;

      event.preventDefault();
      setSelectedId(next);
      bringIntoView(next);
    },
    [bringIntoView, entryPoints, placedNodes, positions, selectedId],
  );

  const canAuthor = editable && !isSaving;

  return (
    <section
      className={
        isFocused
          ? // Out of the page's column entirely. "Expand" used to hide the app's furniture and
            // leave the canvas exactly as wide as the page's content column — the graph ended up
            // centred with more empty room around it, which is the opposite of the ask. Fixed to
            // the viewport it is as big as the screen allows.
            "fixed inset-0 z-40 flex flex-col overflow-hidden bg-app-bg"
          : height === "fill"
            ? // No border and no surface of its own: something that fits a box it was handed is
              // something whose container has already decided what it sits in.
              "flex h-full flex-col overflow-hidden"
            : "overflow-hidden rounded-2xl border border-app-border bg-app-surface shadow-sm"
      }
    >
      {/*
        Only where there is something to head. A canvas embedded in something that has already
        named it — a strip on a board, a panel about one card — was drawing an empty `h2` and an
        empty paragraph above itself: sixty pixels of nothing in a two-hundred-pixel strip, and a
        heading with no text in it, which is a heading a screen reader announces and cannot read.
      */}
      {title || headerAction ? (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-app-border px-5 py-4">
          <div className="min-w-0">
            {title ? <h2 className="text-base font-semibold text-app-text">{title}</h2> : null}
            {description ? <p className="mt-1 text-sm text-app-text-muted">{description}</p> : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {headerAction}
            <Button
              variant="secondary"
              size="sm"
              aria-pressed={isFocused}
              icon={
                isFocused ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />
              }
              onClick={() => setFocused(!isFocused)}
            >
              {isFocused ? "Collapse" : "Expand"}
            </Button>
          </div>
        </div>
      ) : null}

      <div
        className={`relative flex min-h-0 ${
          isFocused || height === "fill" ? "flex-1" : "h-[clamp(34rem,calc(100vh-21rem),60rem)]"
        }`}
      >
        {/*
          eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions --
          `role="application"` is a widget role, and this element is focusable: the arrow keys
          below are exactly what that role exists to declare. The rule files `application` under
          non-interactive, which is where it disagrees with ARIA rather than with this code.
        */}
        <div
          ref={paneRef}
          className="relative min-w-0 flex-1"
          role="application"
          aria-label={ariaLabel}
          data-testid="blueprint-graph-canvas"
          // A two-finger horizontal swipe here pans the graph. Without this it would also switch
          // the tab the graph is on, which is the one thing nobody panning a graph wants.
          {...{ [SWIPE_IGNORE_ATTRIBUTE]: "" }}
          onDragOver={(event) => {
            if (!canAuthor) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
          }}
          onDrop={handleDrop}
          onKeyDown={handleKeyDown}
          tabIndex={-1}
        >
          <ReactFlow
            nodes={flowNodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onNodeDragStop={handleNodeDragStop}
            onNodeClick={(_event, node) => {
              setSelectedId(node.id);
              bringIntoView(node.id);
            }}
            onNodeMouseEnter={(_event, node) => setHoveredId(node.id)}
            onNodeMouseLeave={() => setHoveredId(null)}
            onPaneClick={() => setSelectedId(null)}
            onConnect={handleConnect}
            onReconnect={handleReconnect}
            edgesReconnectable={canAuthor}
            onDoubleClick={(event) => {
              // Only on the pane itself: a double-click that landed on a card would otherwise make
              // a node on top of the one somebody was aiming at.
              if (!canAuthor) return;
              const target = event.target as HTMLElement;
              if (!target.classList.contains("react-flow__pane")) return;
              // The first kind, on a surface that has more than one: the toolbar names them all,
              // and a double-click cannot ask which.
              const first = createKinds[0];
              if (first) createAt(first.id, event.clientX, event.clientY);
            }}
            isValidConnection={isValidConnection}
            onEdgesDelete={handleEdgesDelete}
            nodesConnectable={canAuthor}
            nodesDraggable={canAuthor}
            elementsSelectable
            edgesFocusable={editable}
            // Backspace on a card would delete a phase every hire's path is built from; the
            // details panel's Delete button asks nothing either, but at least has to be aimed at.
            // On an edge it undoes a prerequisite, which one drag restores.
            deleteKeyCode={editable ? ["Backspace", "Delete"] : null}
            // The line under the pointer while an edge is being drawn is the same curve, in the
            // same colour, as the edge it will become — so what is being aimed at is what lands.
            // Every handle both starts and accepts a connection, so the author drags between the
            // two sides that face each other rather than between a fixed out dot and in dot. The
            // direction still comes from where the drag started: from the prerequisite to the
            // thing it unlocks, which is the direction the arrow then points.
            connectionMode={ConnectionMode.Loose}
            connectionLineType={ConnectionLineType.Bezier}
            connectionLineStyle={{
              stroke: "var(--color-app-brand)",
              strokeWidth: 2,
              strokeLinecap: "round",
            }}
            // Double-clicking the canvas makes a node now, so it must not also zoom: doing both
            // leaves a new node under a viewport that just jumped away from it.
            zoomOnDoubleClick={!canAuthor}
            connectionRadius={30}
            minZoom={0.2}
            maxZoom={1.8}
            fitView
            fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
            proOptions={{ hideAttribution: false }}
          >
            <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
            {/*
              A vignette over the dots, under everything else. The cards read as lying *on* a
              surface rather than being drawn *in* a texture, which is the whole of the third
              dimension here — nothing is actually perspective-projected.
            */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(120% 80% at 50% 35%, transparent 40%, var(--color-app-bg) 100%)",
              }}
            />
            {isEmbedded ? null : <Controls showInteractive={false} />}
            {/*
              React Flow's minimap ships a white panel and grey nodes, which on the dark theme is a
              bright rectangle in the corner. Tokens instead, and small: it is an overview, not a
              second canvas.
            */}
            {isEmbedded ? null : (
              <MiniMap
                pannable
                zoomable
                ariaLabel="Graph overview"
                className="!right-3 !bottom-3 !m-0 !h-24 !w-40 overflow-hidden !rounded-xl !border !border-app-border !bg-app-surface shadow-sm"
                maskColor="var(--color-app-bg)"
                nodeColor="var(--color-app-brand)"
                nodeStrokeColor="var(--color-app-border)"
              />
            )}

            {/*
              Inside the canvas rather than in a bar above it. A legend is read once and consulted
              rarely, and a full-width row spending a tenth of the height on something in that
              category is the canvas paying rent for it forever. Closable, and it comes back from
              the toolbar.
            */}
            {isLegendOpen ? (
              <Panel position="bottom-left" className="!mb-3 !ml-3">
                <GraphLegend editable={editable} onClose={() => setIsLegendOpen(false)} />
              </Panel>
            ) : null}

            {/*
              The search sits on the canvas rather than in the header: what it does happens here,
              and a control whose effect is three inches away from it reads as a page filter rather
              than as a way of looking at this graph.
            */}
            {placedNodes.length > 4 && !isEmbedded ? (
              <Panel position="top-left" className="!mt-3 !ml-3">
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-app-text-subtle"
                    aria-hidden="true"
                  />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Find a node"
                    aria-label="Find a node on the canvas"
                    className="h-8 w-44 rounded-lg border border-app-border bg-app-surface/95 pr-2 pl-8 text-xs text-app-text shadow-sm backdrop-blur placeholder:text-app-text-subtle focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
                  />
                </div>
              </Panel>
            ) : null}

            {focus ? (
              // What pointing at a node actually told you, in words. The two colours say which
              // half of the run is which; these say how much of it there is — the number nobody
              // can count off a picture, and the one that decides whether a node is worth doing
              // early. "Opens 4" is the difference between a node in the way and a node in a
              // corner.
              <Panel position="top-left">
                <div className="max-w-56 rounded-xl border border-app-border bg-app-surface/95 px-3 py-2 shadow-md">
                  <p className="truncate text-xs font-semibold text-app-text">
                    {nodeById.get(focus.id)?.title}
                  </p>
                  <p className="mt-1 flex flex-col gap-0.5 text-[11px] text-app-text-muted">
                    <span className="flex items-center gap-1.5">
                      <span
                        aria-hidden="true"
                        className="h-0.5 w-3 shrink-0 rounded-full bg-app-warning-solid"
                      />
                      {focus.behind.size === 0
                        ? "Nothing has to happen first"
                        : `${focus.behind.size} must happen first`}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span
                        aria-hidden="true"
                        className="h-0.5 w-3 shrink-0 rounded-full bg-app-brand"
                      />
                      {focus.ahead.size === 0
                        ? "Nothing waits on this"
                        : `Finishing it opens ${focus.ahead.size}`}
                    </span>
                  </p>
                </div>
              </Panel>
            ) : null}

            {canAuthor ? (
              <Panel position="top-right">
                {preview ? (
                  // The proposal states what it did and what happens next, because "Tidy up" has
                  // already redrawn the canvas by the time this is read: without the sentence, an
                  // author cannot tell an applied change from an offered one.
                  <div className="flex max-w-xs flex-col gap-2 rounded-xl border border-app-brand-border bg-app-surface p-3 shadow-app-brand-lift">
                    <p className="text-sm font-semibold text-app-text">Laid out by prerequisite</p>
                    <p className="text-xs text-app-text-muted">
                      Nothing is saved yet. Drag any card to adjust it first, or put the old
                      arrangement back.
                    </p>
                    <div className="flex gap-2">
                      <Button variant="primary" size="sm" onClick={handleAcceptPreview}>
                        Keep this
                      </Button>
                      <Button variant="secondary" size="sm" onClick={handleDiscardPreview}>
                        Put it back
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    {onCreateNode
                      ? createKinds.map((kind) => (
                          // Draggable as well as clickable: clicking puts it in the middle of what
                          // is on screen, which is right when the graph has room and wrong when
                          // somebody already knows the spot they want. The drag sits on the wrapper
                          // because the house Button does not forward drag handlers.
                          <span
                            key={kind.id}
                            draggable
                            onDragStart={(event) => {
                              event.dataTransfer.effectAllowed = "copy";
                              event.dataTransfer.setData(CREATE_KIND_MIME, kind.id);
                            }}
                          >
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={(event) => {
                                const pane = (event.currentTarget as HTMLElement)
                                  .closest("[data-testid='blueprint-graph-canvas']")
                                  ?.getBoundingClientRect();
                                if (!pane) return;
                                createAt(
                                  kind.id,
                                  pane.left + pane.width / 2,
                                  pane.top + pane.height / 2,
                                );
                              }}
                              icon={<Plus className="h-4 w-4" aria-hidden="true" />}
                            >
                              {kind.label}
                            </Button>
                          </span>
                        ))
                      : null}
                    <Button
                      variant="secondary"
                      size="sm"
                      iconOnly
                      aria-label={
                        chainOnly ? "Show the whole graph again" : "Show only the selected run"
                      }
                      title={
                        chainOnly ? "Show the whole graph again" : "Show only the selected run"
                      }
                      aria-pressed={chainOnly}
                      disabled={chainIds === null}
                      onClick={() => setChainOnly((only) => !only)}
                    >
                      <Waypoints className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      iconOnly
                      aria-label={isLegendOpen ? "Hide the legend" : "What the symbols mean"}
                      title={isLegendOpen ? "Hide the legend" : "What the symbols mean"}
                      aria-pressed={isLegendOpen}
                      onClick={() => setIsLegendOpen((open) => !open)}
                    >
                      <Info className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleTidyUp}
                      icon={<LayoutGrid className="h-4 w-4" aria-hidden="true" />}
                    >
                      Tidy up
                    </Button>
                  </div>
                )}
              </Panel>
            ) : null}
          </ReactFlow>

          {/*
            An empty canvas is indistinguishable from one that failed to load, and a first-time
            author has no way to guess that the way in is a panel they have not opened. This says
            both — and it does not intercept the pointer, so dropping onto it still works.
          */}
          {placedNodes.length === 0 ? (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
              <div className="max-w-sm rounded-2xl border border-dashed border-app-border bg-app-surface/90 px-6 py-5 text-center">
                <Waypoints className="mx-auto h-8 w-8 text-app-text-disabled" aria-hidden="true" />
                <p className="mt-3 text-sm font-semibold text-app-text">{emptyTitle}</p>
                <p className="mt-1 text-sm text-app-text-muted">
                  {canAuthor && createKinds.length > 0
                    ? "Double-click anywhere here to make one, or use the button above."
                    : "Nothing has been placed here yet."}
                </p>
              </div>
            </div>
          ) : null}

          {isSaving ? (
            <p className="absolute right-4 bottom-4 z-10 flex items-center gap-2 rounded-lg bg-app-surface px-3 py-2 text-xs text-app-text-muted shadow-lg">
              <Spinner size="sm" silent /> Saving graph…
            </p>
          ) : null}
          {saveError ? (
            <p
              role="alert"
              className="absolute right-4 bottom-4 z-10 max-w-sm rounded-lg bg-app-danger-bg px-3 py-2 text-xs text-app-danger-text shadow-lg"
            >
              {saveError}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/**
 * What the one relation on this canvas means, spelled out.
 *
 * Without it an arrow gets read as a suggested route and the absence of one as "do these in the
 * order they are drawn" — both wrong, and both invisible until a hire is standing in front of a
 * locked phase asking why.
 */
function GraphLegend({ editable, onClose }: { editable: boolean; onClose: () => void }) {
  return (
    <div className="relative flex max-w-96 flex-col gap-2 rounded-xl border border-app-border bg-app-surface/95 p-3 pr-8 text-[11px] leading-snug text-app-text-muted shadow-md backdrop-blur">
      <button
        type="button"
        onClick={onClose}
        aria-label="Hide the legend"
        className="absolute top-2 right-2 rounded p-0.5 text-app-text-subtle transition-colors hover:text-app-text focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <span className="flex items-center gap-2">
        <svg width="34" height="10" aria-hidden="true" className="shrink-0 overflow-visible">
          <defs>
            <marker
              id="legend-arrow"
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="2.5"
              orient="auto"
            >
              <path d="M0,0 L0,5 L7,2.5 z" className="fill-app-text-muted" />
            </marker>
          </defs>
          {/* The same curve the canvas draws, so the legend explains what is actually on screen. */}
          <path
            d="M0,9 C10,9 16,1 26,1"
            fill="none"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="stroke-app-text-muted"
            markerEnd="url(#legend-arrow)"
          />
        </svg>
        {LOCK_SENTENCE}
      </span>
      <span className="flex items-center gap-2">
        <Flag className="h-3.5 w-3.5 shrink-0 text-app-brand" aria-hidden="true" />
        Nothing has to happen before these — any of them is a place to start.
      </span>
      <span className="flex items-center gap-2">
        <KeyRound className="h-3.5 w-3.5 shrink-0 text-app-text-muted" aria-hidden="true" />
        &ldquo;Only for &hellip;&rdquo; is the other kind of lock: a skill or role gate, so the node
        opens for some people and not others.
      </span>
      <span>
        Nodes with no arrow between them are in <strong className="font-semibold">no</strong>{" "}
        particular order, and say so. &ldquo;2 of 4&rdquo; counts only within one chain.
      </span>
      {editable ? (
        <span className="text-app-text-subtle">
          Click a node to edit it, double-click the canvas to make one. To lock one behind another,
          drag from a dot on the edge of the first to the second — any of the four sides. An arrow
          can be dragged by either end onto a different node, or selected and removed with
          Backspace.
        </span>
      ) : null}
    </div>
  );
}

/** The four sides a card can be connected on, and where React Flow puts each one. */
const SIDE_HANDLES: { side: GraphSide; position: Position }[] = [
  { side: "left", position: Position.Left },
  { side: "right", position: Position.Right },
  { side: "top", position: Position.Top },
  { side: "bottom", position: Position.Bottom },
];

/** React Flow reports the side an endpoint landed on in its own vocabulary; this is ours. */
const SIDE_BY_POSITION: Record<Position, GraphSide> = {
  [Position.Left]: "left",
  [Position.Right]: "right",
  [Position.Top]: "top",
  [Position.Bottom]: "bottom",
};

/**
 * An edge, drawn on the geometry in `graphLayout` rather than on one of React Flow's own shapes.
 *
 * `BaseEdge` is the library's own path element, so selection, focus and the Backspace-to-unlock
 * handling keep working; only the `d` is ours. The interaction stroke is widened well past the
 * visible one, because a two-pixel curve is not a thing anybody can click.
 */
function BlueprintFlowEdge({
  id,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  markerEnd,
  style,
  selected,
}: EdgeProps) {
  const [isHovered, setIsHovered] = useState(false);
  const path = blueprintEdgePath(
    { x: sourceX, y: sourceY },
    { x: targetX, y: targetY },
    { source: SIDE_BY_POSITION[sourcePosition], target: SIDE_BY_POSITION[targetPosition] },
  );

  const width = typeof style?.strokeWidth === "number" ? style.strokeWidth : 2;
  const emphasised = selected === true || isHovered;

  return (
    <g>
      {/*
        A wash of the edge's own colour under it, drawn only while the edge is the one being
        pointed at or worked on. A line that answers a hover by getting one pixel thicker has not
        answered it — this is wide enough to see from the other end of the arrow, which is where
        somebody looking for where it goes is looking.
      */}
      {emphasised ? (
        <path
          d={path}
          fill="none"
          stroke={style?.stroke}
          strokeWidth={width + 7}
          strokeLinecap="round"
          opacity={0.2}
          style={{ pointerEvents: "none" }}
        />
      ) : null}

      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={{ ...style, strokeWidth: emphasised ? width + 1 : width }}
        interactionWidth={20}
      />

      {/* The hit area, wider than the line. A two-pixel curve is not a thing anybody can hover. */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={22}
        style={{ pointerEvents: "stroke", cursor: "pointer" }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />
    </g>
  );
}

/**
 * The React Flow wrapper around a domain card: the handles, the entry-point marker and the dimming.
 *
 * Kept referentially stable — see the ref dance in the surface above — so a node is never remounted
 * mid-drag.
 */
function BlueprintFlowNodeCard({ id, data, selected }: NodeProps<BlueprintFlowNode>) {
  // `nodrag` keeps React Flow from starting a node drag when the pointer goes down on the control.
  const openControl = data.onOpen ? (
    <span className="nodrag absolute -top-2.5 right-2 z-10 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
      <Button
        variant="secondary"
        size="sm"
        iconOnly
        aria-label={data.openLabel}
        title={data.openLabel}
        onClick={(event) => {
          event.stopPropagation();
          data.onOpen?.();
        }}
      >
        <Maximize2 className="h-3.5 w-3.5" />
      </Button>
    </span>
  ) : null;

  return (
    <div
      data-testid={`graph-node-${id}`}
      className={`group relative transition-opacity duration-200 ${
        data.dimmed ? "opacity-35" : "opacity-100"
      }`}
      style={{ width: GRAPH_NODE_WIDTH }}
      aria-label={data.ariaLabel}
    >
      {/*
        One handle per side, always rendered — even read-only. React Flow anchors an edge to a
        handle, so a node without them has nowhere for an arrow to end, which is why the hire's
        view once drew no arrows at all. Read-only makes them invisible and refuses connections
        rather than removing them.

        `ConnectionMode.Loose` on the canvas is what lets one handle per side do the work of two:
        every handle both starts a connection and accepts one, so an author drags between whichever
        two sides face each other instead of hunting for the out dot and then the in dot.
      */}
      {SIDE_HANDLES.map(({ side, position }) => (
        <Handle
          key={side}
          id={side}
          type="source"
          position={position}
          isConnectable={data.hasHandles}
          className={
            data.hasHandles
              ? // Shown on approach rather than always: four dots on every card is sixty-four dots
                // on a sixteen-phase graph, and an author only needs the ones they are aiming at.
                "!h-3 !w-3 !border-2 !border-app-brand !bg-app-surface !opacity-0 transition-opacity group-focus-within:!opacity-100 group-hover:!opacity-100"
              : "!h-1 !w-1 !border-0 !bg-transparent !opacity-0"
          }
        />
      ))}

      <div
        className={
          selected
            ? "rounded-xl shadow-lg ring-2 ring-app-focus ring-offset-2 ring-offset-app-bg transition-transform"
            : "transition-transform"
        }
      >
        {data.render()}
      </div>

      {openControl}

      {data.isEntryPoint ? (
        <span className="pointer-events-none absolute -top-2.5 left-3 z-10">
          <Badge variant="brand" size="sm" className="gap-1 shadow-sm">
            <Flag className="h-3 w-3" aria-hidden="true" /> Start
          </Badge>
        </span>
      ) : null}
    </div>
  );
}
