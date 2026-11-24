import { Trash2 } from "lucide-react";
import { arrowHead, edgeMidpoint, edgePath } from "./edgeGeometry";
import type { CanvasEdge } from "./canvasEdges";
import type { JourneyEdgeTone } from "./canvasTypes";
import type { Viewport } from "./cameraMath";
import type { GraphPoint } from "./layout";

/** How one edge tone is stroked. */
export type EdgeSwatch = {
  className: string;
  dash?: string;
  width: number;
  linecap: "round" | "butt";
};

export type PickedEdge = { blockerId: string; nodeId: string };

/** The dashed line being drawn from a node's port towards the pointer. */
export type EdgeInProgress = { from: GraphPoint; to: GraphPoint };

type Props = {
  edges: readonly CanvasEdge[];
  swatches: Record<JourneyEdgeTone, EdgeSwatch>;
  picked: PickedEdge | null;
  /** Everything but the lit run is faded, or everything is while a node is spotlit. */
  fadeOthers: boolean;
  fadeAll: boolean;
  /** Edges can be picked, which is what lets them be removed. */
  canPick: boolean;
  inProgress: EdgeInProgress | null;
  onPick: (edge: PickedEdge) => void;
};

const isPicked = (edge: CanvasEdge, picked: PickedEdge | null) =>
  picked?.blockerId === edge.blockerId && picked?.nodeId === edge.nodeId;

type EdgeProps = {
  edge: CanvasEdge;
  swatch: EdgeSwatch;
  picked: boolean;
  faded: boolean;
  canPick: boolean;
  onPick: (edge: PickedEdge) => void;
};

function EdgeStroke({ edge, swatch, picked, faded, canPick, onPick }: EdgeProps) {
  const d = edgePath(edge.from, edge.to, {
    waypoints: edge.waypoints,
    axis: edge.axis,
    side: edge.sideways,
  });
  const width = edge.inChain || picked ? swatch.width + 0.75 : swatch.width;
  const stroke = `${swatch.className} ${picked ? "!stroke-app-danger-solid" : ""}`;
  const opacity = faded ? 0.18 : 1;
  return (
    <g>
      <path
        d={d}
        data-edge={`${edge.blockerId}->${edge.nodeId}`}
        fill="none"
        strokeWidth={width}
        strokeLinecap={swatch.linecap}
        strokeDasharray={swatch.dash}
        className={`transition-opacity duration-200 ${stroke} ${
          edge.tone === "active" ? "journey-edge-flow" : ""
        }`}
        opacity={opacity}
      />
      {/*
        The head, in the same ink and never dashed. Drawn from the direction the curve
        is travelling as it arrives, so it points where the line points and sits on its
        end rather than beside it.
      */}
      <path
        d={arrowHead(edge.to, edge.approach)}
        fill="none"
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`transition-opacity duration-200 ${stroke}`}
        opacity={opacity}
      />
      {canPick ? (
        <path
          d={d}
          fill="none"
          stroke="transparent"
          strokeWidth={16}
          className="pointer-events-auto cursor-pointer"
          data-canvas-control
          onPointerDown={(event) => {
            event.stopPropagation();
            onPick({ blockerId: edge.blockerId, nodeId: edge.nodeId });
          }}
        >
          <title>Select connection</title>
        </path>
      ) : null}
    </g>
  );
}

/** The edge being drawn, dashed, with its head at the pointer. */
function EdgeBeingDrawn({ from, to }: EdgeInProgress) {
  return (
    <>
      <path
        d={edgePath(from, to)}
        fill="none"
        strokeWidth={2}
        strokeDasharray="4 6"
        className="stroke-app-brand"
      />
      <path
        d={arrowHead(to, { x: 0, y: 1 })}
        fill="none"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-app-brand"
      />
    </>
  );
}

/** Every edge of the graph, in the world's own coordinates, drawn under the cards. */
export function JourneyEdgeLayer({
  edges,
  swatches,
  picked,
  fadeOthers,
  fadeAll,
  canPick,
  inProgress,
  onPick,
}: Props) {
  return (
    <svg
      className="pointer-events-none absolute top-0 left-0 overflow-visible"
      width="1"
      height="1"
      aria-hidden="true"
    >
      {edges.map((edge) => (
        <EdgeStroke
          key={`${edge.blockerId}->${edge.nodeId}`}
          edge={edge}
          swatch={swatches[edge.tone]}
          picked={isPicked(edge, picked)}
          faded={fadeAll || (fadeOthers && !edge.inChain)}
          canPick={canPick}
          onPick={onPick}
        />
      ))}
      {inProgress ? <EdgeBeingDrawn from={inProgress.from} to={inProgress.to} /> : null}
    </svg>
  );
}

type MenuProps = {
  edge: CanvasEdge;
  viewport: Viewport;
  onRemove: () => void;
};

/** The "Remove connection" button, hung on the middle of the picked edge. */
export function PickedEdgeMenu({ edge, viewport, onRemove }: MenuProps) {
  const middle = edgeMidpoint(edge.from, edge.to, edge.waypoints);
  return (
    <div
      data-canvas-control
      className="absolute z-40 -translate-x-1/2 -translate-y-1/2"
      style={{
        left: middle.x * viewport.zoom + viewport.x,
        top: middle.y * viewport.zoom + viewport.y,
      }}
    >
      <button
        type="button"
        onClick={onRemove}
        className="flex items-center gap-1.5 rounded-full border border-app-danger-border bg-app-surface px-3 py-1.5 text-xs font-semibold text-app-danger-text shadow-lg hover:bg-app-danger-bg"
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        Remove connection
      </button>
    </div>
  );
}
