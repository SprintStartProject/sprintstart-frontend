import type { GraphNodePosition } from "../../../../../services/onboardingGraphService";
import {
  isItemComplete,
  itemState,
  phaseProgress,
  phaseState,
  type PhaseItem,
} from "../../../journey";
import type { JourneyEdgeTone } from "../../../graph/JourneyCanvas";
import { itemStateLabel, phaseStateLabel } from "../../../graph/nodeLabels";
import type { GraphPoint } from "../../../graph/layout";
import { ITEM_NODE_SIZE } from "../../../graph/graphLayouts";
import type { OnboardingPhaseEndpoint } from "../../../types";
import type { GraphEditing } from "./graphTypes";

export type PhaseNode = {
  id: string;
  blockerIds: string[];
  graphX: number | null;
  graphY: number | null;
  phase: OnboardingPhaseEndpoint;
  index: number;
};

export const PHASE_KEY = (id: string) => `phase:${id}`;
export const MAP_KEY = "journey";

/** The arrow styles the journey graphs actually draw, for the legend beside them. */
export const MAP_EDGE_TONES: readonly JourneyEdgeTone[] = ["done", "active", "waiting"];

export function phaseNodesOf(phases: OnboardingPhaseEndpoint[]): PhaseNode[] {
  return phases.map((phase, index) => ({
    id: phase.id,
    blockerIds: phase.blockerIds ?? [],
    graphX: phase.graphX ?? null,
    graphY: phase.graphY ?? null,
    phase,
    index,
  }));
}

/** The resolved layout with this visit's not-yet-saved moves laid over it. */
export function mergeLocalPositions(
  resolved: { positions: Map<string, GraphPoint>; isAutomatic: boolean },
  local: Record<string, GraphPoint> | undefined,
): { positions: Map<string, GraphPoint>; isAutomatic: boolean } {
  if (!local) return resolved;
  const merged = new Map(resolved.positions);
  Object.entries(local).forEach(([id, point]) => merged.set(id, point));
  return { positions: merged, isAutomatic: resolved.isAutomatic };
}

/**
 * The positions to save: every node while the graph is still on its automatic layout (or when no
 * single node changed, as after tidying up), else just the ones that moved.
 */
export function nodesToSave(
  next: Map<string, GraphPoint>,
  changedIds: string[],
  isAutomatic: boolean,
): GraphNodePosition[] {
  const ids = isAutomatic || changedIds.length === 0 ? [...next.keys()] : changedIds;
  return ids.map((id) => ({ id, graphX: next.get(id)!.x, graphY: next.get(id)!.y }));
}

/** Never on top of a card: slides the spot down until nothing is within a card's reach of it. */
export function freeSpot(point: GraphPoint, taken: GraphPoint[]): GraphPoint {
  const spot = { ...point };
  const overlaps = () =>
    taken.some(
      (other) =>
        Math.abs(other.x - spot.x) < ITEM_NODE_SIZE.width + 16 &&
        Math.abs(other.y - spot.y) < ITEM_NODE_SIZE.height + 16,
    );
  while (overlaps()) {
    spot.y += ITEM_NODE_SIZE.height + 32;
  }
  return spot;
}

/** An arrow between two phases: grey while its source is open, then live, then done. */
export function phaseEdgeTone(blocker: PhaseNode, node: PhaseNode): JourneyEdgeTone {
  if (phaseState(blocker.phase) !== "done") return "waiting";
  const nodeState = phaseState(node.phase);
  return nodeState === "open" || nodeState === "active" ? "active" : "done";
}

/** An arrow between two steps or questions of one phase. */
export function itemEdgeTone(
  blocker: PhaseItem,
  node: PhaseItem,
  locked: boolean,
): JourneyEdgeTone {
  const blockerState = itemState(blocker, locked);
  const nodeState = itemState(node, locked);
  if (!isItemComplete(blockerState)) return "waiting";
  return !isItemComplete(nodeState) && nodeState !== "locked" ? "active" : "done";
}

export function phaseNodeLabel(node: PhaseNode): string {
  return `Phase ${node.index + 1}: ${node.phase.title}, ${phaseStateLabel[phaseState(node.phase)]}, ${phaseProgress(node.phase).percentage}% complete`;
}

/**
 * The state is part of the name: the card's own text sits under this label, so a locked step and one
 * in progress would otherwise sound the same.
 */
export function itemNodeLabel(item: PhaseItem, locked: boolean): string {
  return `${item.kind === "step" ? "Step" : "Question"}: ${item.title}, ${itemStateLabel[itemState(item, locked)]}`;
}

export function arrangeLabel(arranging: boolean, editing: GraphEditing | undefined): string {
  if (arranging) return "Done arranging";
  return editing ? "Edit: move nodes and draw connections" : "Arrange nodes";
}

export function mapHint(arranging: boolean, editing: GraphEditing | undefined): string {
  if (!arranging) return "· Click a phase to step inside";
  return editing
    ? "· Drag phases, or from a phase’s port to what it unlocks"
    : "· Drag phases to arrange them";
}

/** What the open phase's graph shows beyond the nodes: the selected item, or the item opened up. */
export function derivePhaseView(
  items: PhaseItem[],
  selectedItemId: string | null,
  openItemId: string | null,
  entersItems: boolean,
): { selectedItem: PhaseItem | null; focusedItem: PhaseItem | null } {
  return {
    selectedItem: items.find((item) => item.id === selectedItemId) ?? null,
    focusedItem: entersItems ? (items.find((item) => item.id === openItemId) ?? null) : null,
  };
}

/** The handler for Enter or a double click on an item, only where there is something to open. */
export function itemOpener(
  items: PhaseItem[],
  onOpenItem: ((item: PhaseItem) => void) | undefined,
): ((id: string) => void) | undefined {
  if (!onOpenItem) return undefined;
  return (id) => {
    const item = items.find((candidate) => candidate.id === id);
    if (item) onOpenItem(item);
  };
}

/** The nodes of an edit, in the shape the cycle/duplicate rules read. */
export function ruleNodes(nodes: { id: string; blockerIds?: string[] }[]) {
  return nodes.map((node) => ({
    id: node.id,
    blockerIds: node.blockerIds ?? [],
    graphX: null,
    graphY: null,
  }));
}

/** Every node where it stands now, to pin an automatic layout before a new node is added. */
export function pinnedPositions(positions: Map<string, GraphPoint>): GraphNodePosition[] {
  return [...positions].map(([id, position]) => ({ id, graphX: position.x, graphY: position.y }));
}
