import { Search, RefreshCw, Layers, GitBranch, Ticket, BookOpen, Upload } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { SegmentedTabs, type SegmentedTabOption } from "../../../components/ui/SegmentedTabs";
import { centralSpringToken } from "../../../styles/tokens";
import { CONNECTOR_LABELS, DEFAULT_CONNECTOR_ORDER, type ConnectorTab } from "../tabs";

export type { ConnectorTab };

/**
 * Props for the ArtifactFilters component.
 * Supports two-tier filtering: primary connector tabs and contextual underfilters.
 */
export interface ArtifactFiltersProps {
  searchQuery: string;
  /** Fired on every keystroke with the new search text. Resets pagination in the parent. */
  onSearchChange: (query: string) => void;
  /** Active primary connector tab. */
  activeConnector?: ConnectorTab;
  /** Fired when the user selects a connector. Resets pagination and subfilter in the parent. */
  onConnectorChange?: (connector: ConnectorTab) => void;
  /** List of connectors that exist in the active project. */
  availableConnectors?: ConnectorTab[];
  /** Item count per connector tab. */
  connectorCounts?: Record<ConnectorTab, number>;
  /** Active contextual subfilter for the active connector. */
  activeSubfilter?: string;
  /** Fired when the user selects a subfilter. Resets pagination in the parent. */
  onSubfilterChange?: (subfilter: string) => void;
  /** Contextual subfilter options with live counts for the active connector. */
  subfilterOptions?: { id: string; label: string; count: number }[];
  /** Fired when the user clicks the refresh button. */
  onRefresh?: () => void;
  /** Whether a refresh is currently in progress. */
  isRefreshing?: boolean;
}

function getConnectorIcon(connector: ConnectorTab) {
  switch (connector) {
    case "ALL":
      return <Layers className="h-4 w-4" />;
    case "GITHUB":
      return <GitBranch className="h-4 w-4" />;
    case "JIRA":
      return <Ticket className="h-4 w-4" />;
    case "CONFLUENCE":
      return <BookOpen className="h-4 w-4" />;
    case "UPLOAD":
      return <Upload className="h-4 w-4" />;
  }
}

/**
 * ArtifactFilters
 *
 * Provides a two-tier UI for users to refine the unified knowledge base list:
 * 1. Primary Connector tabs (All, GitHub, Jira, Confluence, Uploads) with counts and icons.
 * 2. Contextual Underfilters (PRs, Issues, Code, Commits, Org, Pages, etc.) adapting to the active connector.
 */
export function ArtifactFilters({
  searchQuery,
  onSearchChange,
  activeConnector = "ALL",
  onConnectorChange,
  availableConnectors = DEFAULT_CONNECTOR_ORDER,
  connectorCounts,
  activeSubfilter = "ALL",
  onSubfilterChange,
  subfilterOptions = [],
  onRefresh,
  isRefreshing,
}: ArtifactFiltersProps) {
  const currentConnector: ConnectorTab = activeConnector;

  const handleConnectorSelect = (conn: ConnectorTab) => {
    onConnectorChange?.(conn);
  };

  const connectorOptions: SegmentedTabOption<ConnectorTab>[] = availableConnectors.map((c) => ({
    value: c,
    label: CONNECTOR_LABELS[c] ?? c,
    icon: getConnectorIcon(c),
    count: connectorCounts ? connectorCounts[c] : undefined,
    testId: `kb-connector-${c.toLowerCase()}`,
  }));

  const subfilterTabOptions: SegmentedTabOption<string>[] = subfilterOptions.map((opt) => ({
    value: opt.id,
    label: opt.label,
    count: opt.count,
    testId: `kb-subfilter-${opt.id.toLowerCase()}`,
  }));

  return (
    <div className="mb-6 flex flex-col gap-4">
      <Input
        type="text"
        placeholder="Search knowledge base..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        data-testid="kb-search-input"
        aria-label="Search knowledge base"
        icon={<Search className="h-4 w-4" />}
        trailing={
          onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              onClick={onRefresh}
              disabled={isRefreshing}
              title="Refresh Knowledge Base"
              aria-label="Refresh knowledge base"
              data-testid="kb-refresh"
            >
              <RefreshCw
                className={`h-4 w-4 ${isRefreshing ? "animate-spin text-app-brand" : ""}`}
              />
            </Button>
          )
        }
      />

      {/* Tier 1: Primary Connector Tabs */}
      <div className="flex flex-col gap-1.5">
        <SegmentedTabs
          value={currentConnector}
          options={connectorOptions}
          onChange={handleConnectorSelect}
          layoutId="knowledge-base-connector-pill"
          ariaLabel="Filter artifacts by connector"
          wrap
        />
      </div>

      {/* Tier 2: Contextual Underfilters */}
      {subfilterOptions.length > 0 && onSubfilterChange && (
        <AnimatePresence mode="wait">
          <motion.div
            key={currentConnector}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={centralSpringToken}
            className="pt-1"
          >
            <SegmentedTabs
              value={activeSubfilter}
              options={subfilterTabOptions}
              onChange={onSubfilterChange}
              layoutId={`knowledge-base-subfilter-pill-${currentConnector}`}
              ariaLabel={`Filter ${CONNECTOR_LABELS[currentConnector] ?? currentConnector} artifacts by type`}
              size="sm"
              wrap
            />
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
