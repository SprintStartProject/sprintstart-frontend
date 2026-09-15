import { Maximize2, Minimize2, Minus, Plus, Scan, Trash2 } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { collectDownstream, collectUpstream, type GraphPoint, type LayoutNode } from "./layout";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type Viewport = { x: number; y: number; zoom: number };

/** How an edge is drawn: satisfied, the one being worked through right now, or still waiting. */
export type JourneyEdgeTone = "done" | "active" | "waiting";

/** How a node relates to the one under the pointer or selected. */
export type JourneyNodeEmphasis = "focus" | "related" | "dimmed" | "none";

export type JourneyNodeRenderState = {
  selected: boolean;
  emphasis: JourneyNodeEmphasis;
  dragging: boolean;
};

type Props<TNode extends LayoutNode> = {
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
  // ── Editing ──
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
};

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 1.75;
const DRAG_THRESHOLD_PX = 4;
const FIT_PADDING_PX = 72;
const SNAP = 10;

const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

/** The S-curve from the bottom of a blocker to the top of what waits on it. */
function edgePath(from: GraphPoint, to: GraphPoint): string {
  const bend = Math.max(56, Math.abs(to.y - from.y) / 2);
  return `M ${from.x} ${from.y} C ${from.x} ${from.y + bend}, ${to.x} ${to.y - bend}, ${to.x} ${to.y}`;
}

