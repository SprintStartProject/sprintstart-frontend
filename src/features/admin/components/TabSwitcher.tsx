import { Key, Layers, Users, type LucideIcon } from "lucide-react";
import { SegmentedTabs, type SegmentedTabOption } from "../../../components/ui/SegmentedTabs";
import { ADMIN_TAB_ORDER, type AdminTab } from "../types";

const TAB_META: Record<AdminTab, { label: string; icon: LucideIcon }> = {
  users: { label: "Users", icon: Users },
  projects: { label: "Projects", icon: Layers },
  tokens: { label: "Tokens", icon: Key },
};

type TabSwitcherProps = {
  activeTab: AdminTab;
  onChange: (tab: AdminTab) => void;
};

/**
 * Section navigation for the Access Management page. Each tab swaps the whole
 * panel below it.
 */
export function TabSwitcher({ activeTab, onChange }: TabSwitcherProps) {
  const options: SegmentedTabOption<AdminTab>[] = ADMIN_TAB_ORDER.map((key) => {
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
      className="w-full sm:w-auto"
    />
  );
}
