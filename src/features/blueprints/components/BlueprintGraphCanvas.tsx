import { useCallback, useEffect, useMemo, useState, type DragEvent, type ReactNode } from "react";
import {
  Background,
  BackgroundVariant,
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
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { Badge } from "../../../components/ui/Badge.tsx";
import { Button } from "../../../components/ui/Button.tsx";
import { Spinner } from "../../../components/ui/Spinner.tsx";
import { useFocusMode } from "../../../context/useFocusMode.ts";
import {
  COMPACT_DETAIL_ZOOM,
  EDGE_REFUSAL_MESSAGE,
  GRAPH_NODE_HEIGHT,
  GRAPH_NODE_WIDTH,
  autoLayoutPositions,
  canConnect,
  chainFor,
  chainPositions,
  edgeRefusal,
  entryPointIds,
  withFallbackPositions,
  type ChainPosition,
} from "./graphLayout.ts";

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
   * a description is a grey smear nobody reads. Cards drop to their title alone below
   * {@link COMPACT_DETAIL_ZOOM}.
   */
  detail: "full" | "compact";
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
   * Where this node sits in the chain it belongs to, or `undefined` when it belongs to none.
   *
   * Absent is the common case and it means something: this node is in no particular order relative
   * to anything else, and the card says so rather than leaving the reader to guess.
   */
  chainPosition?: ChainPosition;
};

type LibraryTemplate = { id: string; title: string; description: string };

type Props<TNode extends BlueprintGraphCanvasNode> = {
  nodes: TNode[];
  title: string;
  description: string;
  headerAction?: ReactNode;
  libraryTitle: string;
  libraryDescription: string;
  libraryEmptyMessage: string;
  libraryTemplates?: LibraryTemplate[];
  editable: boolean;
  /** Hides the authoring library when the canvas is reused as a read-only viewer. */
  showLibrary?: boolean;
  ariaLabel?: string;
  onNodeClick: (node: TNode) => void;
  onOpenNode?: (node: TNode) => void;
  onPositionChange: (node: TNode, x: number, y: number) => Promise<void>;
  onRemoveNode: (node: TNode) => Promise<void>;
  onAddBlocker: (node: TNode, blockerId: string) => Promise<void>;
  onRemoveBlocker: (node: TNode, blockerId: string) => Promise<void>;
  onCreateFromLibrary?: (templateId: string, x: number, y: number) => Promise<void>;
  renderNode: (node: TNode, props: BlueprintGraphCanvasNodeProps) => ReactNode;
};

