import type { JourneyCanvasProps, JourneyEdgeTone } from "./canvasTypes";
import { CanvasSurface } from "./CanvasSurface";
import { CanvasZoomBar } from "./CanvasZoomBar";
import {
  JourneyEdgeLayer,
  PickedEdgeMenu,
  type EdgeInProgress,
  type EdgeSwatch,
} from "./JourneyEdgeLayer";
import { JourneyMinimap } from "./JourneyMinimap";
import { JourneyNodeLayer } from "./JourneyNodeLayer";
import type { LayoutNode } from "./layout";
import type { JourneyCanvasModel } from "./useJourneyCanvas";

type ViewProps<TNode extends LayoutNode> = {
  given: JourneyCanvasProps<TNode>;
  model: JourneyCanvasModel<TNode>;
  swatches: Record<JourneyEdgeTone, EdgeSwatch>;
};

/** The edge being drawn from a port to the pointer, if there is one. */
function edgeInProgress<TNode extends LayoutNode>({
  given,
  model,
}: Pick<ViewProps<TNode>, "given" | "model">): EdgeInProgress | null {
  const { connection } = model.pointer;
  const source = connection ? model.scene.positionOf(connection.sourceId) : undefined;
  if (!connection || !source) return null;
  return {
    from: { x: source.x, y: source.y + given.nodeSize.height / 2 },
    to: connection.pointer,
  };
}

/** The edges and the nodes, which share the one transform that maps the world onto the screen. */
function CanvasWorld<TNode extends LayoutNode>({ given, model, swatches }: ViewProps<TNode>) {
  const { scene, pointer, camera, selectedEdge } = model;
  const canConnect = given.canConnect ?? false;
  const canMove = given.canMove ?? false;
  return (
    <>
      <JourneyEdgeLayer
        edges={scene.edges}
        swatches={swatches}
        picked={selectedEdge}
        fadeOthers={scene.fadeOthers}
        fadeAll={!!given.spotlightId}
        canPick={canConnect}
        inProgress={edgeInProgress({ given, model })}
        onPick={(edge) => {
          model.setSelectedEdge(edge);
          given.onSelect?.(null);
        }}
      />
      <JourneyNodeLayer
        nodes={given.nodes}
        positionOf={scene.positionOf}
        nodeSize={given.nodeSize}
        zoom={camera.viewport.zoom}
        selectedId={model.selectedId}
        draggingId={pointer.dragOverride?.id ?? null}
        emphasisOf={scene.emphasisOf}
        renderNode={given.renderNode}
        nodeLabel={given.nodeLabel}
        interactive={Boolean(given.onSelect || given.onOpen || canMove || canConnect)}
        canMove={canMove}
        canConnect={canConnect}
        setHoveredId={model.setHoveredId}
      />
    </>
  );
}

/** The overview map, for a graph large enough to need one. */
function CanvasMinimap<TNode extends LayoutNode>({ given, model }: ViewProps<TNode>) {
  const { minimap, camera, scene } = model;
  if (!minimap) return null;
  return (
    <JourneyMinimap
      layout={minimap}
      nodeIds={given.nodes.map((node) => node.id)}
      positionOf={scene.positionOf}
      nodeSize={given.nodeSize}
      selectedId={model.selectedId}
      viewport={camera.viewport}
      size={camera.size}
      setViewport={camera.setViewport}
    />
  );
}

/** The menu that removes the picked edge, while there is one. */
function CanvasEdgeMenu<TNode extends LayoutNode>({ given, model }: ViewProps<TNode>) {
  const edge = model.scene.drawnEdge;
  if (!edge || !given.onDisconnect) return null;
  const remove = () => {
    given.onDisconnect?.(edge.blockerId, edge.nodeId);
    model.setSelectedEdge(null);
  };
  return <PickedEdgeMenu edge={edge} viewport={model.camera.viewport} onRemove={remove} />;
}

/** The canvas as it looks: the frame, the world in it and the controls over it. */
export function JourneyCanvasView<TNode extends LayoutNode>(view: ViewProps<TNode>) {
  const { given, model } = view;
  const { camera, expanded } = model;
  const { size, viewport } = camera;
  return (
    <CanvasSurface
      containerRef={model.containerRef}
      ariaLabel={given.ariaLabel}
      viewport={viewport}
      handlers={{ ...model.pointer.handlers, onKeyDown: model.onKeyDown }}
      expanded={expanded}
      heightClassName={given.heightClassName ?? "h-[36rem]"}
      overlay={given.overlay}
      aside={given.aside}
      cover={given.cover}
      world={<CanvasWorld {...view} />}
      edgeMenu={<CanvasEdgeMenu {...view} />}
      minimap={<CanvasMinimap {...view} />}
      zoomBar={
        <CanvasZoomBar
          zoom={viewport.zoom}
          expanded={expanded}
          toolbar={given.toolbar}
          zoomBy={(factor) => camera.zoomAround(factor, size.width / 2, size.height / 2)}
          fit={() => camera.fit(false)}
          toggleExpanded={() => model.setExpanded((current) => !current)}
        />
      }
    />
  );
}
