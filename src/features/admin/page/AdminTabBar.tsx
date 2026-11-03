import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Spinner } from "../../../components/ui/Spinner";
import { TabSwitcher } from "../components/TabSwitcher";
import type { AdminTab } from "../types";

type AdminTabBarProps = {
  tabs: AdminTab[];
  activeTab: AdminTab;
  isRefreshing: boolean;
  onChange: (tab: AdminTab) => void;
  onRefresh: () => void;
};

/** The sections, and the button that reloads whichever one is showing. */
export function AdminTabBar({
  tabs,
  activeTab,
  isRefreshing,
  onChange,
  onRefresh,
}: AdminTabBarProps) {
  return (
    <div className="mb-6 flex items-center gap-3 sm:justify-between">
      <TabSwitcher activeTab={activeTab} onChange={onChange} tabs={tabs} />

      <Button
        variant="secondary"
        iconOnly
        onClick={onRefresh}
        disabled={isRefreshing}
        className="shrink-0"
        aria-label="Refresh admin data"
      >
        <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
      </Button>
    </div>
  );
}

export function AdminLoading() {
  return (
    <div className="flex min-h-96 items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-app-text-muted">
        <Spinner size="lg" silent />
        <p className="text-sm">Loading admin data...</p>
      </div>
    </div>
  );
}

export function AdminLoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex min-h-96 items-center justify-center px-6 text-center">
      <div className="max-w-md">
        <AlertCircle className="mx-auto mb-4 h-10 w-10 text-app-danger-solid" />
        <h3 className="text-sm font-semibold text-app-text">Admin data could not be loaded</h3>
        <p className="mt-2 text-sm text-app-text-muted">{message}</p>
        <Button variant="primary" onClick={onRetry} className="mt-5">
          Try again
        </Button>
      </div>
    </div>
  );
}
