import { Plug, RefreshCw } from "lucide-react";
import { PageHeader } from "../../../components/layout/PageHeader.tsx";
import { Button } from "../../../components/ui/Button.tsx";

type ConnectorsHeaderProps = {
  isLoading: boolean;
  onRefresh: () => void;
};

export function ConnectorsHeader({ isLoading, onRefresh }: ConnectorsHeaderProps) {
  return (
    <header className="border-b border-app-border bg-app-bg">
      <div className="app-page-frame py-6">
        <PageHeader
          icon={Plug}
          title="Connectors"
          subtitle="Enable connectors and choose which of their sources are in scope for ingestion."
          actions={
            <Button
              variant="secondary"
              onClick={onRefresh}
              disabled={isLoading}
              icon={<RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />}
            >
              Refresh
            </Button>
          }
        />
      </div>
    </header>
  );
}
