/**
 * What the member's path section takes from the onboarding feature, in one place.
 *
 * It is the member's own journey drawn for their manager, so it reuses the journey's graph, aside,
 * navigator and rules -- and the onboarding feature exposes no `index.ts` for them yet. Every file
 * of the section takes them from here, so the coupling is one list instead of one import per file.
 * When onboarding gets a public entry point, this file is the only one that changes.
 */
export { computeRanks } from "../../../../onboarding/graph/layout.ts";
export {
  memberJourneyViewKey,
  readJourneyView,
  writeJourneyView,
} from "../../../../onboarding/journeyViewMemory.ts";
export { ItemAside } from "../../../../onboarding/components/journey/ItemAside.tsx";
export {
  JourneyGraph,
  type GraphEditing,
} from "../../../../onboarding/components/journey/JourneyGraph.tsx";
export { PhaseNavigator } from "../../../../onboarding/components/journey/PhaseNavigator.tsx";
export { StepOriginBadge } from "../../../../onboarding/components/StepOriginBadge.tsx";
export {
  ItemFlags,
  ItemGlyph,
  ItemKindIcon,
} from "../../../../onboarding/graph/JourneyNodeCards.tsx";
export { itemKindLabel, itemStateLabel } from "../../../../onboarding/graph/nodeLabels.ts";
export {
  blockingPhases,
  formatMinutes,
  itemState,
  orderedPhaseItems,
  skipRequestOf,
  phaseItems,
  phaseProgress,
  phaseState,
  sortedPhases,
  unlockedBy,
  waitingOn,
  type PhaseItem,
} from "../../../../onboarding/journey.ts";
export { resolveNextAction } from "../../../../onboarding/nextAction.ts";
export type {
  OnboardingPathEndpoint,
  OnboardingPhaseEndpoint,
} from "../../../../onboarding/types.ts";
