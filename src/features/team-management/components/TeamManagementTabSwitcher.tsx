import { Shield, Users, type LucideIcon } from "lucide-react";
import { SegmentedTabs, type SegmentedTabOption } from "../../../components/ui/SegmentedTabs";
import { TEAM_MANAGEMENT_TAB_ORDER, type TeamManagementTab } from "../types";

const TAB_META: Record<TeamManagementTab, { label: string; icon: LucideIcon }> = {
  members: { label: "User Management", icon: Users },
  roles: { label: "Role Management", icon: Shield },
};

type TeamManagementTabSwitcherProps = {
  activeTab: TeamManagementTab;
  onChange: (tab: TeamManagementTab) => void;
  /**
   * Tabs to render, in `TEAM_MANAGEMENT_TAB_ORDER`. Defaults to all of them;
   * the page narrows it when a tab has nothing to offer the current user.
   */
  tabs?: TeamManagementTab[];
};

/**
 * Section navigation for the Team Management page. Mirrors the Access
 * Management switcher so both pages share one look; each tab swaps the whole
 * panel below it.
 */
export function TeamManagementTabSwitcher({
  activeTab,
  onChange,
  tabs = TEAM_MANAGEMENT_TAB_ORDER,
}: TeamManagementTabSwitcherProps) {
  const options: SegmentedTabOption<TeamManagementTab>[] = tabs.map((key) => {
    const { label, icon: Icon } = TAB_META[key];

    return { value: key, label, icon: <Icon className="h-4 w-4" /> };
  });

  return (
    <SegmentedTabs
      value={activeTab}
      options={options}
      onChange={onChange}
      layoutId="team-management-tab-pill"
      ariaLabel="Team management sections"
      // Hiding the scrollbar used to live here; `SegmentedTabs` does it for
      // every bar now. Only the width is this bar's own business.
      className="w-full sm:w-auto"
    />
  );
}
