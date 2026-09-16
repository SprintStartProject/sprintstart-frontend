import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Sunrise } from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { SegmentedTabs, type SegmentedTabOption } from "../components/ui/SegmentedTabs";
import { SlidingTabPanel } from "../components/ui/SlidingTabPanel";
import { useSwipeableTabs } from "../hooks/useHorizontalWheelNavigation";
import { ArrivalSection } from "../features/arrival/components/ArrivalSection";
import { StarterWorkSection } from "../features/starter-work/components/StarterWorkSection";

type FirstWeekTab = "arrival" | "starter";

const TAB_ORDER: FirstWeekTab[] = ["arrival", "starter"];

const TAB_LABELS: Record<FirstWeekTab, string> = {
  arrival: "Arrival",
  starter: "Starter work",
};

function parseTab(value: string | null): FirstWeekTab {
  return value === "starter" ? "starter" : "arrival";
}

/**
 * Everything a PM/HR/ADMIN prepares for a new hire's first week, as tabs of one page: Arrival
 * (what somebody needs before they can start) and Starter work (the first tasks waiting once they
 * do). Replaces the two standalone pages `/arrival-steps` and `/starter-work`, which now redirect
 * here.
 *
 * The active tab lives in the URL (`?tab=arrival|starter`) so a deep link lands on the right one.
 * Each tab still renders its former page's content unchanged, including that page's own header and
 * actions — this phase only builds the shell around them.
 */
export function FirstWeekPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseTab(searchParams.get("tab"));

  const handleTabChange = useCallback(
    (tab: FirstWeekTab) => {
      const nextSearchParams = new URLSearchParams(searchParams);
      nextSearchParams.set("tab", tab);
      setSearchParams(nextSearchParams, { replace: true });
    },
    [searchParams, setSearchParams],
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
          {activeTab === "arrival" ? <ArrivalSection /> : <StarterWorkSection />}
        </SlidingTabPanel>
      </main>
    </div>
  );
}
