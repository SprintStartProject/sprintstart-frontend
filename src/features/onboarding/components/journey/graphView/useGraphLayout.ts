import { useMemo, useState } from "react";
import { useToast } from "../../../../../context/useToast";
import { phaseItems, type PhaseItem } from "../../../journey";
import {
  ITEM_LAYOUT,
  PHASE_LAYOUT,
  PHASE_NODE_SIZE,
  itemGraphLayout,
} from "../../../graph/graphLayouts";
import { layeredLayout, resolveLayout, type GraphPoint } from "../../../graph/layout";
import type { OnboardingPhaseEndpoint } from "../../../../../services/onboardingTypes";
import {
  MAP_KEY,
  PHASE_KEY,
  mergeLocalPositions,
  nodesToSave,
  phaseNodesOf,
  type PhaseNode,
} from "./graphRules";
import type { SaveLayout } from "./graphTypes";

type Overrides = Record<string, Record<string, GraphPoint>>;

type GraphLayout = {
  phaseNodes: PhaseNode[];
  items: PhaseItem[];
  positions: Map<string, GraphPoint>;
  isAutomatic: boolean;
  onMove: (id: string, point: GraphPoint) => void;
  tidy: () => void;
};

/** Moves shown before the server has them, keyed per graph; dropped when fresh data arrives. */
function useOverrides(phases: OnboardingPhaseEndpoint[]) {
  const [overrides, setOverrides] = useState<Overrides>({});
  const [lastPhases, setLastPhases] = useState(phases);
  if (lastPhases !== phases) {
    setLastPhases(phases);
    setOverrides({});
  }
  return [overrides, setOverrides] as const;
}

/**
 * Where every node of the graph on screen sits — the map's phases, or the open phase's steps and
 * questions — and how a move or a tidy-up is shown at once and saved. A save that fails puts the
 * graph back and says so.
 */
export function useGraphLayout(
  phases: OnboardingPhaseEndpoint[],
  openPhase: OnboardingPhaseEndpoint | null,
  saveLayout: SaveLayout | undefined,
): GraphLayout {
  const toast = useToast();
  const [overrides, setOverrides] = useOverrides(phases);
  const graphKey = openPhase ? PHASE_KEY(openPhase.id) : MAP_KEY;

  const phaseNodes = useMemo(() => phaseNodesOf(phases), [phases]);
  const items = useMemo(() => (openPhase ? phaseItems(openPhase) : []), [openPhase]);

  const { positions, isAutomatic } = useMemo(
    () =>
      mergeLocalPositions(
        openPhase
          ? itemGraphLayout(openPhase)
          : resolveLayout(phaseNodes, PHASE_LAYOUT, PHASE_NODE_SIZE),
        overrides[graphKey],
      ),
    [graphKey, openPhase, overrides, phaseNodes],
  );

  const persist = async (next: Map<string, GraphPoint>, changedIds: string[]) => {
    const previous = overrides[graphKey];
    setOverrides((current) => ({
      ...current,
      [graphKey]: { ...(current[graphKey] ?? {}), ...Object.fromEntries(next) },
    }));
    if (!saveLayout) return;
    const nodes = nodesToSave(next, changedIds, isAutomatic);
    try {
      if (openPhase) await saveLayout.phase(openPhase.id, nodes);
      else await saveLayout.path(nodes);
    } catch (error) {
      setOverrides((current) => ({ ...current, [graphKey]: previous ?? {} }));
      toast.error("Couldn't save the layout", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const onMove = (id: string, point: GraphPoint) => {
    const next = new Map(positions);
    next.set(id, point);
    void persist(next, [id]);
  };

  const tidy = () => {
    void persist(
      openPhase ? layeredLayout(items, ITEM_LAYOUT) : layeredLayout(phaseNodes, PHASE_LAYOUT),
      [],
    );
  };

  return { phaseNodes, items, positions, isAutomatic, onMove, tidy };
}
