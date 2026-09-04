import { useCallback, useState } from "react";

import type { CanvasPosition, CanvasPositions } from "./canvasLayout";
import { canvasPositionStore } from "./canvasPositionStore";

export type CanvasPositionsApi = {
  positions: CanvasPositions;
  /** Where one card now sits, written through immediately — a drag has no save button. */
  place: (id: string, position: CanvasPosition) => void;
  /** The whole arrangement at once, for the auto-layout. */
  replaceAll: (positions: CanvasPositions) => void;
};

/** What is loaded, and which project it was loaded for. */
type LoadedPositions = { projectId: string | null; positions: CanvasPositions };

function load(projectId: string | null): LoadedPositions {
  return { projectId, positions: projectId ? canvasPositionStore.read(projectId) : {} };
}

/**
 * The canvas arrangement for one project, read when that project changes and written on every move.
 *
 * State and storage are kept in step by writing from the same updater that produces the new state,
 * rather than from an effect watching it: two drags in the same frame would otherwise write the
 * first one's positions twice and lose the second.
 *
 * Switching project resets during render rather than in an effect. An effect would paint one frame
 * of the previous project's arrangement over the new project's cards first — which is not a flicker
 * but a wrong drawing, since the ids do not match and every card would fall back to the grid.
 *
 * No project means an empty arrangement rather than a stale one.
 */
export function useCanvasPositions(projectId: string | null): CanvasPositionsApi {
  const [loaded, setLoaded] = useState<LoadedPositions>(() => load(projectId));
  if (loaded.projectId !== projectId) setLoaded(load(projectId));

  const positions = loaded.projectId === projectId ? loaded.positions : {};

  const setPositions = useCallback((update: (current: CanvasPositions) => CanvasPositions) => {
    setLoaded((current) => ({ ...current, positions: update(current.positions) }));
  }, []);

  const place = useCallback(
    (id: string, position: CanvasPosition) => {
      setPositions((current) => {
        const next = { ...current, [id]: position };
        if (projectId) canvasPositionStore.write(projectId, next);

        return next;
      });
    },
    [projectId, setPositions],
  );

  const replaceAll = useCallback(
    (next: CanvasPositions) => {
      setPositions(() => next);
      if (projectId) canvasPositionStore.write(projectId, next);
    },
    [projectId, setPositions],
  );

  return { positions, place, replaceAll };
}
