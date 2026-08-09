import { FolderKanban, Shield, Users, type LucideIcon } from 'lucide-react';
import {
    SegmentedTabs,
    type SegmentedTabOption,
} from '../../../components/ui/SegmentedTabs';
import { TEAM_MANAGEMENT_TAB_ORDER, type TeamManagementTab } from '../types';

const TAB_META: Record<
    TeamManagementTab,
    { label: string; icon: LucideIcon }
> = {
    members: { label: 'User Management', icon: Users },
    roles: { label: 'Role Management', icon: Shield },
    projects: { label: 'Project Management', icon: FolderKanban },
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
    const options: SegmentedTabOption<TeamManagementTab>[] =
        tabs.map((key) => {
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
            // These two labels are long enough that the hover magnification
            // pushes past the bar's 4px padding, and the global slim
            // scrollbar then draws a stray line under the tabs. Nothing here
            // ever needs to scroll -- both options always fit -- so the
            // scrollbar is hidden rather than the overflow removed, which
            // would clip the magnified option on narrow screens.
            //
            // `!important` is required, not defensive: the global rule is
            // `* { scrollbar-width: thin }` and sits outside any cascade
            // layer, so it beats every Tailwind utility no matter how
            // specific. The webkit rule is the fallback for Chrome below 121,
            // which does not support `scrollbar-width` at all; newer Chrome
            // ignores `::-webkit-scrollbar` once `scrollbar-width` is set.
            className="w-full [scrollbar-width:none]! sm:w-auto [&::-webkit-scrollbar]:hidden"
        />
    );
}
