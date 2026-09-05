import { createContext } from "react";
import type { KnowledgeGap } from "./types";

/**
 * The components the signed-in user owns that are missing documentation.
 *
 * Two things outside the knowledge-gaps pages need this and neither of them is the widget that
 * shows it: the dashboard's *default* layout, which offers the gaps card in place of the
 * knowledge base when there is something on it, and the announcement that tells somebody they
 * have just been made an owner. Both would otherwise ask the same question of the backend on
 * every page, so the answer is fetched once here and shared.
 */
export type MyKnowledgeGapsValue = {
  /**
   * The user's own gaps, `covered` components already dropped.
   *
   * A covered component is one that was scanned and found to be missing nothing — it is not a
   * smaller gap, it is not a gap, and counting it would put an empty card on a dashboard and
   * announce an owner with nothing to do.
   */
  gaps: KnowledgeGap[];
  isLoading: boolean;
  /** True only when the request failed — owning nothing is a successful empty answer. */
  hasFailed: boolean;
};

export const MyKnowledgeGapsContext = createContext<MyKnowledgeGapsValue | undefined>(undefined);
