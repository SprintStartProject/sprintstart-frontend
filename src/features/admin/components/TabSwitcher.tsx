import { FolderKanban, GraduationCap, Key, Users, type LucideIcon } from "lucide-react";
import { SegmentedTabs, type SegmentedTabOption } from "../../../components/ui/SegmentedTabs";
import { ADMIN_TAB_ORDER, type AdminTab } from "../types";

const TAB_META: Record<AdminTab, { label: string; icon: LucideIcon }> = {
  users: { label: "Users", icon: Users },
  projects: { label: "Projects", icon: FolderKanban },
  skills: { label: "Skills", icon: GraduationCap },
  tokens: { label: "Tokens", icon: Key },
};

type TabSwitcherProps = {
  activeTab: AdminTab;
  onChange: (tab: AdminTab) => void;
  /**
   * Tabs to render, in order. Defaults to every tab; callers pass a filtered
   * list to hide ones the signed-in role cannot use -- Skills is ADMIN-only,
   * every mutation on it 403s for HR.
   */
  tabs?: AdminTab[];
};

/**
 * Section navigation for the Access Management page. Each tab swaps the whole
 * panel below it.
 */
export function TabSwitcher({ activeTab, onChange, tabs = ADMIN_TAB_ORDER }: TabSwitcherProps) {
  const options: SegmentedTabOption<AdminTab>[] = tabs.map((key) => {
    const { label, icon: Icon } = TAB_META[key];
    return { value: key, label, icon: <Icon className="h-4 w-4" /> };
  });

  return (
    <SegmentedTabs
      value={activeTab}
      options={options}
      onChange={onChange}
      layoutId="admin-tab-pill"
      ariaLabel="Admin sections"
      // Mobile: the bar grows to fill the row and its pills stretch to
      // equal width, so it no longer sits left-aligned with dead space beside
      // the refresh button. Desktop keeps the compact, content-sized bar.
      // `grow`/`grow-0` (not `flex-1`) leaves each pill's own `shrink-0` intact.
      className="flex-1 sm:flex-none [&>button]:grow sm:[&>button]:grow-0"
    />
  );
}
