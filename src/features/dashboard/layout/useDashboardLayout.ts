import { useState } from "react";
import { isOnboardingAccessible } from "../../../auth/accessPolicy";
import { useAuth } from "../../../context/useAuth";
import { useProjectContext } from "../../projects/useProjectContext";
import { DASHBOARD_WIDGET_IDS, getAvailableWidgets } from "./catalog";
import * as operations from "./layoutOperations";
import { clearStoredLayout, readStoredLayout, storeLayout } from "./storage";
import type {
  DashboardLayout,
  DashboardWidgetDefinition,
  DashboardWidgetId,
  DashboardWidgetSize,
} from "./types";

export type DashboardLayoutController = {
  layout: DashboardLayout;
  /**
   * Everything this user may place, in catalog order — the picker's source.
   *
   * The whole catalog, not just what is missing: the picker ticks what is already on the board
   * rather than hiding it, so "have I got that one already?" is answered by the list itself.
   */
  availableWidgets: DashboardWidgetDefinition[];
  /** Whether the user has arranged anything, so "reset" is only offered when it does something. */
  isCustomized: boolean;
  /**
   * Takes one widget off the board — the card's own remove control in edit mode.
   *
   * The only single-widget placement move left. Adding used to have a twin here, back when the
   * picker added one card per click; the picker applies a whole selection now, so the twin had
   * no caller and went with it.
   */
  removeWidget: (id: DashboardWidgetId) => void;
  /**
   * Replaces the whole set of placed widgets — the picker's save.
   *
   * Everything still selected keeps its place and its size; see
   * {@link operations.setPlacedWidgets}.
   */
  setPlacedWidgets: (ids: ReadonlySet<DashboardWidgetId>) => void;
  resizeWidget: (id: DashboardWidgetId, size: DashboardWidgetSize) => void;
  /** Drops `id` where `targetId` currently sits. The pointer drag's only move. */
  moveWidgetTo: (id: DashboardWidgetId, targetId: DashboardWidgetId) => void;
  /** Shifts a widget one place. The keyboard's way to do the same thing. */
  moveWidgetBy: (id: DashboardWidgetId, offset: number) => void;
  resetLayout: () => void;
};

/**
 * The user's dashboard arrangement, and every way the edit mode can change it.
 *
 * Derived on render rather than mirrored into state by an effect: the layout is a function
 * of what the user last arranged, what they may currently have, and the default. A role that
 * changes underneath — a project switch that costs a PM their manager widgets, an onboarding
 * that finishes — simply produces a different answer, with no second render to catch up and
 * no window in which the board shows a card that can no longer load.
 *
 * Storage is only read while the user has not touched anything this session; from the first
 * edit on, `arrangedLayout` is the truth and storage is write-only. Every mutation writes
 * through immediately — there is no save button because there is nothing to lose: each
 * change is small, reversible, and the user is looking straight at the result.
 */
export function useDashboardLayout(): DashboardLayoutController {
  const { profile } = useAuth();
  const { canManageSelected } = useProjectContext();

  const userId = profile?.id ?? "";

  const [arrangedLayout, setArrangedLayout] = useState<DashboardLayout | null>(null);

  const availableWidgets = getAvailableWidgets({
    profile,
    canManageSelectedProject: canManageSelected,
    // Profile-only, so deciding whether to offer the onboarding card costs no request.
    hasLiveOnboarding: isOnboardingAccessible(profile),
  });

  const availableIds = availableWidgets.map((widget) => widget.id);

  const storedLayout = arrangedLayout ?? readStoredLayout(userId, DASHBOARD_WIDGET_IDS);

  const layout = operations.reconcileLayout(
    storedLayout ?? operations.buildDefaultLayout(availableIds),
    availableIds,
  );

  function apply(next: DashboardLayout) {
    setArrangedLayout(next);
    storeLayout(userId, next);
  }

  /** A drag fires per pointer move; writing an unchanged layout would hammer storage. */
  function applyIfChanged(next: DashboardLayout) {
    if (next !== layout) apply(next);
  }

  return {
    layout,
    availableWidgets,
    isCustomized: storedLayout !== null,

    removeWidget: (id) => apply(operations.removeWidget(layout, id)),
    setPlacedWidgets: (ids) => apply(operations.setPlacedWidgets(layout, ids, availableWidgets)),
    resizeWidget: (id, size) => apply(operations.resizeWidget(layout, id, size)),
    moveWidgetTo: (id, targetId) => applyIfChanged(operations.moveWidgetTo(layout, id, targetId)),
    moveWidgetBy: (id, offset) => applyIfChanged(operations.moveWidgetBy(layout, id, offset)),

    resetLayout: () => {
      clearStoredLayout(userId);
      setArrangedLayout(null);
    },
  };
}
