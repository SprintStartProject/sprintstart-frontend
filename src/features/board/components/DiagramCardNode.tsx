import { memo } from "react";
import { type Node, type NodeProps } from "@xyflow/react";
import { Boxes, Cloud, Database, FileCode, Footprints, HelpCircle, Server } from "lucide-react";
import { NODE_HEIGHT, NODE_WIDTH } from "../../competency-graph/layout";
import type { DiagramNode, DiagramNodeKind } from "../types";

const KIND_ICONS: Record<DiagramNodeKind, typeof Boxes> = {
  COMPONENT: Boxes,
  FILE: FileCode,
  SERVICE: Server,
  DATA: Database,
  STEP: Footprints,
  EXTERNAL: Cloud,
  OTHER: HelpCircle,
};

export type DiagramCardNodeData = {
  node: DiagramNode;
  selected: boolean;
  /** Faded because another box's chain is lit and this one isn't in it. */
  dimmed: boolean;
};

export type DiagramCardFlowNode = Node<DiagramCardNodeData, "diagramPart">;

/**
 * One box in a diagram the buddy placed.
 *
 * Deliberately plainer than the PM studio's node. That one colours by authoring readiness, because
 * a PM is deciding what to write next; here there is no state to carry — every box is equally real,
 * equally derived, equally cited. What the reader needs from a box is what it is called, what kind
 * of thing it is, and that it came from somewhere.
 *
 * The kind is carried by an icon and by text in the accessible name, never by colour alone.
 */
function DiagramCardNodeComponent({ data }: NodeProps<DiagramCardFlowNode>) {
  const { node, selected, dimmed } = data;
  const KindIcon = KIND_ICONS[node.kind] ?? KIND_ICONS.OTHER;

  return (
    <div
      data-testid={`diagram-node-${node.id}`}
      data-node-kind={node.kind}
      style={{ width: NODE_WIDTH, height: NODE_HEIGHT }}
      className={[
        "flex flex-col justify-center gap-1 rounded-xl border border-app-border bg-app-surface px-3 py-2 transition-all duration-200",
        selected ? "ring-2 ring-app-focus" : "",
        dimmed ? "opacity-30" : "opacity-100",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex items-center gap-1.5">
        <KindIcon className="h-3.5 w-3.5 shrink-0 text-app-text-subtle" aria-hidden="true" />
        <p className="truncate text-sm font-medium text-app-text" title={node.label}>
          {node.label}
        </p>
      </div>
      {node.summary && (
        <p className="line-clamp-2 text-xs text-app-text-muted" title={node.summary}>
          {node.summary}
        </p>
      )}
    </div>
  );
}

export const DiagramCardNode = memo(DiagramCardNodeComponent);
