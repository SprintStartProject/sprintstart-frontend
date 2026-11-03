import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { JourneyNodeEmphasis, JourneyNodeRenderState } from "./canvasTypes";
import type { GraphPoint, LayoutNode } from "./layout";

type Props<TNode extends LayoutNode> = {
  nodes: readonly TNode[];
  positionOf: (id: string) => GraphPoint | undefined;
  nodeSize: { width: number; height: number };
  zoom: number;
  selectedId: string | null;
  draggingId: string | null;
  emphasisOf: (id: string) => JourneyNodeEmphasis;
  renderNode: (node: TNode, state: JourneyNodeRenderState) => ReactNode;
  nodeLabel: (node: TNode) => string;
  /** Nodes are controls where there is something to select or open, pictures where there is not. */
  interactive: boolean;
  canMove: boolean;
  canConnect: boolean;
  setHoveredId: Dispatch<SetStateAction<string | null>>;
};

const stackingOf = (dragging: boolean, selected: boolean) => {
  if (dragging) return "z-30";
  return selected ? "z-20" : "z-10";
};

/** The handle an edge is drawn from, shown while a node is hovered or focused. */
function ConnectPort({ nodeId }: { nodeId: string }) {
  return (
    <span
      data-port-for={nodeId}
      title="Drag to what this unlocks"
      className="absolute -bottom-2.5 left-1/2 z-10 flex h-5 w-5 -translate-x-1/2 cursor-crosshair items-center justify-center rounded-full border-2 border-app-brand bg-app-surface opacity-0 shadow-sm transition-opacity group-hover/node:opacity-100 group-focus-visible/node:opacity-100"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-app-brand" />
    </span>
  );
}

/** Every node, each in its own wrapper at its place in the world. */
export function JourneyNodeLayer<TNode extends LayoutNode>(props: Props<TNode>) {
  const { nodes, positionOf, nodeSize, zoom, selectedId, draggingId, setHoveredId } = props;
  const { interactive, canMove, canConnect } = props;
  return nodes.map((node) => {
    const position = positionOf(node.id);
    if (!position) return null;
    const selected = node.id === selectedId;
    const dragging = draggingId === node.id;
    const unhover = () => setHoveredId((current) => (current === node.id ? null : current));
    return (
      <div
        key={node.id}
        data-journey-node={node.id}
        // A node is a control where there is something to select or open, and a picture
        // where there is not: a read-only canvas would otherwise hand a keyboard a tab stop per
        // node, each of which did nothing.
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-label={interactive ? props.nodeLabel(node) : undefined}
        aria-pressed={interactive ? selected : undefined}
        className={`group/node absolute rounded-2xl focus-visible:outline-offset-6 ${
          canMove ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
        } ${stackingOf(dragging, selected)}`}
        style={{
          left: position.x - nodeSize.width / 2,
          top: position.y - nodeSize.height / 2,
          width: nodeSize.width,
          height: nodeSize.height,
        }}
        onPointerEnter={() => setHoveredId(node.id)}
        onPointerLeave={unhover}
        onFocus={() => setHoveredId(node.id)}
        onBlur={unhover}
      >
        {props.renderNode(node, { selected, emphasis: props.emphasisOf(node.id), dragging, zoom })}
        {canConnect ? <ConnectPort nodeId={node.id} /> : null}
      </div>
    );
  });
}
