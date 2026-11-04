/**
 * The graph engine the blueprint canvas is built on, in one place.
 *
 * It lives in two other features -- the canvas and layout in `onboarding`, the layout rules, legend
 * and wording in `graph-diagram` -- and both expose it through their `index.ts`. Every blueprint
 * graph module takes it from here, so the coupling is one list instead of one import per file.
 */
export {
  CanvasButton,
  JourneyCanvas,
  layeredLayout,
  resolveLayout,
  type GraphPoint,
  type JourneyCameraHandle,
  type LayoutOptions,
} from "../onboarding";
export {
  EDGE_REFUSAL_MESSAGE,
  GRAPH_NODE_HEIGHT,
  GRAPH_NODE_WIDTH,
  LOCK_SENTENCE,
  EdgeSwatch,
  blockersBehind,
  chainPositions,
  dependentsAhead,
  edgeRefusal,
  entryPointIds,
  keyboardNeighbour,
  type ChainPosition,
  type GraphDirection,
  type GraphPositions,
  type JourneyEdgeTone,
} from "../graph-diagram";
