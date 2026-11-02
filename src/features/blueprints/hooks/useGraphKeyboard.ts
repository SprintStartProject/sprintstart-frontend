import { useCallback, type KeyboardEvent, type RefObject } from "react";
import {
  type GraphDirection,
  type GraphPoint,
  type GraphPositions,
  type JourneyCameraHandle,
  keyboardNeighbour,
} from "../graphKit.ts";
import type { BlueprintGraphCanvasNode } from "../components/blueprintGraphCanvasTypes.ts";

const DIRECTIONS: Record<string, GraphDirection> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
};

type Params = {
  nodes: BlueprintGraphCanvasNode[];
  positions: Map<string, GraphPoint>;
  entryPoints: ReadonlySet<string>;
  selectedId: string | null;
  setSelectedId: (id: string) => void;
  camera: RefObject<JourneyCameraHandle | null>;
};

/**
 * Arrow keys move between nodes.
 *
 * Listened for on the surface rather than on a node: the canvas owns the pointer gestures and the
 * zoom keys, and which node is "left" of this one is a question about the graph, not about the DOM
 * order the nodes happen to be in. See {@link keyboardNeighbour} for what "left" means.
 */
export function useGraphKeyboard(params: Params) {
  const { nodes, positions, entryPoints, selectedId, setSelectedId, camera } = params;

  return useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const direction = DIRECTIONS[event.key];
      if (!direction) return;
      // Inside a field, an arrow key is a cursor.
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select")) {
        return;
      }

      const from = selectedId ?? [...entryPoints][0] ?? nodes[0]?.id;
      if (!from) return;

      const geometry: GraphPositions = Object.fromEntries(positions);
      const next = selectedId === null ? from : keyboardNeighbour(nodes, geometry, from, direction);
      if (!next) return;

      event.preventDefault();
      setSelectedId(next);
      // Focus follows the ring, and the view follows both.
      //
      // Enter is handled on the focused node, so a ring that moved on its own meant the ring sat on
      // one node and Enter opened another -- whichever had last been focused. And the ring can walk
      // off the visible canvas, which is the same problem one step later.
      const surface = event.currentTarget;
      window.requestAnimationFrame(() => {
        surface.querySelector<HTMLElement>(`[data-journey-node="${next}"]`)?.focus();
        void camera.current?.revealNode(next);
      });
    },
    [camera, entryPoints, nodes, positions, selectedId, setSelectedId],
  );
}
