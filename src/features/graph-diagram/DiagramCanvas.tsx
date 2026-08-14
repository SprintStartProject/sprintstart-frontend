import { useCallback, useMemo, useState } from "react";
import { useReducedMotion } from "framer-motion";
import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  type Connection,
  type Edge,
  type NodeMouseHandler,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { chainFor, type GraphShape } from "../competency-graph/layout";
import { useForceLayout } from "../competency-graph/useForceLayout";

/** How faint an edge outside the lit chain gets. Visible enough to read, faint enough to recede. */
const DIMMED_EDGE_OPACITY = 0.12;

/** One node to draw. `data` is whatever the caller's node component expects. */
export type DiagramCanvasNode<TData> = {
  id: string;
  data: TData;
  /** What a screen reader says for this node — the canvas cannot know how to phrase it. */
  ariaLabel: string;
};

/** One edge to draw. `dashed` reads as a softer relationship; `ghost` as one not yet real. */
export type DiagramCanvasEdge = {
  id: string;
  from: string;
  to: string;
  dashed?: boolean;
  ghost?: boolean;
};

export type DiagramCanvasProps<TData> = {
  /** Node ids and the edges between them: what gets laid out and what the chain walks. */
  shape: GraphShape;
  nodes: DiagramCanvasNode<TData>[];
  edges: DiagramCanvasEdge[];
  /** The caller's node components, by type name, as React Flow wants them. */
  nodeTypes: NodeTypes;
  /** Which of [nodeTypes] to render these nodes with. */
  nodeType: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Names the canvas for screen readers — "Competency graph editor", "How auth flows here". */
  ariaLabel: string;
  testId?: string;
  /**
   * Dragging between two nodes' handles, when the surface allows declaring a relationship.
   *
   * Absent on a read-only diagram, which also turns the connection handles off — a handle that
   * cannot connect anything is an affordance that lies.
   */
  onConnectNodes?: (fromId: string, toId: string) => void;
};

/**
 * A node-link diagram you can read by pointing at it.
 *
 * Owns everything between the shared layout maths (dagre layering, d3 relaxation) and the screen:
 * the hover and selection that light a chain, the dimming outside it, the reduced-motion decision
 * and the React Flow shell.
 *
 * Selection lights the same chain as hover. Hover is pointer-only, and this reading of a
 * diagram must not be unavailable by keyboard.
 *
 * The force relaxation is skipped entirely under `prefers-reduced-motion`, falling back to
 * dagre's layered positions — the diagram stays correct and stays still.
 */
export function DiagramCanvas<TData extends Record<string, unknown>>({
  shape,
  nodes,
  edges,
  nodeTypes,
  nodeType,
  selectedId,
  onSelect,
  ariaLabel,
  testId,
  onConnectNodes,
}: DiagramCanvasProps<TData>) {
  const reduceMotion = useReducedMotion() ?? false;
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const { positions } = useForceLayout(shape, !reduceMotion);

  // Hover is pointer-only, so selection lights the same chain — otherwise this reading of the
  // diagram is unavailable by keyboard.
  const chainRoot = hoveredId ?? selectedId;
  const chainIds = useMemo(
    () => (chainRoot ? chainFor(shape, chainRoot) : null),
    [shape, chainRoot],
  );

  const flowNodes = useMemo(
    () =>
      nodes.map((node) => ({
        id: node.id,
        type: nodeType,
        position: positions.get(node.id) ?? { x: 0, y: 0 },
        data: {
          ...node.data,
          // Injected here rather than by every caller: what is in the lit chain is this
          // component's judgement, and two callers computing it would eventually disagree.
          dimmed: chainIds !== null && !chainIds.has(node.id),
        },
        ariaLabel: node.ariaLabel,
      })),
    [nodes, nodeType, positions, chainIds],
  );

  const flowEdges = useMemo<Edge[]>(() => {
    const known = new Set(nodes.map((node) => node.id));
    return (
      edges
        // An edge pointing outside the diagram would make React Flow invent a phantom node.
        .filter((edge) => known.has(edge.from) && known.has(edge.to))
        .map((edge) => ({
          id: edge.id,
          source: edge.from,
          target: edge.to,
          markerEnd: { type: MarkerType.ArrowClosed },
          style: {
            opacity: edgeOpacity(edge, chainIds),
            strokeDasharray: edge.dashed || edge.ghost ? dashFor(edge) : undefined,
          },
        }))
    );
  }, [edges, nodes, chainIds]);

  const handleNodeClick = useCallback<NodeMouseHandler>(
    (_event, node) => onSelect(node.id),
    [onSelect],
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      onConnectNodes?.(connection.source, connection.target);
    },
    [onConnectNodes],
  );

  return (
    <div className="h-full w-full" data-testid={testId} role="application" aria-label={ariaLabel}>
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        onNodeMouseEnter={(_event, node) => setHoveredId(node.id)}
        onNodeMouseLeave={() => setHoveredId(null)}
        onPaneClick={() => onSelect(null)}
        onConnect={handleConnect}
        // Positions are derived from the layout on every render, so a dragged node would be
        // pulled back under the pointer.
        nodesDraggable={false}
        nodesConnectable={onConnectNodes !== undefined}
        edgesFocusable={false}
        fitView
        proOptions={{ hideAttribution: false }}
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

/** A ghost edge is already faint; outside the lit chain, everything else recedes. */
function edgeOpacity(edge: DiagramCanvasEdge, chainIds: Set<string> | null): number {
  if (chainIds !== null && !(chainIds.has(edge.from) && chainIds.has(edge.to))) {
    return DIMMED_EDGE_OPACITY;
  }
  return edge.ghost ? 0.6 : 1;
}

function dashFor(edge: DiagramCanvasEdge): string {
  return edge.ghost ? "6 4" : "2 4";
}
