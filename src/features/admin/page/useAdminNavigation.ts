import { useSwipeableTabs } from "../../../hooks/useHorizontalWheelNavigation";
import type { AdminTab } from "../types";
import type { AdminDrawers } from "./useAdminDrawers";
import type { AdminSources } from "./useAdminSources";

/**
 * Switching tabs, the swipe between them, and what the refresh button refreshes.
 *
 * Returned as a pair, not an object: the swipe ref has to reach the page root without travelling
 * inside something the lint rule reads as used during render.
 */
export function useAdminNavigation(sources: AdminSources, drawers: AdminDrawers) {
  const { tabs, handoff, data, pool } = sources;
  const { activeTab, setActiveTab } = handoff;
  const isSkillsTabActive = activeTab === "skills";

  // Switching tabs only closes a drawer that is actually open; scheduling a close for nothing
  // would leave a timeout behind that could clear a drawer opened right after the switch.
  const changeTab = (tab: AdminTab) => {
    drawers.setOpenUserMenuId(null);
    if (drawers.isOpen) drawers.close();
    setActiveTab(tab);
  };

  // Two-finger swipe between the sections, for people who would rather not aim at the bar.
  const swipeRef = useSwipeableTabs<AdminTab, HTMLElement>({
    order: tabs,
    value: activeTab,
    onChange: changeTab,
  });

  const navigation = {
    changeTab,
    isRefreshing: isSkillsTabActive ? pool.loadingState === "loading" : data.isRefreshing,
    refresh: () => {
      if (isSkillsTabActive) void pool.loadSkillPool(true);
      else void data.refreshAdminData();
    },
  };

  return [swipeRef, navigation] as const;
}