/** Point halfway along the S-curve (the cubic at t = 0.5). */
function edgeMidpoint(from: GraphPoint, to: GraphPoint): GraphPoint {
  return { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
}

/**
 * A pan-and-zoom canvas for onboarding graphs.
 *
 * Built for reading first: a graph opens fitted to the screen, the node under the pointer lights up
 * everything it waits on and everything it unlocks, and edges say whether they are satisfied. Editing
 * sits on top of the same canvas -- dragging nodes, drawing edges from a node's port -- and is only
 * switched on by the caller.
 *
 * **Gestures follow the design tools people already know.** Two fingers on a trackpad pan, a pinch
 * (which browsers report as a wheel event with `ctrlKey`) zooms around the pointer, and dragging the
 * background pans. The wheel is consumed here and not passed on, so a two-finger swipe inside the
 * graph moves the graph rather than switching the page's tabs.
 *
 * Nodes are HTML, not SVG, so a card can use the same components as the rest of the app; only the
 * edges are SVG. All positions are world coordinates, and one transform on one layer maps them to the
 * screen -- which is what keeps a hundred nodes cheap to pan.
 */
export function JourneyCanvas<TNode extends LayoutNode>({
  nodes,
  positions,
  nodeSize,
  renderNode,
  nodeLabel,
  edgeTone,
  ariaLabel,
  selectedId = null,
  onSelect,
  onOpen,
  focusId = null,
  fitKey,
  canMove = false,
  onMove,
  canConnect = false,
  onConnect,
  onDisconnect,
  onCanvasDoubleClick,
  toolbar,
  overlay,
  aside,
  heightClassName = "h-[36rem]",
}: Props<TNode>) {
  const markerId = useId().replace(/:/g, "");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [dragOverride, setDragOverride] = useState<{ id: string; position: GraphPoint } | null>(
    null,
  );
  const [connection, setConnection] = useState<{ sourceId: string; pointer: GraphPoint } | null>(
    null,
  );
  const [selectedEdge, setSelectedEdge] = useState<{ blockerId: string; nodeId: string } | null>(
    null,
  );

  // Gesture bookkeeping lives in a ref: it changes on every pointer move, and none of it is drawn.
  const gestureRef = useRef<
    | { kind: "pan"; pointerId: number; startX: number; startY: number; origin: Viewport; moved: boolean; nodeId: string | null }
    | { kind: "node"; pointerId: number; startX: number; startY: number; nodeId: string; origin: GraphPoint; moved: boolean }
    | { kind: "connect"; pointerId: number; sourceId: string }
    | null
  >(null);

  const positionOf = useCallback(
    (id: string): GraphPoint | undefined =>
      dragOverride?.id === id ? dragOverride.position : positions.get(id),
    [dragOverride, positions],
  );

  // ── Size & fit ─────────────────────────────────────────────

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const update = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [expanded]);

  const bounds = useMemo(() => {
    const points = [...positions.values()];
    if (!points.length) return null;
    const halfWidth = nodeSize.width / 2;
    const halfHeight = nodeSize.height / 2;
    return {
      minX: Math.min(...points.map((point) => point.x)) - halfWidth,
      maxX: Math.max(...points.map((point) => point.x)) + halfWidth,
      minY: Math.min(...points.map((point) => point.y)) - halfHeight,
      maxY: Math.max(...points.map((point) => point.y)) + halfHeight,
    };
  }, [nodeSize.height, nodeSize.width, positions]);

  const fit = useCallback(
    (preferFocus: boolean) => {
      if (!bounds || !size.width || !size.height) return;
      const width = bounds.maxX - bounds.minX;
      const height = bounds.maxY - bounds.minY;
      const zoom = clampZoom(
        Math.min(
          (size.width - FIT_PADDING_PX * 2) / Math.max(width, 1),
          (size.height - FIT_PADDING_PX * 2) / Math.max(height, 1),
          1,
        ),
      );
      const focus = preferFocus && focusId ? positions.get(focusId) : undefined;
      // A graph that only fits at a size nobody can read opens on the node that matters instead.
      if (focus && zoom < 0.45) {
        const readable = 0.75;
        setViewport({
          zoom: readable,
          x: size.width / 2 - focus.x * readable,
          // A third of the way down: what a node leads to is below it, and that is what matters next.
          y: size.height / 3 - focus.y * readable,
        });
        return;
      }
      setViewport({
        zoom,
        x: size.width / 2 - ((bounds.minX + bounds.maxX) / 2) * zoom,
        y: size.height / 2 - ((bounds.minY + bounds.maxY) / 2) * zoom,
      });
    },
    [bounds, focusId, positions, size.height, size.width],
  );

  // Refit when the graph itself changes or the canvas first gets a size -- not on every position
  // change, or dragging a node would yank the view out from under the pointer.
  const fittedRef = useRef<string | null>(null);
  useLayoutEffect(() => {
    const key = `${fitKey}|${expanded}|${size.width > 0}`;
    if (!size.width || fittedRef.current === key) return;
    fittedRef.current = key;
    fit(true);
  }, [expanded, fit, fitKey, size.width]);

  const zoomAround = useCallback((factor: number, screenX: number, screenY: number) => {
    setViewport((current) => {
      const zoom = clampZoom(current.zoom * factor);
      const worldX = (screenX - current.x) / current.zoom;
      const worldY = (screenY - current.y) / current.zoom;
      return { zoom, x: screenX - worldX * zoom, y: screenY - worldY * zoom };
    });
  }, []);

  // ── Wheel: two-finger pan, pinch zoom ──────────────────────

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      // Keep the gesture inside the graph; the page around it treats horizontal swipes as tab switches.
      event.stopPropagation();
      const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? size.height : 1;
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
  }, [expanded, size.height, zoomAround]);

  // ── Pointer gestures ───────────────────────────────────────

  const toWorld = (clientX: number, clientY: number): GraphPoint => {
    const rect = containerRef.current?.getBoundingClientRect();
    const left = rect?.left ?? 0;
    const top = rect?.top ?? 0;
    return {
      x: (clientX - left - viewport.x) / viewport.zoom,
      y: (clientY - top - viewport.y) / viewport.zoom,
    };
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest("[data-canvas-control]")) return;

    const port = target.closest<HTMLElement>("[data-port-for]");
    if (port && canConnect) {
      event.preventDefault();
      const sourceId = port.dataset.portFor!;
      gestureRef.current = { kind: "connect", pointerId: event.pointerId, sourceId };
      setConnection({ sourceId, pointer: toWorld(event.clientX, event.clientY) });
      event.currentTarget.setPointerCapture?.(event.pointerId);
      return;
    }

    const nodeElement = target.closest<HTMLElement>("[data-journey-node]");
    const nodeId = nodeElement?.dataset.journeyNode ?? null;
    setSelectedEdge(null);

    if (nodeId && canMove) {
      const origin = positions.get(nodeId);
      if (origin) {
        gestureRef.current = {
          kind: "node",
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          nodeId,
          origin,
          moved: false,
        };
        event.currentTarget.setPointerCapture?.(event.pointerId);
        return;
      }
    }

    gestureRef.current = {
      kind: "pan",
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: viewport,
      moved: false,
      nodeId,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;

    if (gesture.kind === "connect") {
      setConnection({ sourceId: gesture.sourceId, pointer: toWorld(event.clientX, event.clientY) });
      return;
    }

    const deltaX = event.clientX - gesture.startX;
    const deltaY = event.clientY - gesture.startY;
    if (!gesture.moved && Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD_PX) return;
    gesture.moved = true;

    if (gesture.kind === "pan") {
      setViewport({ ...gesture.origin, x: gesture.origin.x + deltaX, y: gesture.origin.y + deltaY });
      return;
    }

    setDragOverride({
      id: gesture.nodeId,
      position: {
        x: gesture.origin.x + deltaX / viewport.zoom,
        y: gesture.origin.y + deltaY / viewport.zoom,
      },
    });
  };

  const finishGesture = (event: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    gestureRef.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }

    if (gesture.kind === "connect") {
      setConnection(null);
      if (cancelled) return;
      const dropTarget = document
        .elementFromPoint?.(event.clientX, event.clientY)
        ?.closest<HTMLElement>("[data-journey-node]");
      const nodeId = dropTarget?.dataset.journeyNode;
      if (nodeId && nodeId !== gesture.sourceId) onConnect?.(gesture.sourceId, nodeId);
      return;
    }

    if (gesture.kind === "node") {
      if (gesture.moved && !cancelled && dragOverride) {
        const snapped = {
          x: Math.round(dragOverride.position.x / SNAP) * SNAP,
          y: Math.round(dragOverride.position.y / SNAP) * SNAP,
        };
        onMove?.(gesture.nodeId, snapped);
      } else if (!gesture.moved && !cancelled) {
        onSelect?.(gesture.nodeId === selectedId ? null : gesture.nodeId);
      }
      setDragOverride(null);
      return;
    }

    if (!gesture.moved && !cancelled) {
      onSelect?.(gesture.nodeId && gesture.nodeId !== selectedId ? gesture.nodeId : null);
    }
  };

  const handleDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("[data-canvas-control]")) return;
    const nodeId = target.closest<HTMLElement>("[data-journey-node]")?.dataset.journeyNode;
    if (nodeId) {
      onOpen?.(nodeId);
      return;
    }
    if (onCanvasDoubleClick) {
      const world = toWorld(event.clientX, event.clientY);
      onCanvasDoubleClick({ x: Math.round(world.x / SNAP) * SNAP, y: Math.round(world.y / SNAP) * SNAP });
    }
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const nodeId = target.dataset?.journeyNode;
    if (nodeId && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      if (event.key === "Enter" && onOpen) onOpen(nodeId);
      else onSelect?.(nodeId === selectedId ? null : nodeId);
      return;
    }
    if (event.key === "Escape") {
      if (expanded) setExpanded(false);
      else onSelect?.(null);
      return;
    }
    if (target.closest("input, textarea, select")) return;
    if (event.key === "+" || event.key === "=") zoomAround(1.2, size.width / 2, size.height / 2);
    else if (event.key === "-") zoomAround(1 / 1.2, size.width / 2, size.height / 2);
    else if (event.key === "0") fit(false);
    else if (event.key === "Delete" || event.key === "Backspace") {
      if (selectedEdge && onDisconnect) {
        onDisconnect(selectedEdge.blockerId, selectedEdge.nodeId);
        setSelectedEdge(null);
      }
    }
  };

  // Close the expanded view with Escape even while focus is outside the canvas.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  // ── Emphasis ───────────────────────────────────────────────

  const emphasisSourceId = dragOverride ? null : (hoveredId ?? selectedId);
  const related = useMemo(() => {
    if (!emphasisSourceId) return null;
    return new Set([
      ...collectUpstream(nodes, emphasisSourceId),
      ...collectDownstream(nodes, emphasisSourceId),
    ]);
  }, [emphasisSourceId, nodes]);

  const emphasisOf = (id: string): JourneyNodeEmphasis => {
    if (!emphasisSourceId || !related) return "none";
    if (id === emphasisSourceId) return "focus";
    return related.has(id) ? "related" : "dimmed";
  };

  // ── Edges ──────────────────────────────────────────────────

  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const edges = nodes.flatMap((node) =>
    node.blockerIds
      .filter((blockerId) => nodeById.has(blockerId) && blockerId !== node.id)
      .map((blockerId) => {
        const blockerPosition = positionOf(blockerId);
        const nodePosition = positionOf(node.id);
        if (!blockerPosition || !nodePosition) return null;
        const from = { x: blockerPosition.x, y: blockerPosition.y + nodeSize.height / 2 };
        const to = { x: nodePosition.x, y: nodePosition.y - nodeSize.height / 2 - 6 };
        const tone = edgeTone?.(nodeById.get(blockerId)!, node) ?? "waiting";
        const inChain =
          !!emphasisSourceId &&
          (blockerId === emphasisSourceId || related?.has(blockerId) || false) &&
          (node.id === emphasisSourceId || related?.has(node.id) || false);
        return { blockerId, nodeId: node.id, from, to, tone, inChain };
      })
      .filter((edge): edge is NonNullable<typeof edge> => edge !== null),
  );

  const selectedEdgeData = selectedEdge
    ? edges.find(
        (edge) => edge.blockerId === selectedEdge.blockerId && edge.nodeId === selectedEdge.nodeId,
      )
    : undefined;

  const connectionSource = connection ? positionOf(connection.sourceId) : undefined;

  // ── Minimap ────────────────────────────────────────────────

  const minimap = useMemo(() => {
    if (!bounds || nodes.length < 4) return null;
    const width = 168;
    const height = 104;
    const graphWidth = bounds.maxX - bounds.minX;
    const graphHeight = bounds.maxY - bounds.minY;
    const scale = Math.min((width - 12) / Math.max(graphWidth, 1), (height - 12) / Math.max(graphHeight, 1));
    const offsetX = (width - graphWidth * scale) / 2 - bounds.minX * scale;
    const offsetY = (height - graphHeight * scale) / 2 - bounds.minY * scale;
    return { width, height, scale, offsetX, offsetY };
  }, [bounds, nodes.length]);

  const gridSize = 24 * viewport.zoom;

  const canvas = (
    <div
      className={`relative overflow-hidden rounded-3xl border border-app-border bg-app-bg-soft ${
        expanded ? "h-full" : heightClassName
      }`}
    >
      <div
        ref={containerRef}
        role="application"
        aria-label={ariaLabel}
        aria-roledescription="graph"
        tabIndex={0}
        className="absolute inset-0 cursor-grab touch-none select-none focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none focus-visible:ring-inset active:cursor-grabbing"
        style={{
          backgroundImage: "radial-gradient(var(--color-app-border) 1.2px, transparent 1.2px)",
          backgroundSize: `${gridSize}px ${gridSize}px`,
          backgroundPosition: `${viewport.x}px ${viewport.y}px`,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(event) => finishGesture(event, false)}
        onPointerCancel={(event) => finishGesture(event, true)}
        onDoubleClick={handleDoubleClick}
        onKeyDown={handleKeyDown}
      >
        <div
          className="absolute top-0 left-0 origin-top-left will-change-transform"
          style={{
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          }}
        >
          <svg
            className="pointer-events-none absolute top-0 left-0 overflow-visible"
            width="1"
            height="1"
            aria-hidden="true"
          >
            <defs>
              {(["done", "active", "waiting"] as const).map((tone) => (
                <marker
                  key={tone}
                  id={`${markerId}-${tone}`}
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" className={toneFill[tone]} />
                </marker>
              ))}
            </defs>
            {edges.map((edge) => {
              const d = edgePath(edge.from, edge.to);
              const isSelected =
                selectedEdge?.blockerId === edge.blockerId && selectedEdge?.nodeId === edge.nodeId;
              const dimmed = !!emphasisSourceId && !edge.inChain;
              return (
                <g key={`${edge.blockerId}->${edge.nodeId}`}>
                  <path
                    d={d}
                    fill="none"
                    strokeWidth={edge.inChain || isSelected ? 2.75 : 2}
                    strokeLinecap="round"
                    strokeDasharray={edge.tone === "waiting" ? "6 6" : edge.tone === "active" ? "10 8" : undefined}
                    markerEnd={`url(#${markerId}-${edge.tone})`}
                    className={`transition-opacity duration-200 ${toneStroke[edge.tone]} ${
                      edge.tone === "active" ? "journey-edge-flow" : ""
                    } ${isSelected ? "!stroke-app-danger-solid" : ""}`}
                    opacity={dimmed ? 0.18 : 1}
                  />
                  {canConnect ? (
                    <path
                      d={d}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={16}
                      className="pointer-events-auto cursor-pointer"
                      data-canvas-control
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        setSelectedEdge({ blockerId: edge.blockerId, nodeId: edge.nodeId });
                        onSelect?.(null);
                      }}
                    >
                      <title>Select connection</title>
                    </path>
                  ) : null}
                </g>
              );
            })}
            {connection && connectionSource ? (
              <path
                d={edgePath(
                  { x: connectionSource.x, y: connectionSource.y + nodeSize.height / 2 },
                  connection.pointer,
                )}
                fill="none"
                strokeWidth={2}
                strokeDasharray="4 6"
                className="stroke-app-brand"
                markerEnd={`url(#${markerId}-active)`}
              />
            ) : null}
          </svg>

          {nodes.map((node) => {
            const position = positionOf(node.id);
            if (!position) return null;
            const selected = node.id === selectedId;
            const dragging = dragOverride?.id === node.id;
            return (
              <div
                key={node.id}
                data-journey-node={node.id}
                role="button"
                tabIndex={0}
                aria-label={nodeLabel(node)}
                aria-pressed={selected}
                className={`group/node absolute rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-app-focus ${
                  canMove ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
                } ${dragging ? "z-30" : selected ? "z-20" : "z-10"}`}
                style={{
                  left: position.x - nodeSize.width / 2,
                  top: position.y - nodeSize.height / 2,
                  width: nodeSize.width,
                  height: nodeSize.height,
                }}
                onPointerEnter={() => setHoveredId(node.id)}
                onPointerLeave={() => setHoveredId((current) => (current === node.id ? null : current))}
                onFocus={() => setHoveredId(node.id)}
                onBlur={() => setHoveredId((current) => (current === node.id ? null : current))}
              >
                {renderNode(node, { selected, emphasis: emphasisOf(node.id), dragging })}
                {canConnect ? (
                  <span
                    data-port-for={node.id}
                    title="Drag to what this unlocks"
                    className="absolute -bottom-2.5 left-1/2 z-10 flex h-5 w-5 -translate-x-1/2 cursor-crosshair items-center justify-center rounded-full border-2 border-app-brand bg-app-surface opacity-0 shadow-sm transition-opacity group-hover/node:opacity-100 group-focus-visible/node:opacity-100"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-app-brand" />
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>

        {selectedEdgeData && onDisconnect ? (
          <div
            data-canvas-control
            className="absolute z-40 -translate-x-1/2 -translate-y-1/2"
            style={{
              left: edgeMidpoint(selectedEdgeData.from, selectedEdgeData.to).x * viewport.zoom + viewport.x,
              top: edgeMidpoint(selectedEdgeData.from, selectedEdgeData.to).y * viewport.zoom + viewport.y,
            }}
          >
            <button
              type="button"
              onClick={() => {
                onDisconnect(selectedEdgeData.blockerId, selectedEdgeData.nodeId);
                setSelectedEdge(null);
              }}
              className="flex items-center gap-1.5 rounded-full border border-app-danger-border bg-app-surface px-3 py-1.5 text-xs font-semibold text-app-danger-text shadow-lg hover:bg-app-danger-bg"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Remove connection
            </button>
          </div>
        ) : null}
      </div>

      {overlay ? (
        <div data-canvas-control className="pointer-events-none absolute top-3 left-3 z-40 max-w-[calc(100%-1.5rem)]">
          <div className="pointer-events-auto">{overlay}</div>
        </div>
      ) : null}

      {aside ? (
        <div data-canvas-control className="absolute top-3 right-3 bottom-16 z-40 w-[min(22rem,calc(100%-1.5rem))]">
          {aside}
        </div>
      ) : null}

      {minimap && bounds ? (
        <div
          data-canvas-control
          className="absolute bottom-3 left-3 z-30 hidden overflow-hidden rounded-xl border border-app-border/70 bg-app-surface/80 shadow-lg backdrop-blur-md sm:block"
        >
          <svg
            width={minimap.width}
            height={minimap.height}
            role="img"
            aria-label="Overview of the graph. Click to move the view."
            className="cursor-pointer"
            onPointerDown={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              const worldX = (event.clientX - rect.left - minimap.offsetX) / minimap.scale;
              const worldY = (event.clientY - rect.top - minimap.offsetY) / minimap.scale;
              setViewport((current) => ({
                ...current,
                x: size.width / 2 - worldX * current.zoom,
                y: size.height / 2 - worldY * current.zoom,
              }));
            }}
          >
            {nodes.map((node) => {
              const position = positionOf(node.id);
              if (!position) return null;
              return (
                <rect
                  key={node.id}
                  x={(position.x - nodeSize.width / 2) * minimap.scale + minimap.offsetX}
                  y={(position.y - nodeSize.height / 2) * minimap.scale + minimap.offsetY}
                  width={Math.max(2, nodeSize.width * minimap.scale)}
                  height={Math.max(2, nodeSize.height * minimap.scale)}
                  rx={2}
                  className={node.id === selectedId ? "fill-app-brand" : "fill-app-text-subtle/60"}
                />
              );
            })}
            <rect
              x={(-viewport.x / viewport.zoom) * minimap.scale + minimap.offsetX}
              y={(-viewport.y / viewport.zoom) * minimap.scale + minimap.offsetY}
              width={(size.width / viewport.zoom) * minimap.scale}
              height={(size.height / viewport.zoom) * minimap.scale}
              rx={3}
              className="fill-app-brand/10 stroke-app-brand"
              strokeWidth={1.25}
            />
          </svg>
        </div>
      ) : null}

      <div
        data-canvas-control
        className="absolute right-3 bottom-3 z-40 flex items-center gap-1 rounded-2xl border border-app-border/70 bg-app-surface/85 p-1 shadow-lg backdrop-blur-md"
      >
        {toolbar}
        {toolbar ? <span className="mx-0.5 h-5 w-px bg-app-border" aria-hidden="true" /> : null}
        <CanvasButton
          label="Zoom out"
          onClick={() => zoomAround(1 / 1.2, size.width / 2, size.height / 2)}
        >
          <Minus className="h-4 w-4" />
        </CanvasButton>
        <button
          type="button"
          onClick={() => zoomAround(1 / viewport.zoom, size.width / 2, size.height / 2)}
          className="min-w-12 rounded-lg px-1.5 py-1 text-xs font-semibold text-app-text-muted tabular-nums hover:bg-app-surface-hover hover:text-app-text"
          aria-label="Reset zoom to 100%"
          title="Reset zoom to 100%"
        >
          {Math.round(viewport.zoom * 100)}%
        </button>
        <CanvasButton
          label="Zoom in"
          onClick={() => zoomAround(1.2, size.width / 2, size.height / 2)}
        >
          <Plus className="h-4 w-4" />
        </CanvasButton>
        <CanvasButton label="Fit graph to view" onClick={() => fit(false)}>
          <Scan className="h-4 w-4" />
        </CanvasButton>
        <CanvasButton
          label={expanded ? "Leave full screen" : "Full screen"}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </CanvasButton>
      </div>
    </div>
  );

  if (!expanded) return canvas;

  // Expanded, the canvas leaves the page's layout and takes the screen. A portal, so no ancestor's
  // transform or overflow clips the fixed layer.
  return (
    <>
      <div className={`${heightClassName} rounded-3xl border border-dashed border-app-border`} />
      {createPortal(
        <div className="fixed inset-0 z-[70] bg-app-overlay p-3 backdrop-blur-sm sm:p-6">{canvas}</div>,
        document.body,
      )}
    </>
  );
}

const toneStroke: Record<JourneyEdgeTone, string> = {
  done: "stroke-app-success-solid/70",
  active: "stroke-app-brand",
  waiting: "stroke-app-text-subtle/50",
};

const toneFill: Record<JourneyEdgeTone, string> = {
  done: "fill-app-success-solid/70",
  active: "fill-app-brand",
  waiting: "fill-app-text-subtle/50",
};

export function CanvasButton({
  label,
  onClick,
  children,
  active = false,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active || undefined}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "bg-app-brand text-white"
          : "text-app-text-muted hover:bg-app-surface-hover hover:text-app-text"
      }`}
    >
      {children}
    </button>
  );
}
