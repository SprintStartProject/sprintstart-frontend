import { Search, RefreshCw } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { SegmentedTabs } from '../../../components/ui/SegmentedTabs';

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
                        >
                            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-app-brand' : ''}`} />
                        </Button>
                    )
                }
            />

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
