import { CalendarClock, Plus } from "lucide-react";
import type { ActiveTab } from "../types.ts";

const TABS: ActiveTab[] = ["sources", "artifacts", "runs", "connectors"];

type DataIngestionTabsProps = {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onAddSource: () => void;
  onOpenSyncSettings?: () => void;
};

/**
 * Navigation tabs for the data ingestion dashboard.
 * Switches between sources, artifacts, runs, and connectors views, and provides the "Add Source" action.
 */
export function DataIngestionTabs({
  activeTab,
  onTabChange,
  onAddSource,
  onOpenSyncSettings,
}: DataIngestionTabsProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-app-border px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="max-w-full overflow-x-auto">
        <div className="flex w-max rounded-xl bg-app-bg-soft p-1">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => onTabChange(tab)}
              className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition ${
                activeTab === tab
                  ? "bg-app-brand text-app-text-inverse"
                  : "text-app-text-muted hover:text-app-text"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {onOpenSyncSettings && (
          <button
            type="button"
            onClick={onOpenSyncSettings}
            aria-label="Open sync settings"
            title="Sync settings"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-app-border bg-app-surface text-app-text-muted transition hover:bg-app-surface-hover hover:text-app-text focus:outline-none focus-visible:ring-2 focus-visible:ring-app-focus"
          >
            <CalendarClock size={18} />
          </button>
        )}

        <button
          type="button"
          onClick={onAddSource}
          className="flex items-center justify-center gap-2 rounded-xl bg-app-brand px-4 py-3 text-sm font-semibold text-app-text-inverse transition hover:bg-app-brand-hover"
        >
          <Plus size={16} />
          Add Source
        </button>
      </div>
    </div>
  );
}
