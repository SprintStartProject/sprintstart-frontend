import { Search, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { SegmentedTabs } from '../../../components/ui/SegmentedTabs';
import { buttonHoverMotion, buttonHoverMotionDisabled } from '../../../styles/tokens';

import { TABS, type KnowledgeTab } from '../tabs';

export type { KnowledgeTab };

/**
 * Props for the ArtifactFilters component.
 * Contains callback functions to update the parent component's view state.
 */
export interface ArtifactFiltersProps {
    searchQuery: string;
    /** Fired on every keystroke with the new search text. Resets pagination in the parent. */
    onSearchChange: (query: string) => void;
    activeTab: KnowledgeTab;
    /** Fired when the user picks a different artifact-type tab. Resets pagination in the parent. */
    onTabChange: (tab: KnowledgeTab) => void;
    /** Fired when the user clicks the refresh button. */
    onRefresh?: () => void;
    /** Whether a refresh is currently in progress. */
    isRefreshing?: boolean;
}

/**
 * ArtifactFilters
 * 
 * Provides a UI for users to refine the unified knowledge base list.
 * Includes text search and segmented tabs mapping to different artifact types/sources.
 */
export function ArtifactFilters({
    searchQuery,
    onSearchChange,
    activeTab,
    onTabChange,
    onRefresh,
    isRefreshing,
}: ArtifactFiltersProps) {
    return (
        <div className="flex flex-col gap-6 mb-6">
            <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-muted" />
                <input
                    type="text"
                    placeholder="Search knowledge base..."
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="w-full rounded-xl border border-app-border/70 bg-app-surface/70 py-2 pl-9 pr-12 text-app-text backdrop-blur-md transition-colors hover:border-app-brand-border-strong focus:border-app-brand focus:outline-none focus:ring-2 focus:ring-app-brand/20"
                    data-testid="kb-search-input"
                    aria-label="Search knowledge base"
                />
                {onRefresh && (
                    <motion.button
                        onClick={onRefresh}
                        disabled={isRefreshing}
                        {...(isRefreshing ? buttonHoverMotionDisabled : buttonHoverMotion)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-app-text-muted hover:text-app-text hover:bg-app-surface-hover rounded-md transition-colors disabled:opacity-50"
                        title="Refresh Knowledge Base"
                        aria-label="Refresh knowledge base"
                    >
                        <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-app-brand' : ''}`} />
                    </motion.button>
                )}
            </div>

            <SegmentedTabs
                value={activeTab}
                options={TABS.map((tab) => ({ value: tab.id, label: tab.label }))}
                onChange={onTabChange}
                layoutId="knowledge-base-tab-pill"
                ariaLabel="Filter artifacts by type"
                fullWidth
            />
        </div>
    );
}
