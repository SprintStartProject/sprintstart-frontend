import { Plug, RefreshCw } from "lucide-react";
import { PageHeader } from "../../../components/layout/PageHeader.tsx";

type ConnectorsHeaderProps = {
  isLoading: boolean;
  onRefresh: () => void;
};

export function ConnectorsHeader({
  isLoading,
  onRefresh,
}: ConnectorsHeaderProps) {
  return (
    <header className="border-b border-app-border bg-app-bg">
      <div className="app-page-frame py-6">
        <PageHeader
          icon={Plug}
          title="Connectors"
          subtitle="Enable connectors and choose which of their sources are in scope for ingestion."
          actions={
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="flex items-center justify-center gap-2 rounded-xl border border-app-border bg-app-surface px-4 py-3 text-sm font-semibold text-app-text transition hover:bg-app-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                size={16}
                className={isLoading ? "animate-spin" : ""}
              />
              Refresh
            </button>
          }
        />
      </div>
    </header>
  );
}
