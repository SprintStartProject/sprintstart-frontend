import type { GraphPoint } from "./layout";

/** Where the world is on the screen: its offset in pixels and the zoom applied to it. */
export type Viewport = { x: number; y: number; zoom: number };

export type CanvasSize = { width: number; height: number };

export type GraphBounds = { minX: number; maxX: number; minY: number; maxY: number };

export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 1.75;
export const FIT_PADDING_PX = 72;
/** Dragged nodes and double clicked spots land on a grid of this many world pixels. */
export const SNAP = 10;
/** The factor one zoom key press or toolbar click zooms by. */
export const ZOOM_STEP = 1.2;
/** How much room a node revealed by the camera's `revealNode` keeps to the edge. */
export const REVEAL_MARGIN_PX = 24;
/** The zoom a graph too large to read at once is opened at, around the node that matters. */
const READABLE_ZOOM = 0.8;
/** Below this fit zoom the type is too small to read, and the view opens on the focus instead. */
const UNREADABLE_ZOOM = 0.5;

export const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** A world point rounded to the snap grid. */
export const snapPoint = (point: GraphPoint): GraphPoint => ({
  x: Math.round(point.x / SNAP) * SNAP,
  y: Math.round(point.y / SNAP) * SNAP,
});

/** The box round every node, or null for an empty graph. */
export function graphBounds(
  positions: Iterable<GraphPoint>,
  nodeSize: { width: number; height: number },
): GraphBounds | null {
  const points = [...positions];
  if (!points.length) return null;
  const halfWidth = nodeSize.width / 2;
  const halfHeight = nodeSize.height / 2;
  return {
    minX: Math.min(...points.map((point) => point.x)) - halfWidth,
    maxX: Math.max(...points.map((point) => point.x)) + halfWidth,
    minY: Math.min(...points.map((point) => point.y)) - halfHeight,
    maxY: Math.max(...points.map((point) => point.y)) + halfHeight,
  };
}

/**
 * The view that shows the whole graph, or — when that is too small to read and there is a node
 * that matters — the view that opens on that node instead.
 */
export function fitViewport(bounds: GraphBounds, size: CanvasSize, focus?: GraphPoint): Viewport {
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const zoom = clampZoom(
    Math.min(
      (size.width - FIT_PADDING_PX * 2) / Math.max(width, 1),
      (size.height - FIT_PADDING_PX * 2) / Math.max(height, 1),
      1,
    ),
  );
  if (focus && zoom < UNREADABLE_ZOOM) {
    return {
      zoom: READABLE_ZOOM,
      x: size.width / 2 - focus.x * READABLE_ZOOM,
      // A third of the way down: what a node leads to is below it, and that is what matters next.
      y: size.height / 3 - focus.y * READABLE_ZOOM,
    };
  }
  return {
    zoom,
    x: size.width / 2 - ((bounds.minX + bounds.maxX) / 2) * zoom,
    y: size.height / 2 - ((bounds.minY + bounds.maxY) / 2) * zoom,
  };
}

/** The view in which one node fills the canvas. */
export function viewportIntoNode(
  point: GraphPoint,
  size: CanvasSize,
  nodeSize: { width: number; height: number },
): Viewport {
  const zoom = Math.min(size.width / nodeSize.width, size.height / nodeSize.height) * 0.92;
  return { zoom, x: size.width / 2 - point.x * zoom, y: size.height / 2 - point.y * zoom };
}

/** The world point in the middle of the visible canvas. */
export function viewCenter(viewport: Viewport, size: CanvasSize): GraphPoint {
  return {
    x: (size.width / 2 - viewport.x) / viewport.zoom,
    y: (size.height / 2 - viewport.y) / viewport.zoom,
  };
}

/** How far to move along one axis so a node at `screen` keeps `margin` to both ends of `extent`. */
function shiftIntoView(screen: number, margin: number, extent: number): number {
  if (screen < margin) return margin - screen;
  if (screen > extent - margin) return extent - margin - screen;
  return 0;
}

