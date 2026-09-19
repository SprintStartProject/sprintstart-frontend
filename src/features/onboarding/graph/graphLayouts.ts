// ============================================================
// features/onboarding/graph/graphLayouts.ts
// ============================================================
// Where the nodes of a path's two graphs go. One place, because
// the journey map draws a small picture of every phase's graph,
// and that picture has to be the graph one zooms into.
// ============================================================

import { phaseItems } from "../journey";
import type { OnboardingPhaseEndpoint } from "../types";
import { resolveLayout, type GraphPoint, type LayoutOptions } from "./layout";
import { ITEM_NODE_SIZE, PHASE_NODE_SIZE } from "./nodeLabels";

export const ITEM_LAYOUT: LayoutOptions = { columnGap: 290, rowGap: 150, maxPerRow: 4 };
export const PHASE_LAYOUT: LayoutOptions = { columnGap: 330, rowGap: 250, maxPerRow: 4 };

export function itemGraphLayout(phase: OnboardingPhaseEndpoint): {
  positions: Map<string, GraphPoint>;
  isAutomatic: boolean;
} {
  return resolveLayout(phaseItems(phase), ITEM_LAYOUT, ITEM_NODE_SIZE);
}

export { ITEM_NODE_SIZE, PHASE_NODE_SIZE };
