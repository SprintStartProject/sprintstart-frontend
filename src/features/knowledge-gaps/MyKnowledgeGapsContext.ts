import { createContext } from "react";
import type { KnowledgeGap } from "./types";

/**
 * The components the signed-in user owns that are missing documentation, and which of them
 * they have not looked at yet.
 *
 * Three things outside the knowledge-gaps pages need this: the dashboard's *default* layout,
 * which offers the gaps card in place of the knowledge base when there is something on it; the
 * sidebar, which flags the dashboard while something is unread; and the dialog that says a
 * component has been put in your name. All of them would otherwise ask the same question of
 * the backend on every page, so the answer is fetched once here and shared.
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
  /**
   * The components of those gaps the user has not acknowledged yet.
   *
   * Acknowledged means pressed, not seen: the dialog can be dismissed by accident, and going
   * to the dashboard is not the same as having taken it in. Only {@link markAllSeen} empties
   * this, which is what lets the sidebar flag honestly mean "there is something new here".
   */
  unseenComponents: string[];
  /** Acknowledges everything currently owned. Wired to the marker on the widget. */
  markAllSeen: () => void;
  isLoading: boolean;
  /** True only when the request failed — owning nothing is a successful empty answer. */
  hasFailed: boolean;
};

export const MyKnowledgeGapsContext = createContext<MyKnowledgeGapsValue | undefined>(undefined);