const LIBRARY_NODE_MIME = "application/x-blueprint-node";
const LIBRARY_TEMPLATE_MIME = "application/x-blueprint-template";

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
  libraryTitle,
  libraryDescription,
  libraryEmptyMessage,
  libraryTemplates = [],
  editable,
  showLibrary = true,
  ariaLabel = "Blueprint graph canvas",
  onNodeClick,
  onOpenNode,
  onPositionChange,
  onRemoveNode,
  onAddBlocker,
  onRemoveBlocker,
  onCreateFromLibrary,
  renderNode,
}: Props<TNode>) {
  const { screenToFlowPosition, fitView } = useReactFlow();
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
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // A surface with no library has nowhere to put an unplaced node, so it draws every node and lets
  // `withFallbackPositions` find a free cell for the ones the author never dragged. A personalized
  // path copied from a blueprint whose graph was never opened is exactly that case, and an empty
  // canvas is the wrong answer to it.
  const placedNodes = useMemo(
    () =>
      showLibrary ? nodes.filter((node) => node.graphX !== null && node.graphY !== null) : nodes,
    [nodes, showLibrary],
  );
  const libraryNodes = useMemo(
    () => (showLibrary ? nodes.filter((node) => node.graphX === null || node.graphY === null) : []),
    [nodes, showLibrary],
  );
  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

  const entryPoints = useMemo(() => entryPointIds(placedNodes), [placedNodes]);
  const chainPositionById = useMemo(() => chainPositions(placedNodes), [placedNodes]);
  const chainIds = useMemo(
    () => (selectedId ? chainFor(placedNodes, selectedId) : null),
    [placedNodes, selectedId],
  );

  const detail: "full" | "compact" = zoom < COMPACT_DETAIL_ZOOM ? "compact" : "full";

  // Stable for the life of the canvas: React Flow remounts every node when `nodeTypes` changes
  // identity, which would end a drag the moment it started.
  const nodeTypes = useMemo<NodeTypes>(() => ({ blueprint: BlueprintFlowNodeCard }), []);

  const computedNodes = useMemo<BlueprintFlowNode[]>(
    () => {
      const positions = withFallbackPositions(placedNodes);

      return placedNodes.map((node) => {
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
            dimmed: chainIds !== null && !chainIds.has(node.id),
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
      entryPoints,
      chainIds,
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
        .map((blockerId) => ({
          id: `${blockerId}->${node.id}`,
          source: blockerId,
          target: node.id,
          type: "smoothstep" as const,
          focusable: true,
          deletable: editable,
          style: {
            // React Flow's own stroke is a fixed light grey that vanishes on the dark theme, so
            // the edge carries the brand token and a weight that survives being zoomed out.
            stroke: "var(--color-app-brand)",
            strokeWidth: 2,
            opacity:
              chainIds !== null && !(chainIds.has(blockerId) && chainIds.has(node.id)) ? 0.15 : 1,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 18,
            height: 18,
            color: "var(--color-app-brand)",
          },
          ariaLabel: `${nodeById.get(blockerId)?.title ?? "A node"} must be finished before ${node.title}`,
        })),
    );
  }, [placedNodes, chainIds, editable, nodeById]);

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
      void runMutation(
        () =>
          onPositionChange(
            node,
            Math.round(dragged.position.x + GRAPH_NODE_WIDTH / 2),
            Math.round(dragged.position.y + GRAPH_NODE_HEIGHT / 2),
          ),
        "The node position could not be saved.",
      );
    },
    [nodeById, onPositionChange, runMutation],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      const templateId = event.dataTransfer.getData(LIBRARY_TEMPLATE_MIME);
      const nodeId = event.dataTransfer.getData(LIBRARY_NODE_MIME);
      if (!templateId && !nodeId) return;

      event.preventDefault();
      // The pointer holds the middle of the card, and the stored coordinate is its centre — so the
      // drop point is the coordinate, with no corner arithmetic in between.
      const centre = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      const x = Math.round(centre.x);
      const y = Math.round(centre.y);

      if (templateId && onCreateFromLibrary) {
        void runMutation(
          () => onCreateFromLibrary(templateId, x, y),
          "The node could not be created.",
        );
        return;
      }

      const node = nodeById.get(nodeId);
      if (!node) return;
      void runMutation(
        () => onPositionChange(node, x, y),
        "The node could not be placed on the canvas.",
      );
    },
    [nodeById, onCreateFromLibrary, onPositionChange, runMutation, screenToFlowPosition],
  );

  const handleReturnToLibrary = useCallback(
    (event: DragEvent<HTMLElement>) => {
      const nodeId = event.dataTransfer.getData(LIBRARY_NODE_MIME);
      if (!nodeId) return;
      event.preventDefault();
      const node = nodeById.get(nodeId);
      if (!node) return;
      void runMutation(() => onRemoveNode(node), "The node could not be returned to the library.");
    },
    [nodeById, onRemoveNode, runMutation],
  );

  /** Lays every placed node out again and saves the ones that actually moved. */
  const handleTidyUp = useCallback(() => {
    const laidOut = autoLayoutPositions(placedNodes);

    void runMutation(async () => {
      for (const node of placedNodes) {
        const target = laidOut[node.id];
        if (!target) continue;
        const x = Math.round(target.x);
        const y = Math.round(target.y);
        if (node.graphX === x && node.graphY === y) continue;
        await onPositionChange(node, x, y);
      }
      // The nodes have all moved; the view that framed the old arrangement no longer frames this one.
      window.requestAnimationFrame(
        () => void fitView({ padding: 0.15, maxZoom: 1, duration: 240 }),
      );
    }, "The layout could not be saved.");
  }, [fitView, onPositionChange, placedNodes, runMutation]);

  const canAuthor = editable && !isSaving;

  return (
    <section
      className={
        isFocused
          ? "flex h-[calc(100vh-4.5rem)] flex-col overflow-hidden bg-app-surface"
          : "overflow-hidden rounded-2xl border border-app-border bg-app-surface shadow-sm"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-app-border px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-app-text">{title}</h2>
          <p className="mt-1 text-sm text-app-text-muted">{description}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {headerAction}
          <Button
            variant="secondary"
            size="sm"
            aria-pressed={isFocused}
            icon={isFocused ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            onClick={() => setFocused(!isFocused)}
          >
            {isFocused ? "Collapse" : "Expand"}
          </Button>
        </div>
      </div>

      <GraphLegend editable={editable} />

      <div
        className={`relative flex min-h-0 ${
          isFocused ? "flex-1" : "h-[clamp(34rem,calc(100vh-21rem),60rem)]"
        }`}
      >
        {showLibrary ? (
          <LibraryPanel
            isOpen={isLibraryOpen}
            onToggle={() => setIsLibraryOpen((current) => !current)}
            title={libraryTitle}
            description={libraryDescription}
            emptyMessage={libraryEmptyMessage}
            templates={canAuthor && onCreateFromLibrary ? libraryTemplates : []}
            nodes={libraryNodes}
            canAuthor={canAuthor}
            onReturnToLibrary={handleReturnToLibrary}
            renderNode={(node) =>
              renderNode(node, {
                disabled: isSaving,
                detail: "full",
                zoom: 1,
                inLibrary: true,
                onClick: () => onNodeClick(node),
                onOpen: undefined,
              })
            }
          />
        ) : null}

        <div
          className="relative min-w-0 flex-1"
          role="application"
          aria-label={ariaLabel}
          data-testid="blueprint-graph-canvas"
          onDragOver={(event) => {
            if (!canAuthor) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
          }}
          onDrop={handleDrop}
        >
          <ReactFlow
            nodes={flowNodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onNodeDragStop={handleNodeDragStop}
            onNodeClick={(_event, node) => setSelectedId(node.id)}
            onPaneClick={() => setSelectedId(null)}
            onConnect={handleConnect}
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
            connectionRadius={30}
            minZoom={0.2}
            maxZoom={1.8}
            fitView
            fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
            proOptions={{ hideAttribution: false }}
          >
            <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
            <Controls showInteractive={false} />
            {/*
              React Flow's minimap ships a white panel and grey nodes, which on the dark theme is a
              bright rectangle in the corner. Tokens instead, and small: it is an overview, not a
              second canvas.
            */}
            <MiniMap
              pannable
              zoomable
              ariaLabel="Graph overview"
              className="!right-3 !bottom-3 !m-0 !h-24 !w-40 overflow-hidden !rounded-xl !border !border-app-border !bg-app-surface shadow-sm"
              maskColor="var(--color-app-bg)"
              nodeColor="var(--color-app-brand)"
              nodeStrokeColor="var(--color-app-border)"
            />

            {canAuthor ? (
              <Panel position="top-right">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleTidyUp}
                  icon={<LayoutGrid className="h-4 w-4" aria-hidden="true" />}
                >
                  Tidy up
                </Button>
              </Panel>
            ) : null}
          </ReactFlow>

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
function GraphLegend({ editable }: { editable: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-app-border bg-app-surface-muted px-5 py-3 text-xs text-app-text-muted">
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
          <line
            x1="0"
            y1="5"
            x2="26"
            y2="5"
            strokeWidth="1.5"
            className="stroke-app-text-muted"
            markerEnd="url(#legend-arrow)"
          />
        </svg>
        An arrow is a lock: the node it points at stays closed until the other is finished.
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
          Click a node to edit it. Drag right handle → left handle to lock; select an arrow and
          press Backspace to unlock.
        </span>
      ) : null}
    </div>
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
      className={`group relative transition-opacity ${data.dimmed ? "opacity-25" : "opacity-100"}`}
      style={{ width: GRAPH_NODE_WIDTH }}
      aria-label={data.ariaLabel}
    >
      {/*
        Always rendered, even read-only. React Flow anchors an edge to its handles, so a node
        without them has nowhere for an arrow to end — which is why the hire's view drew no
        arrows at all. Read-only hides the dot and refuses connections instead of removing it.
      */}
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={data.hasHandles}
        className={
          data.hasHandles
            ? "!h-3 !w-3 !border-2 !border-app-brand !bg-app-surface"
            : "!h-1 !w-1 !border-0 !bg-transparent !opacity-0"
        }
      />

      <div
        className={
          selected ? "rounded-xl ring-2 ring-app-focus ring-offset-2 ring-offset-app-bg" : undefined
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

      <Handle
        type="source"
        position={Position.Right}
        isConnectable={data.hasHandles}
        className={
          data.hasHandles
            ? "!h-3 !w-3 !border-2 !border-app-brand !bg-app-surface"
            : "!h-1 !w-1 !border-0 !bg-transparent !opacity-0"
        }
      />
    </div>
  );
}

/** The drawer of nodes that are not on the canvas, and the tiles that create new ones. */
function LibraryPanel<TNode extends BlueprintGraphCanvasNode>({
  isOpen,
  onToggle,
  title,
  description,
  emptyMessage,
  templates,
  nodes,
  canAuthor,
  onReturnToLibrary,
  renderNode,
}: {
  isOpen: boolean;
  onToggle: () => void;
  title: string;
  description: string;
  emptyMessage: string;
  templates: LibraryTemplate[];
  nodes: TNode[];
  canAuthor: boolean;
  onReturnToLibrary: (event: DragEvent<HTMLElement>) => void;
  renderNode: (node: TNode) => ReactNode;
}) {
  return (
    <div className="relative z-10 flex shrink-0">
      <aside
        className={`flex h-full flex-col overflow-hidden border-r border-app-border bg-app-surface-muted transition-[width] duration-200 ease-out ${
          isOpen ? "w-72 p-4" : "w-0 p-0"
        }`}
        aria-hidden={!isOpen}
        onDragOver={(event) => {
          if (!canAuthor) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        }}
        onDrop={onReturnToLibrary}
      >
        {isOpen ? (
          <>
            <h3 className="text-sm font-semibold text-app-text">{title}</h3>
            <p className="mt-1 text-xs text-app-text-muted">{description}</p>

            <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
              {nodes.length === 0 ? (
                <p className="text-xs text-app-text-muted">{emptyMessage}</p>
              ) : (
                nodes.map((node) => (
                  <div
                    key={node.id}
                    draggable={canAuthor}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData(LIBRARY_NODE_MIME, node.id);
                    }}
                    className={canAuthor ? "cursor-grab active:cursor-grabbing" : undefined}
                  >
                    {renderNode(node)}
                  </div>
                ))
              )}
            </div>

            {templates.length > 0 ? (
              <div className="mt-4 border-t border-app-border pt-4">
                <p className="text-xs font-medium text-app-text-muted">Create on canvas</p>
                <div className="mt-2 space-y-2">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      draggable
                      aria-label={`Drag ${template.title} onto the canvas to create it`}
                      className="cursor-grab rounded-xl border border-dashed border-app-border bg-app-surface p-3 active:cursor-grabbing"
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "copy";
                        event.dataTransfer.setData(LIBRARY_TEMPLATE_MIME, template.id);
                      }}
                    >
                      <p className="text-sm font-semibold text-app-text">{template.title}</p>
                      <p className="mt-1 text-xs text-app-text-muted">{template.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </aside>

      <div className="absolute top-3 left-full z-20 ml-2">
        <Button
          variant="secondary"
          size="sm"
          iconOnly
          aria-label={isOpen ? `Collapse ${title.toLowerCase()}` : `Expand ${title.toLowerCase()}`}
          aria-expanded={isOpen}
          onClick={onToggle}
        >
          {isOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
