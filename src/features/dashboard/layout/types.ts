// ============================================================
// features/dashboard/layout/types.ts
// ============================================================
// The vocabulary of the configurable dashboard: which widgets
// exist, how big they may be, and who is allowed to place them.
// ============================================================

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import type { UserProfile } from "../../../services/types";

/**
 * Every widget the dashboard knows about.
 *
 * A closed union rather than a string: the ids end up in a user's stored layout, so a typo
 * would survive a refresh as a permanently broken card. Adding a widget means adding it
 * here and to the catalog, and the compiler finds every place that has to keep up.
 */
export type DashboardWidgetId =
  | "greeting"
  | "onboarding"
  | "recent-chats"
  | "knowledge-base"
  | "ask-chat"
  | "skills"
  | "my-knowledge-gaps"
  | "team-insights"
  | "team-overview"
  | "data-ingestion"
  | "project-overview"
  | "user-overview";

/**
 * The sizes a widget can be given: a quarter row, a half row, or a whole one.
 *
 * Three and not more, because 1 + 2 + 4 is what lets any combination fill a four-column row
 * exactly — that is what keeps a rearranged dashboard from developing gaps, and the whole
 * reason the grid can stay invisible.
 */
export type DashboardWidgetSize = "small" | "medium" | "wide";

/** One placed widget. Order in the layout is the reading order on screen. */
export type DashboardLayoutItem = {
  id: DashboardWidgetId;
  size: DashboardWidgetSize;
};

export type DashboardLayout = DashboardLayoutItem[];

/**
 * Which group of widgets a card belongs to.
 *
 * Only used to group the picker, never to decide access — that is
 * {@link DashboardWidgetDefinition.isAvailable}, which asks the access policy rather than
 * the label.
 */
export type DashboardWidgetTier = "user" | "manager" | "admin";

/** What a widget needs to know about the signed-in user to decide whether it applies. */
export type DashboardWidgetContext = {
  profile: UserProfile | null;
  /** Whether the user manages the globally selected project. Only meaningful for a PM. */
  canManageSelectedProject: boolean;
  /** Whether the user has an onboarding journey that is still running. */
  hasLiveOnboarding: boolean;
};

export type DashboardWidgetDefinition = {
  id: DashboardWidgetId;
  /** Shown in the picker and as the widget's label while the dashboard is being edited. */
  title: string;
  /** One line in the picker saying what the card is for. */
  description: string;
  icon: LucideIcon;
  tier: DashboardWidgetTier;
  /** The sizes this widget looks right at, smallest first. */
  sizes: readonly DashboardWidgetSize[];
  defaultSize: DashboardWidgetSize;
  /**
   * Whether the `wide` form needs both rows rather than the single-row strip.
   *
   * Set it only for a widget whose wide form is a real card — a header with its own action,
   * and columns beneath it. Everything else reads better as a band across the row, and a
   * board of full-width rectangles stops looking like a dashboard.
   */
  isTallWhenWide?: boolean;
  /**
   * Whether this user may place the widget at all.
   *
   * Asked for the picker, for the default layout, and again when a stored layout is read —
   * so a widget stops appearing the moment the role behind it goes away, rather than
   * rendering a card that can only 403.
   */
  isAvailable: (context: DashboardWidgetContext) => boolean;
  /**
   * Renders the widget at the size it was given.
   *
   * Handed the size rather than reading it, because a card is a different card at a quarter
   * of a row than at a whole one — a wide card that only stretched its medium layout wastes
   * the space it asked for, and a small one that shrank it becomes unreadable.
   */
  render: (size: DashboardWidgetSize) => ReactNode;
};
