import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Sunrise } from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { SegmentedTabs, type SegmentedTabOption } from "../components/ui/SegmentedTabs";
import { SlidingTabPanel } from "../components/ui/SlidingTabPanel";
import { useSwipeableTabs } from "../hooks/useHorizontalWheelNavigation";
import { ArrivalSection } from "../features/arrival/components/ArrivalSection";
import { OverviewSection } from "../features/first-week/components/OverviewSection";
import { StarterWorkSection } from "../features/starter-work/components/StarterWorkSection";
import type { StarterWorkFocus } from "../features/starter-work/components/StarterWorkSection";

type FirstWeekTab = "overview" | "arrival" | "starter";

const TAB_ORDER: FirstWeekTab[] = ["overview", "arrival", "starter"];

const TAB_LABELS: Record<FirstWeekTab, string> = {
  overview: "Overview",
  arrival: "Arrival",
  starter: "Starter work",
};

function parseTab(value: string | null): FirstWeekTab {
  if (value === "starter") return "starter";
  if (value === "arrival") return "arrival";
  return "overview";
}

/**
 * Everything a PM/HR/ADMIN prepares for a new hire's first week, as tabs of one page: an Overview
 * dashboard, Arrival (what somebody needs before they can start) and Starter work (the first tasks
 * waiting once they do). Replaces the two standalone pages `/arrival-steps` and `/starter-work`,
 * which now redirect here.
 *
 * The active tab lives in the URL (`?tab=overview|arrival|starter`) so a deep link lands on the
 * right one. Each tab still renders its former page's content largely unchanged; the one exception
 * is Starter work's "Find with AI"/"Add tasks" buttons, which portal into this shared header's
 * top-right corner instead of sitting in that tab's own body.
 *
 * The Overview tab's cards jump straight into a specific state of the Starter work tab — "go
 * through the unreviewed queue", "show only Task 0 candidates" — rather than just switching tabs
 * and leaving the PM to find it themselves. That intent (`starterFocus`) is plain component state
 * rather than another URL param: it is a one-shot instruction for the tab about to mount, not
 * something worth a bookmarkable link, and `StarterWorkSection` clears it back to `null` once
 * acted on.
 */
export function FirstWeekPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseTab(searchParams.get("tab"));
  const [starterFocus, setStarterFocus] = useState<StarterWorkFocus | null>(null);
  // Measured via a callback ref rather than a plain `useRef`, so setting it triggers the re-render
  // that hands the freshly mounted node to `StarterWorkSection`'s portal.
  const [starterActionsHost, setStarterActionsHost] = useState<HTMLDivElement | null>(null);

  const handleTabChange = useCallback(
    (tab: FirstWeekTab) => {
      const nextSearchParams = new URLSearchParams(searchParams);
      nextSearchParams.set("tab", tab);
      setSearchParams(nextSearchParams, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const navigateFromOverview = useCallback(
    (tab: "arrival" | "starter", focus?: StarterWorkFocus) => {
      if (tab === "starter" && focus) setStarterFocus(focus);
      handleTabChange(tab);
    },
    [handleTabChange],
  );

  const tabOptions: SegmentedTabOption<FirstWeekTab>[] = useMemo(
    () => TAB_ORDER.map((tab) => ({ value: tab, label: TAB_LABELS[tab] })),
    [],
  );

  // Two-finger swipe between the tabs, matching Starter Work and Data Ingestion.
  const swipeRef = useSwipeableTabs<FirstWeekTab, HTMLElement>({
    order: TAB_ORDER,
    value: activeTab,
    onChange: handleTabChange,
  });

  return (
    <div className="min-h-screen">
      <header className="border-b border-app-border bg-app-bg/90 backdrop-blur-xl">
        <div className="app-page-frame py-6">
          <PageHeader
            icon={Sunrise}
            title="First Week"
            subtitle="What a new hire needs before they start, and the first work waiting for them once they do."
            actions={
              // Starter work's "Find with AI"/"Add tasks" buttons portal into this node instead of
              // sitting in the tab's own body — empty (and rendered) on the other tabs, which don't
              // use it.
              activeTab === "starter" ? (
                <div ref={setStarterActionsHost} className="flex flex-wrap items-center gap-2" />
              ) : undefined
            }
          />
        </div>
      </header>

      <main ref={swipeRef} className="app-page-frame py-6 lg:py-8">
        <SegmentedTabs
          value={activeTab}
          options={tabOptions}
          onChange={handleTabChange}
          layoutId="first-week-tab-pill"
          ariaLabel="First Week sections"
        />

        <SlidingTabPanel
          activeKey={activeTab}
          index={TAB_ORDER.indexOf(activeTab)}
          className="mt-5"
        >
          {activeTab === "overview" ? (
            <OverviewSection onNavigate={navigateFromOverview} />
          ) : activeTab === "arrival" ? (
            <ArrivalSection />
          ) : (
            <StarterWorkSection
              focus={starterFocus}
              onFocusHandled={() => setStarterFocus(null)}
              actionsPortalTarget={starterActionsHost}
            />
          )}
        </SlidingTabPanel>
      </main>
    </div>
  );
}
