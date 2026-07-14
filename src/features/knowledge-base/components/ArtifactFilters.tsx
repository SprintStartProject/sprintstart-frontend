import { Search } from 'lucide-react';
import { motion } from 'framer-motion';

export type KnowledgeTab = 'ALL' | 'UPLOADS' | 'PR' | 'ISSUES' | 'FILES' | 'COMMITS';

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
}

const TABS: { id: KnowledgeTab; label: string }[] = [
    { id: 'ALL', label: 'All' },
    { id: 'UPLOADS', label: 'Uploads' },
    { id: 'PR', label: 'PR' },
    { id: 'ISSUES', label: 'Issues' },
    { id: 'FILES', label: 'Files' },
    { id: 'COMMITS', label: 'Commits' },
];

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
                    className="w-full pl-9 pr-4 py-2 bg-app-surface border border-app-border rounded-lg text-app-text focus:outline-none focus:ring-2 focus:ring-app-brand/20 focus:border-app-brand"
                />
            </div>
            
            <div 
                className="flex p-1 space-x-1 bg-app-surface border border-app-border rounded-xl w-full overflow-x-auto scrollbar-hide"
                role="tablist"
                aria-label="Filter artifacts by type"
            >
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={`relative flex-1 px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-app-brand focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg ${
                            activeTab === tab.id ? 'text-app-brand' : 'text-app-text-muted hover:text-app-text hover:bg-app-background'
                        }`}
                        aria-selected={activeTab === tab.id}
                        role="tab"
                    >
                        {activeTab === tab.id && (
                            <motion.div
                                layoutId="activeTabIndicator"
                                className="absolute inset-0 bg-app-brand/10 rounded-lg border border-app-brand/20"
                                initial={false}
                                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                            />
                        )}
                        <span className="relative z-10">{tab.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}
