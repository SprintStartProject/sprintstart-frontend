import { EDGE_STYLE_SWATCH } from "../../graph-diagram";
import type { JourneyCanvasProps } from "./canvasTypes";
import { JourneyCanvasView } from "./JourneyCanvasView";
import type { LayoutNode } from "./layout";
import { useJourneyCanvas } from "./useJourneyCanvas";

export { CanvasButton } from "./CanvasButton";
export type {
  JourneyCameraHandle,
  JourneyEdgeTone,
  JourneyNodeEmphasis,
  JourneyNodeRenderState,
} from "./canvasTypes";

/**
 * A pan-and-zoom canvas for onboarding graphs.
 *
 * Built for reading first: a graph opens fitted to the screen, the node under the pointer lights up
 * everything it waits on and everything it unlocks, and edges say whether they are satisfied. Editing
 * sits on top of the same canvas -- dragging nodes, drawing edges from a node's port -- and is only
 * switched on by the caller.
 *
 * **Gestures follow the design tools people already know.** Two fingers on a trackpad pan, a pinch
 * (which browsers report as a wheel event with `ctrlKey`) zooms around the pointer, and dragging the
 * background pans. The wheel is consumed here and not passed on, so a two-finger swipe inside the
 * graph moves the graph rather than switching the page's tabs.
 *
 * Nodes are HTML, not SVG, so a card can use the same components as the rest of the app; only the
 * edges are SVG. All positions are world coordinates, and one transform on one layer maps them to the
 * screen -- which is what keeps a hundred nodes cheap to pan.
 */
export function JourneyCanvas<TNode extends LayoutNode>(props: JourneyCanvasProps<TNode>) {
  const model = useJourneyCanvas(props);
  return <JourneyCanvasView given={props} model={model} swatches={EDGE_STYLE_SWATCH} />;
}
