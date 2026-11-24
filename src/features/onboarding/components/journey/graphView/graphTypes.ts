import type { ReactNode } from "react";
import type { GraphNodePosition } from "../../../../../services/onboardingGraphService";
import type { PhaseItem } from "../../../journey";
import type { GraphPoint } from "../../../graph/layout";
import type { OnboardingPhaseEndpoint } from "../../../../../services/onboardingTypes";

export type GraphEditing = {
  connectItems: (phaseId: string, blockerId: string, nodeId: string) => Promise<void>;
  disconnectItems: (phaseId: string, blockerId: string, nodeId: string) => Promise<void>;
  connectPhases: (blockerId: string, phaseId: string) => Promise<void>;
  disconnectPhases: (blockerId: string, phaseId: string) => Promise<void>;
  /** Adds a blank step to a phase at a point of its graph. */
  addStep: (phaseId: string, position: GraphPoint) => Promise<void>;
};

export type SaveLayout = {
  phase: (phaseId: string, nodes: GraphNodePosition[]) => Promise<void>;
  path: (nodes: GraphNodePosition[]) => Promise<void>;
};

export type JourneyGraphProps = {
  phases: OnboardingPhaseEndpoint[];
  /** The phase zoomed into, or null for the journey map. */
  openPhaseId: string | null;
  onOpenPhaseChange: (phaseId: string | null) => void;
  /** The phase the member was last busy in; marked on the map. */
  focusPhaseId: string | null;
  /** The item the member should do next; marked inside its phase. */
  nextItemId?: string | null;
  /** Persist positions. Absent means the layout can only be changed for this visit. */
  saveLayout?: SaveLayout;
  /** Rewire edges and add steps -- the PM's tools. */
  editing?: GraphEditing;
  selectedItemId: string | null;
  onSelectItem: (id: string | null) => void;
  /** Double click or Enter on an item. */
  onOpenItem?: (item: PhaseItem) => void;
  /** Details of the selected item, drawn over the canvas. */
  renderItemAside?: (item: PhaseItem, phase: OnboardingPhaseEndpoint) => ReactNode;
  /**
   * The item zoomed into until it fills the graph, and how to draw it. Given these, a click on an item
   * flies into it instead of selecting it -- the hire's way of working through a phase on the graph.
   */
  openItemId?: string | null;
  onOpenItemChange?: (itemId: string | null) => void;
  renderItemFocus?: (item: PhaseItem, phase: OnboardingPhaseEndpoint) => ReactNode;
  heightClassName?: string;
  /** Mark what changed since the member last looked (answered skip requests) -- the hire's view. */
  showMemberUpdates?: boolean;
};
