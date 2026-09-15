import { useContext } from "react";
import { MyKnowledgeGapsContext, type MyKnowledgeGapsValue } from "./MyKnowledgeGapsContext";

/** What a caller outside the provider sees: nothing owned, nothing loading, nothing broken. */
const NONE: MyKnowledgeGapsValue = {
  gaps: [],
  unseenComponents: [],
  markAllSeen: () => {},
  isLoading: false,
  hasFailed: false,
};

/**
 * The gaps assigned to the signed-in user.
 *
 * Falls back to an empty answer outside `MyKnowledgeGapsProvider` rather than throwing the way
 * `useProjectContext` does. The difference is what a missing provider means: a component
 * rendered without the project selection is broken, whereas one rendered without this is
 * merely being shown in isolation — a test, a story — and "you own nothing" is the honest
 * reading of no data, not a silent divergence.
 */
export function useMyKnowledgeGaps(): MyKnowledgeGapsValue {
  return useContext(MyKnowledgeGapsContext) ?? NONE;
}
