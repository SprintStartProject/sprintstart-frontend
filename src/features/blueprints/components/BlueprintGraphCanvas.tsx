import { Minus, PanelLeftClose, PanelLeftOpen, Plus, Trash2 } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { Button } from "../../../components/ui/Button.tsx";
import {
  routeEdgePath,
  ROUTING_CLEARANCE,
  routingSegments,
  type RoutingObstacle,
  type RoutingSegment,
} from "./graphRouting.ts";

type Viewport = { x: number; y: number; zoom: number };
type CanvasSize = { width: number; height: number };
type NodeSize = { halfWidth: number; halfHeight: number };
type Dependency = { blockedNodeId: string; blockerId: string };
type CanvasPoint = { x: number; y: number };
type ConnectionDraft = { sourceId: string; start: CanvasPoint; pointer: CanvasPoint };
type ConnectionSide = "top" | "right" | "bottom" | "left";
type LibraryTemplate = { id: string; title: string; description: string };

const libraryTemplateMimeType = "application/x-blueprint-library-template";

const fallbackNodeSize: NodeSize = { halfWidth: 96, halfHeight: 44 };
const PORT_TRUNK_CLEARANCE = 28;
// SVG markers scale with stroke width by default. At a 2px stroke the arrow extends almost 20px
// behind its tip, so its final segment needs to remain straight for longer than node clearance.
const ARROW_TERMINAL_CLEARANCE = 24;

/** The common graph fields persisted for both Blueprint phases and phase-subgraph nodes. */
export type BlueprintGraphCanvasNode = {
  id: string;
  title: string;
  graphX: number | null;
  graphY: number | null;
  blockerIds: string[];
};

/** Interaction callbacks supplied to a domain-specific graph node card. */
export type BlueprintGraphCanvasNodeProps = {
  draggable: boolean;
  disabled: boolean;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onClick: () => void;
  onOpen?: () => void;
};

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

/** Returns which cardinal side of a node most directly faces another node. */
function nearestConnectionSide(
  origin: CanvasPoint,
  target: CanvasPoint,
  nodeSize: NodeSize,
): ConnectionSide {
  const deltaX = target.x - origin.x;
  const deltaY = target.y - origin.y;
  if (Math.abs(deltaX) * nodeSize.halfHeight > Math.abs(deltaY) * nodeSize.halfWidth) {
    return deltaX >= 0 ? "right" : "left";
  }
  return deltaY >= 0 ? "bottom" : "top";
}

function connectionPointForSide(
  center: CanvasPoint,
  nodeSize: NodeSize,
  side: ConnectionSide,
  overlap = 0,
): CanvasPoint {
  switch (side) {
    case "top":
      return { x: center.x, y: center.y - nodeSize.halfHeight + overlap };
    case "right":
      return { x: center.x + nodeSize.halfWidth - overlap, y: center.y };
    case "bottom":
      return { x: center.x, y: center.y + nodeSize.halfHeight - overlap };
    case "left":
      return { x: center.x - nodeSize.halfWidth + overlap, y: center.y };
  }
}

/** Keeps the first and last edge segments perpendicular to the node side they connect to. */
function connectionLeadPoint(
  center: CanvasPoint,
  connection: CanvasPoint,
  nodeSize: NodeSize,
  clearance = ROUTING_CLEARANCE,
): CanvasPoint {
  if (connection.x !== center.x) {
    return {
      x: center.x + Math.sign(connection.x - center.x) * (nodeSize.halfWidth + clearance),
      y: connection.y,
    };
  }
  return {
    x: connection.x,
    y: center.y + Math.sign(connection.y - center.y) * (nodeSize.halfHeight + clearance),
  };
}

