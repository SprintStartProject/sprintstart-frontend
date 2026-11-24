import type { Dispatch, SetStateAction } from "react";
import type { CanvasSize, MinimapLayout, Viewport } from "./cameraMath";
import type { GraphPoint } from "./layout";

type Props = {
  layout: MinimapLayout;
  nodeIds: readonly string[];
  positionOf: (id: string) => GraphPoint | undefined;
  nodeSize: { width: number; height: number };
  selectedId: string | null;
  viewport: Viewport;
  size: CanvasSize;
  setViewport: Dispatch<SetStateAction<Viewport>>;
};

type NodesProps = Pick<Props, "layout" | "nodeIds" | "positionOf" | "nodeSize" | "selectedId">;

/** One small rectangle per node, the selected one in the brand colour. */
function MinimapNodes({ layout, nodeIds, positionOf, nodeSize, selectedId }: NodesProps) {
  return nodeIds.map((id) => {
    const position = positionOf(id);
    if (!position) return null;
    return (
      <rect
        key={id}
        x={(position.x - nodeSize.width / 2) * layout.scale + layout.offsetX}
        y={(position.y - nodeSize.height / 2) * layout.scale + layout.offsetY}
        width={Math.max(2, nodeSize.width * layout.scale)}
        height={Math.max(2, nodeSize.height * layout.scale)}
        rx={2}
        className={id === selectedId ? "fill-app-brand" : "fill-app-text-subtle/60"}
      />
    );
  });
}

/** The outline of the part of the graph the canvas is showing. */
function MinimapViewRect({ layout, viewport, size }: Pick<Props, "layout" | "viewport" | "size">) {
  return (
    <rect
      x={(-viewport.x / viewport.zoom) * layout.scale + layout.offsetX}
      y={(-viewport.y / viewport.zoom) * layout.scale + layout.offsetY}
      width={(size.width / viewport.zoom) * layout.scale}
      height={(size.height / viewport.zoom) * layout.scale}
      rx={3}
      className="fill-app-brand/10 stroke-app-brand"
      strokeWidth={1.25}
    />
  );
}

/** A small map of the whole graph with the visible part outlined; a click moves the view there. */
export function JourneyMinimap({
  layout,
  nodeIds,
  positionOf,
  nodeSize,
  selectedId,
  viewport,
  size,
  setViewport,
}: Props) {
  const centreOn = (clientX: number, clientY: number, rect: DOMRect) => {
    const worldX = (clientX - rect.left - layout.offsetX) / layout.scale;
    const worldY = (clientY - rect.top - layout.offsetY) / layout.scale;
    setViewport((current) => ({
      ...current,
      x: size.width / 2 - worldX * current.zoom,
      y: size.height / 2 - worldY * current.zoom,
    }));
  };

  return (
    <div
      data-canvas-control
      className="absolute bottom-3 left-3 z-30 hidden overflow-hidden rounded-xl border border-app-border/70 bg-app-surface/80 shadow-lg backdrop-blur-md sm:block"
    >
      <svg
        width={layout.width}
        height={layout.height}
        role="img"
        aria-label="Overview of the graph. Click to move the view."
        className="cursor-pointer"
        onPointerDown={(event) =>
          centreOn(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect())
        }
      >
        <MinimapNodes {...{ layout, nodeIds, positionOf, nodeSize, selectedId }} />
        <MinimapViewRect {...{ layout, viewport, size }} />
      </svg>
    </div>
  );
}