/**
 * The pan, in screen pixels, that brings a node comfortably into view — zero on both axes when it
 * already is, because moving the picture under somebody who can see what they picked is worse than
 * not moving it.
 */
export function revealShift(
  point: GraphPoint,
  viewport: Viewport,
  size: CanvasSize,
  nodeSize: { width: number; height: number },
): { dx: number; dy: number } {
  const screenX = point.x * viewport.zoom + viewport.x;
  const screenY = point.y * viewport.zoom + viewport.y;
  const marginX = (nodeSize.width * viewport.zoom) / 2 + REVEAL_MARGIN_PX;
  const marginY = (nodeSize.height * viewport.zoom) / 2 + REVEAL_MARGIN_PX;
  return {
    dx: shiftIntoView(screenX, marginX, size.width),
    dy: shiftIntoView(screenY, marginY, size.height),
  };
}

/** The view after zooming by `factor` with the world point under (screenX, screenY) held still. */
export function zoomedAround(
  current: Viewport,
  factor: number,
  screenX: number,
  screenY: number,
): Viewport {
  const zoom = clampZoom(current.zoom * factor);
  const worldX = (screenX - current.x) / current.zoom;
  const worldY = (screenY - current.y) / current.zoom;
  return { zoom, x: screenX - worldX * zoom, y: screenY - worldY * zoom };
}

/** One frame of a flight, `t` being how far along it is (0 to 1) before easing. */
export function flightFrame(origin: Viewport, target: Viewport, t: number): Viewport {
  const eased = easeInOut(t);
  return {
    // Zoom on a log scale, so a flight across a large zoom range moves evenly.
    zoom: Math.exp(Math.log(origin.zoom) + (Math.log(target.zoom) - Math.log(origin.zoom)) * eased),
    x: origin.x + (target.x - origin.x) * eased,
    y: origin.y + (target.y - origin.y) * eased,
  };
}

/** How many pixels one wheel unit is, which depends on whether it counts pixels, lines or pages. */
export function wheelScale(deltaMode: number, pageHeight: number): number {
  if (deltaMode === 1) return 16;
  return deltaMode === 2 ? pageHeight : 1;
}

/** Where a pixel of the canvas element is in the world. */
export function toWorldPoint(
  client: { x: number; y: number },
  origin: { left: number; top: number },
  viewport: Viewport,
): GraphPoint {
  return {
    x: (client.x - origin.left - viewport.x) / viewport.zoom,
    y: (client.y - origin.top - viewport.y) / viewport.zoom,
  };
}

/** How the overview map draws the graph: its size and the scale and offset of the drawing. */
export type MinimapLayout = {
  width: number;
  height: number;
  scale: number;
  offsetX: number;
  offsetY: number;
};

const MINIMAP_WIDTH = 168;
const MINIMAP_HEIGHT = 104;
const MINIMAP_PADDING = 12;
/** A graph with fewer nodes than this is small enough to see whole, and has no overview. */
export const MINIMAP_MIN_NODES = 4;

export function minimapLayout(bounds: GraphBounds): MinimapLayout {
  const graphWidth = bounds.maxX - bounds.minX;
  const graphHeight = bounds.maxY - bounds.minY;
  const scale = Math.min(
    (MINIMAP_WIDTH - MINIMAP_PADDING) / Math.max(graphWidth, 1),
    (MINIMAP_HEIGHT - MINIMAP_PADDING) / Math.max(graphHeight, 1),
  );
  return {
    width: MINIMAP_WIDTH,
    height: MINIMAP_HEIGHT,
    scale,
    offsetX: (MINIMAP_WIDTH - graphWidth * scale) / 2 - bounds.minX * scale,
    offsetY: (MINIMAP_HEIGHT - graphHeight * scale) / 2 - bounds.minY * scale,
  };
}
