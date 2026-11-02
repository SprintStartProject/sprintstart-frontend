/**
 * The graph engine the blueprint canvas is built on, in one place.
 *
 * It lives in two other features -- the canvas and layout in `onboarding/graph`, the layout rules,
 * legend and wording in `graph-diagram` -- and no feature exposes an `index.ts` for it yet. Every
 * blueprint graph module takes it from here, so the coupling is one list instead of one import per
 * file. When the engine gets a public entry point, this file is the only one that changes.
 */
export {
  CanvasButton,
  JourneyCanvas,
  type JourneyCameraHandle,
  type JourneyEdgeTone,
} from "../onboarding/graph/JourneyCanvas.tsx";
export {
  layeredLayout,
  resolveLayout,
  type GraphPoint,
  type LayoutOptions,
} from "../onboarding/graph/layout.ts";
export {
  EDGE_REFUSAL_MESSAGE,
  GRAPH_NODE_HEIGHT,
  GRAPH_NODE_WIDTH,
  blockersBehind,
  chainPositions,
  dependentsAhead,
  edgeRefusal,
  entryPointIds,
  keyboardNeighbour,
  type ChainPosition,
  type GraphDirection,
  type GraphPositions,
} from "../graph-diagram/graphLayout.ts";
export { EdgeSwatch } from "../graph-diagram/EdgeLegend.tsx";
export { LOCK_SENTENCE } from "../graph-diagram/lockWords.ts";
