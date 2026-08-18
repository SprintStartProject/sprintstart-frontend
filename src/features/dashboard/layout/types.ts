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
  | "team-insights"
  | "team-overview"
  | "data-ingestion"
  | "project-overview"
  | "user-overview";

/**
 * The sizes a widget can be given, in columns × rows of the underlying grid.
 *
 * Deliberately a short list of named steps rather than free resizing: a handful of shapes
 * that always tile cleanly is what keeps a rearranged dashboard from looking broken, and it
 * is the whole reason the grid can stay invisible.
 */
export type DashboardWidgetSize = "small" | "medium" | "large" | "wide" | "full";

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
   * Whether this user may place the widget at all.
   *
   * Asked for the picker, for the default layout, and again when a stored layout is read —
   * so a widget stops appearing the moment the role behind it goes away, rather than
   * rendering a card that can only 403.
   */
  isAvailable: (context: DashboardWidgetContext) => boolean;
  render: () => ReactNode;
};
