import { Database, Plus, RefreshCw } from "lucide-react";
import { PageHeader } from "../../../components/layout/PageHeader";
import { Button } from "../../../components/ui/Button";

type DataIngestionHeaderProps = {
  isLoading: boolean;
  onRefresh: () => void;
  onAddSource: () => void;
};

/**
 * Page header for the data ingestion view.
 *
 * The project is chosen globally in the sidebar switcher, so this header no
 * longer carries its own project selector. Its actions are the primary
 * "Add sources" button and a refresh control.
 */
export function DataIngestionHeader({
  isLoading,
  onRefresh,
  onAddSource,
}: DataIngestionHeaderProps) {
  return (
    <header className="border-b border-app-border bg-app-bg/90 backdrop-blur-xl">
      <div className="app-page-frame py-6">
        <PageHeader
          icon={Database}
          title="Data Ingestion"
          subtitle="Manage connected sources, indexed artifacts and ingestion runs."
          actions={
            <>
              <Button
                variant="primary"
                onClick={onAddSource}
                icon={<Plus size={16} />}
              >
                Add sources
              </Button>

              <Button
                variant="secondary"
                iconOnly
                onClick={onRefresh}
                disabled={isLoading}
                aria-label="Refresh"
              >
                <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
              </Button>
            </>
          }
        />
      </div>
    </header>
  );
}