function polylineMidpoint(points: CanvasPoint[]): CanvasPoint {
  const segments = routingSegments(points);
  const totalLength = segments.reduce(
    (total, segment) =>
      total + Math.abs(segment.to.x - segment.from.x) + Math.abs(segment.to.y - segment.from.y),
    0,
  );
  let remaining = totalLength / 2;
  for (const segment of segments) {
    const length =
      Math.abs(segment.to.x - segment.from.x) + Math.abs(segment.to.y - segment.from.y);
    if (remaining <= length) {
      const ratio = length === 0 ? 0 : remaining / length;
      return {
        x: segment.from.x + (segment.to.x - segment.from.x) * ratio,
        y: segment.from.y + (segment.to.y - segment.from.y) * ratio,
      };
    }
    remaining -= length;
  }
  return points.at(-1) ?? { x: 0, y: 0 };
}

function svgPolylinePath(points: CanvasPoint[], centerX: number, centerY: number): string {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${centerX + point.x} ${centerY + point.y}`)
    .join(" ");
}

/**
 * Reusable world-space canvas for arranging Blueprint nodes and their prerequisite edges.
 * Domain adapters provide node cards, details behavior, and persistence callbacks.
 */
export function BlueprintGraphCanvas<TNode extends BlueprintGraphCanvasNode>({
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
  const panOriginRef = useRef<{
    x: number;
    y: number;
    viewportX: number;
    viewportY: number;
  } | null>(null);
  const [canvasElement, setCanvasElement] = useState<HTMLDivElement | null>(null);
  const [canvasSize, setCanvasSize] = useState<CanvasSize>({ width: 0, height: 0 });
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [connectionDraft, setConnectionDraft] = useState<ConnectionDraft | null>(null);
  const [selectedDependency, setSelectedDependency] = useState<Dependency | null>(null);
  const [isLibraryCollapsed, setIsLibraryCollapsed] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [nodeSizes, setNodeSizes] = useState<Map<string, NodeSize>>(() => new Map());
  const [optimisticPositions, setOptimisticPositions] = useState<Map<string, CanvasPoint>>(
    () => new Map(),
  );
  const displayedNodes = useMemo(
    () =>
      nodes.map((node) => {
        const position = optimisticPositions.get(node.id);
        return position ? { ...node, graphX: position.x, graphY: position.y } : node;
      }),
    [nodes, optimisticPositions],
  );
  const nodeById = useMemo(
    () => new Map(displayedNodes.map((node) => [node.id, node])),
    [displayedNodes],
  );
  const placedNodes = useMemo(
    () => displayedNodes.filter((node) => node.graphX !== null && node.graphY !== null),
    [displayedNodes],
  );
  const nodeSize = useCallback(
    (nodeId: string) => nodeSizes.get(nodeId) ?? fallbackNodeSize,
    [nodeSizes],
  );
  // Node hit-boxes every edge is routed around, so a long edge no longer cuts through
  // intermediate nodes and looks like a chain of adjacent connections instead.
  const obstacleByNodeId = useMemo(
    () =>
      new Map(
        placedNodes.map((node) => {
          const size = nodeSize(node.id);
          return [
            node.id,
            {
              center: { x: node.graphX!, y: node.graphY! },
              halfWidth: size.halfWidth,
              halfHeight: size.halfHeight,
            } satisfies RoutingObstacle,
          ];
        }),
      ),
    [placedNodes, nodeSize],
  );
  const routedDependencies = useMemo(() => {
    const occupiedSegments: RoutingSegment[] = [];
    return placedNodes.flatMap((node) =>
      node.blockerIds.flatMap((blockerId) => {
        const blocker = nodeById.get(blockerId);
        if (!blocker || blocker.graphX === null || blocker.graphY === null) return [];
        const sourceCenter = { x: blocker.graphX, y: blocker.graphY };
        const targetCenter = { x: node.graphX!, y: node.graphY! };
        const sourceSize = nodeSize(blocker.id);
        const targetSize = nodeSize(node.id);
        const preferredSourceSide = nearestConnectionSide(sourceCenter, targetCenter, sourceSize);
        const preferredTargetSide = nearestConnectionSide(targetCenter, sourceCenter, targetSize);
        const obstacles = placedNodes.map((candidate) => {
          const obstacle = obstacleByNodeId.get(candidate.id)!;
          const terminalClearance =
            candidate.id === node.id
              ? ARROW_TERMINAL_CLEARANCE
              : candidate.id === blockerId
                ? PORT_TRUNK_CLEARANCE
                : ROUTING_CLEARANCE;
          const terminalAllowance = terminalClearance - ROUTING_CLEARANCE;
          return {
            ...obstacle,
            halfWidth: obstacle.halfWidth + terminalAllowance,
            halfHeight: obstacle.halfHeight + terminalAllowance,
          };
        });
        const sourcePoint = connectionPointForSide(
          sourceCenter,
          sourceSize,
          preferredSourceSide,
          8,
        );
        const targetPoint = connectionPointForSide(targetCenter, targetSize, preferredTargetSide);
        const sourceLead = connectionLeadPoint(
          sourceCenter,
          sourcePoint,
          sourceSize,
          PORT_TRUNK_CLEARANCE,
        );
        const targetLead = connectionLeadPoint(
          targetCenter,
          targetPoint,
          targetSize,
          ARROW_TERMINAL_CLEARANCE,
        );
        const points = [
          sourcePoint,
          sourceLead,
          ...routeEdgePath(sourceLead, targetLead, obstacles, ROUTING_CLEARANCE, occupiedSegments),
          targetLead,
          targetPoint,
        ];
        occupiedSegments.push(...routingSegments(points));
        return [{ blockedNodeId: node.id, blockerId, points }];
      }),
    );
  }, [nodeById, nodeSize, obstacleByNodeId, placedNodes]);
  const centerX = canvasSize.width / 2;
  const centerY = canvasSize.height / 2;
  const gridLevel = Math.floor(Math.log2(1 / viewport.zoom) + 0.5);
  const gridTileSize = 44 * viewport.zoom * 2 ** gridLevel;

  useEffect(() => {
    const elements = canvasElement?.querySelectorAll<HTMLDivElement>("[data-graph-node-wrapper]");
    if (!elements) return;
    const observers = [...elements].map((element) => {
      const nodeId = element.dataset.graphNodeWrapper;
      if (!nodeId) return null;
      const updateSize = () => {
        const size = { halfWidth: element.offsetWidth / 2, halfHeight: element.offsetHeight / 2 };
        setNodeSizes((current) => {
          const previous = current.get(nodeId);
          if (previous?.halfWidth === size.halfWidth && previous.halfHeight === size.halfHeight)
            return current;
          const next = new Map(current);
          next.set(nodeId, size);
          return next;
        });
      };
      updateSize();
      const observer = new ResizeObserver(updateSize);
      observer.observe(element);
      return observer;
    });
    return () => observers.forEach((observer) => observer?.disconnect());
  }, [canvasElement, displayedNodes]);

  const selectedDependencyPosition = useMemo(() => {
    if (!selectedDependency) return null;
    const route = routedDependencies.find(
      (dependency) =>
        dependency.blockedNodeId === selectedDependency.blockedNodeId &&
        dependency.blockerId === selectedDependency.blockerId,
    );
    if (!route) return null;
    const midpoint = polylineMidpoint(route.points);
    return {
      x: centerX + midpoint.x * viewport.zoom + viewport.x,
      y: centerY + midpoint.y * viewport.zoom + viewport.y,
    };
  }, [centerX, centerY, routedDependencies, selectedDependency, viewport]);

  useEffect(() => {
    const canvas = canvasElement;
    if (!canvas) return;
    const observer = new ResizeObserver(([entry]) =>
      setCanvasSize({ width: entry.contentRect.width, height: entry.contentRect.height }),
    );
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [canvasElement]);

  /** Prevents page scrolling while the cursor is zooming the graph. */
  useEffect(() => {
    const canvas = canvasElement;
    if (!canvas) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      setViewport((current) => ({
        ...current,
        zoom: Math.min(1.8, Math.max(0.5, current.zoom + (event.deltaY < 0 ? 0.1 : -0.1))),
      }));
    };
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, [canvasElement]);

  function beginDrag(event: DragEvent<HTMLElement>, nodeId: string) {
    if (!editable || isSaving) return;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", nodeId);
    const preview = event.currentTarget.cloneNode(true) as HTMLElement;
    const sourceBounds = event.currentTarget.getBoundingClientRect();
    const originatesOnCanvas = canvasElement?.contains(event.currentTarget) ?? false;
    const sourceZoom = originatesOnCanvas ? viewport.zoom : 1;
    preview.setAttribute("aria-hidden", "true");
    // Canvas cards are already viewport-scaled. Restore their unscaled width, then use `zoom`
    // because Chromium captures it consistently in native drag images (unlike CSS transforms).
    preview.style.cssText = `position:fixed;top:-1000px;left:-1000px;box-sizing:border-box;width:${sourceBounds.width / sourceZoom}px`;
    document.body.append(preview);
    preview.style.zoom = String(sourceZoom * 1.05);
    const previewBounds = preview.getBoundingClientRect();
    event.dataTransfer.setDragImage(preview, previewBounds.width / 2, previewBounds.height / 2);
    requestAnimationFrame(() => preview.remove());
    setDraggedNodeId(nodeId);
  }

  function beginTemplateDrag(event: DragEvent<HTMLElement>, templateId: string) {
    if (!editable || isSaving || !onCreateFromLibrary) return;
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData(libraryTemplateMimeType, templateId);
  }

  async function placeNode(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const bounds = canvasElement?.getBoundingClientRect();
    setDraggedNodeId(null);
    if (!bounds || !editable || isSaving) return;
    const position = {
      x: Math.round((event.clientX - bounds.left - bounds.width / 2 - viewport.x) / viewport.zoom),
      y: Math.round((event.clientY - bounds.top - bounds.height / 2 - viewport.y) / viewport.zoom),
    };
    const templateId = event.dataTransfer.getData(libraryTemplateMimeType);
    if (templateId && onCreateFromLibrary) {
      setIsSaving(true);
      setSaveError(null);
      try {
        await onCreateFromLibrary(templateId, position.x, position.y);
      } catch (reason) {
        setSaveError(reason instanceof Error ? reason.message : "The node could not be created.");
      } finally {
        setIsSaving(false);
      }
      return;
    }
    const node = nodeById.get(event.dataTransfer.getData("text/plain") || "");
    if (!node) return;
    setOptimisticPositions((current) => new Map(current).set(node.id, position));
    setIsSaving(true);
    setSaveError(null);
    try {
      await onPositionChange(node, position.x, position.y);
    } catch (reason) {
      // The path state is unchanged after a failed request, so removing the local position restores it.
      setSaveError(
        reason instanceof Error ? reason.message : "The node position could not be saved.",
      );
    } finally {
      setOptimisticPositions((current) => {
        const next = new Map(current);
        next.delete(node.id);
        return next;
      });
      setIsSaving(false);
    }
  }

  async function returnToLibrary(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    const node = nodeById.get(event.dataTransfer.getData("text/plain") || draggedNodeId || "");
    setDraggedNodeId(null);
    if (!node || node.graphX === null || node.graphY === null || !editable) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await onRemoveNode(node);
      setSelectedDependency(null);
    } catch (reason) {
      setSaveError(
        reason instanceof Error ? reason.message : "The node could not be returned to the library.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function removeDependency() {
    if (!selectedDependency) return;
    const node = nodeById.get(selectedDependency.blockedNodeId);
    if (!node) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await onRemoveBlocker(node, selectedDependency.blockerId);
      setSelectedDependency(null);
    } catch (reason) {
      setSaveError(
        reason instanceof Error ? reason.message : "The connection could not be removed.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function canvasPoint(clientX: number, clientY: number): CanvasPoint | null {
    const bounds = canvasElement?.getBoundingClientRect();
    if (!bounds) return null;
    return {
      x: (clientX - bounds.left - bounds.width / 2 - viewport.x) / viewport.zoom,
      y: (clientY - bounds.top - bounds.height / 2 - viewport.y) / viewport.zoom,
    };
  }

  function beginConnection(event: PointerEvent<HTMLButtonElement>, sourceId: string) {
    if (!editable || isSaving) return;
    event.preventDefault();
    event.stopPropagation();
    const point = canvasPoint(event.clientX, event.clientY);
    if (point) setConnectionDraft({ sourceId, start: point, pointer: point });
  }

  async function endConnection(event: PointerEvent<HTMLButtonElement>, target: TNode) {
    event.preventDefault();
    event.stopPropagation();
    const draft = connectionDraft;
    if (!draft || draft.sourceId === target.id) {
      setConnectionDraft(null);
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      if (target.blockerIds.includes(draft.sourceId)) await onRemoveBlocker(target, draft.sourceId);
      else await onAddBlocker(target, draft.sourceId);
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : "The connection could not be saved.");
    } finally {
      setIsSaving(false);
      setConnectionDraft(null);
    }
  }

  function beginPan(event: PointerEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target.closest("[data-graph-node], [data-graph-edge], [data-graph-control]")) return;
    setSelectedDependency(null);
    event.currentTarget.setPointerCapture(event.pointerId);
    panOriginRef.current = {
      x: event.clientX,
      y: event.clientY,
      viewportX: viewport.x,
      viewportY: viewport.y,
    };
  }

  function pan(event: PointerEvent<HTMLDivElement>) {
    if (connectionDraft) {
      const point = canvasPoint(event.clientX, event.clientY);
      if (point) setConnectionDraft((draft) => (draft ? { ...draft, pointer: point } : null));
      return;
    }
    const origin = panOriginRef.current;
    if (!origin) return;
    setViewport((current) => ({
      ...current,
      x: origin.viewportX + event.clientX - origin.x,
      y: origin.viewportY + event.clientY - origin.y,
    }));
  }

  function endPan(event: PointerEvent<HTMLDivElement>) {
    if (connectionDraft) {
      setConnectionDraft(null);
      return;
    }
    panOriginRef.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId))
      event.currentTarget.releasePointerCapture?.(event.pointerId);
  }

  function clearPanOrigin() {
    panOriginRef.current = null;
  }

  const renderNodeProps = (node: TNode): BlueprintGraphCanvasNodeProps => ({
    draggable: editable && !isSaving,
    disabled: isSaving,
    onDragStart: (event) => beginDrag(event, node.id),
    onClick: () => onNodeClick(node),
    onOpen: onOpenNode ? () => onOpenNode(node) : undefined,
  });

  return (
    <section className="overflow-hidden rounded-2xl border border-app-border bg-app-surface shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-app-border px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-app-text">{title}</h2>
          <p className="mt-1 text-sm text-app-text-muted">{description}</p>
          {editable ? (
            <p className="mt-1 text-xs text-app-text-subtle">
              Drag from a node port to a target port. The arrow points to the node that is blocked.
            </p>
          ) : null}
        </div>
        {headerAction}
      </div>
      <div className="relative min-h-[42rem] overflow-hidden">
        {showLibrary ? (
          <div
            className="absolute inset-y-0 left-0 z-20 w-72 transition-transform duration-[400ms] ease-out"
            style={{ transform: `translateX(${isLibraryCollapsed ? -288 : 0}px)` }}
          >
            <aside
              className="flex h-full w-full flex-col overflow-hidden border-r border-app-border bg-app-surface-muted p-4"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => void returnToLibrary(event)}
            >
              <h3 className="text-sm font-semibold text-app-text">{libraryTitle}</h3>
              <p className="mt-1 text-xs text-app-text-muted">{libraryDescription}</p>
              <div className="mt-4 min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
                {nodes
                  .filter((node) => node.graphX === null || node.graphY === null)
                  .map((node) => (
                    <div key={node.id}>{renderNode(node, renderNodeProps(node))}</div>
                  ))}
                {nodes.every((node) => node.graphX !== null && node.graphY !== null) ? (
                  <p className="text-xs text-app-text-muted">{libraryEmptyMessage}</p>
                ) : null}
              </div>
              {libraryTemplates.length && editable && onCreateFromLibrary ? (
                <div className="mt-4 border-t border-app-border pt-4">
                  <p className="text-xs font-medium text-app-text-muted">Create on canvas</p>
                  <div className="mt-2 space-y-2">
                    {libraryTemplates.map((template) => (
                      <div
                        key={template.id}
                        draggable={!isSaving}
                        aria-label={`Drag ${template.title} onto the canvas to create it`}
                        className="cursor-grab rounded-xl border border-dashed border-app-border bg-app-surface p-3 active:cursor-grabbing"
                        onDragStart={(event) => beginTemplateDrag(event, template.id)}
                      >
                        <p className="text-sm font-semibold text-app-text">{template.title}</p>
                        <p className="mt-1 text-xs text-app-text-muted">{template.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </aside>
            <div className="absolute top-3 left-[300px] z-30">
              <Button
                variant="secondary"
                size="sm"
                iconOnly
                aria-label={
                  isLibraryCollapsed
                    ? `Expand ${libraryTitle.toLowerCase()}`
                    : `Collapse ${libraryTitle.toLowerCase()}`
                }
                aria-expanded={!isLibraryCollapsed}
                onClick={() => setIsLibraryCollapsed((current) => !current)}
              >
                {isLibraryCollapsed ? (
                  <PanelLeftOpen className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        ) : null}
        <div
          ref={setCanvasElement}
          className="relative min-h-[42rem] cursor-grab touch-none overflow-hidden bg-app-bg select-none active:cursor-grabbing"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => void placeNode(event)}
          onPointerDown={beginPan}
          onPointerMove={pan}
          onPointerUp={endPan}
          onPointerCancel={endPan}
          onLostPointerCapture={clearPanOrigin}
          aria-label={ariaLabel}
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
              backgroundPosition: `${centerX + viewport.x}px ${centerY + viewport.y}px`,
              backgroundSize: `${gridTileSize}px ${gridTileSize}px`,
            }}
            aria-hidden="true"
          />
          <div
            className="absolute inset-0"
            style={{
              transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
              transformOrigin: "center",
            }}
          >
            <svg
              className="absolute inset-0 h-full w-full overflow-visible"
              viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
              aria-hidden="true"
            >
              <defs>
                <marker
                  id="blueprint-arrow"
                  markerWidth="10"
                  markerHeight="10"
                  refX="9"
                  refY="3"
                  orient="auto"
                >
                  <path d="M0,0 L0,6 L9,3 z" className="fill-app-brand" />
                </marker>
              </defs>
              {routedDependencies.map(({ blockedNodeId, blockerId, points }) => {
                const d = svgPolylinePath(points, centerX, centerY);
                const selectConnection = () => {
                  if (editable) setSelectedDependency({ blockedNodeId, blockerId });
                };
                return (
                  <g key={`${blockedNodeId}-${blockerId}`} data-graph-edge>
                    <path
                      d={d}
                      fill="none"
                      className="pointer-events-none stroke-app-brand"
                      strokeWidth="2"
                      markerEnd="url(#blueprint-arrow)"
                    />
                    <path
                      d={d}
                      fill="none"
                      stroke="transparent"
                      strokeWidth="14"
                      className={editable ? "cursor-pointer" : "pointer-events-none"}
                      onClick={selectConnection}
                    />
                  </g>
                );
              })}
              {connectionDraft ? (
                <path
                  d={svgPolylinePath(
                    [
                      connectionDraft.start,
                      ...routeEdgePath(connectionDraft.start, connectionDraft.pointer, []),
                      connectionDraft.pointer,
                    ],
                    centerX,
                    centerY,
                  )}
                  fill="none"
                  className="stroke-app-brand"
                  strokeWidth="2"
                  strokeDasharray="6 4"
                  markerEnd="url(#blueprint-arrow)"
                />
              ) : null}
            </svg>
            {placedNodes.map((node) => (
              <div
                key={node.id}
                data-graph-node-wrapper={node.id}
                className="group absolute w-48 -translate-x-1/2 -translate-y-1/2"
                style={{ left: centerX + node.graphX!, top: centerY + node.graphY! }}
              >
                {renderNode(node, renderNodeProps(node))}
                {editable && !isSaving
                  ? (["top", "right", "bottom", "left"] as ConnectionSide[]).map((side) => (
                      <ConnectionHandle
                        key={side}
                        side={side}
                        nodeTitle={node.title}
                        onPointerDown={(event) => beginConnection(event, node.id)}
                        onPointerUp={(event) => void endConnection(event, node)}
                      />
                    ))
                  : null}
              </div>
            ))}
          </div>
          {selectedDependency && selectedDependencyPosition && editable ? (
            <div
              data-graph-control
              className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
              style={{ left: selectedDependencyPosition.x, top: selectedDependencyPosition.y }}
            >
              <Button
                variant="dangerSoft"
                size="sm"
                iconOnly
                aria-label="Remove selected connection"
                disabled={isSaving}
                onClick={() => void removeDependency()}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
          <div data-graph-control className="absolute top-4 right-4 flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              iconOnly
              aria-label="Zoom out"
              onClick={() =>
                setViewport((current) => ({ ...current, zoom: Math.max(0.5, current.zoom - 0.1) }))
              }
            >
              <Minus className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              iconOnly
              aria-label="Zoom in"
              onClick={() =>
                setViewport((current) => ({ ...current, zoom: Math.min(1.8, current.zoom + 0.1) }))
              }
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setViewport({ x: 0, y: 0, zoom: 1 })}
            >
              Reset view
            </Button>
          </div>
          {isSaving ? (
            <p className="absolute right-4 bottom-4 rounded-lg bg-app-surface px-3 py-2 text-xs text-app-text-muted shadow-lg">
              Saving graph…
            </p>
          ) : null}
          {saveError ? (
            <p
              role="alert"
              className="absolute right-4 bottom-4 max-w-sm rounded-lg bg-app-danger-bg px-3 py-2 text-xs text-app-danger-text shadow-lg"
            >
              {saveError}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/** Enlarged hit areas make the four directional connection ports easy to drag between. */
function ConnectionHandle({
  side,
  nodeTitle,
  onPointerDown,
  onPointerUp,
}: {
  side: ConnectionSide;
  nodeTitle: string;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLButtonElement>) => void;
}) {
  const positionClasses: Record<ConnectionSide, string> = {
    top: "top-0 left-1/2 -translate-x-1/2 -translate-y-1/2",
    right: "top-1/2 right-0 translate-x-1/2 -translate-y-1/2",
    bottom: "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2",
    left: "top-1/2 left-0 -translate-x-1/2 -translate-y-1/2",
  };
  return (
    <button
      type="button"
      data-graph-control
      className={`absolute z-10 flex h-10 w-10 items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none ${positionClasses[side]}`}
      aria-label={`Connect ${nodeTitle} from the ${side}`}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      <span className="h-3 w-3 rounded-full border-2 border-app-brand bg-app-surface shadow-sm" />
    </button>
  );
}
