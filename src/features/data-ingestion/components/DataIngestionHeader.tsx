import { Database, Plus, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import { PageHeader } from "../../../components/layout/PageHeader";
import {
  buttonHoverMotion,
  buttonHoverMotionDisabled,
} from "../../../styles/tokens";

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
              <motion.button
                type="button"
                onClick={onAddSource}
                {...buttonHoverMotion}
                className="flex items-center justify-center gap-2 rounded-xl bg-app-brand px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-app-brand-hover hover:shadow-[0_10px_26px_-10px_var(--color-app-brand)]"
              >
                <Plus size={16} />
                Add sources
              </motion.button>

              <motion.button
                type="button"
                onClick={onRefresh}
                disabled={isLoading}
                aria-label="Refresh"
                {...(isLoading ? buttonHoverMotionDisabled : buttonHoverMotion)}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-app-border bg-app-surface text-app-text-muted transition-colors hover:border-app-brand-border-strong hover:bg-app-surface-hover hover:text-app-text focus:outline-none focus-visible:ring-2 focus-visible:ring-app-focus disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
              </motion.button>
            </>
          }
        />
      </div>
    </header>
  );
}
