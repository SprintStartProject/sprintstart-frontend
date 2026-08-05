import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, AlertTriangle, RefreshCw } from 'lucide-react';
import { ArtifactFilters, ArtifactList, ArtifactViewerDrawer } from '../features/knowledge-base/components';
import { KNOWLEDGE_TAB_ORDER, TABS, type KnowledgeTab } from '../features/knowledge-base/tabs';
import { SlidingTabPanel } from '../components/ui/SlidingTabPanel';
import { useSwipeableTabs } from '../hooks/useHorizontalWheelNavigation';
import { Pagination } from '../components/ui/Pagination';
import { PageHeader } from '../components/layout/PageHeader';
import { useAuth } from '../context/useAuth';
import { PermissionGroup } from '../services/types';
import { useKnowledgeBase } from '../features/knowledge-base/hooks/useKnowledgeBase';
import { useProjectContext } from '../features/projects/useProjectContext';

/** Roles allowed to delete uploaded artifacts. Pattern A gate mirroring
 *  `SettingsPage`'s PAT_ALLOWED_GROUPS — keeps destructive uploads deletion
 *  out of reach of plain USER accounts. */
const DELETE_ALLOWED_GROUPS: ReadonlySet<PermissionGroup> = new Set([
    PermissionGroup.PM,
    PermissionGroup.HR,
    PermissionGroup.ADMIN,
]);

/**
 * Unified Knowledge Base view for project resources.
 *
 * Bound to the `/knowledge-base` route (accessible to all permission groups).
 * Displays all artifacts (uploads, github, etc.) in a filtered grid, with a side
 * drawer for viewing raw content and AI summaries. Artifacts are fetched via
 * `knowledgeService.getUnifiedArtifacts`, scoped to the globally selected
 * project.
 *
 * Users without a project switcher fall back to their first assigned project,
 * which is what the global selection resolves to for them anyway.
 */
export function KnowledgeBasePage() {
    const { profile } = useAuth();
    const { selectedProjectId } = useProjectContext();
    const projectId = selectedProjectId || (profile?.projectIds?.[0] ?? null);

    const canDeleteUpload =
        profile !== null && DELETE_ALLOWED_GROUPS.has(profile.permissionGroup);

    const {
        artifacts,
        isLoading,
        fetchError,
        fetchArtifacts,
        searchQuery,
        activeTab,
        currentPage,
        totalPages,
        filteredArtifacts,
        paginatedArtifacts,
        handleSearchChange,
        handleTabChange,
        setCurrentPage,
        handleClearFilters,
        hasActiveFilters,
    } = useKnowledgeBase(projectId);

    const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null);

    const selectedArtifact = useMemo(() =>
        artifacts.find(a => a.id === selectedArtifactId) ?? null,
    [artifacts, selectedArtifactId]);

    // Two-finger swipe between the artifact-type tabs, for people who would
    // rather not aim at the bar.
    const swipeRef = useSwipeableTabs<KnowledgeTab, HTMLElement>({
        order: KNOWLEDGE_TAB_ORDER,
        value: activeTab,
        onChange: handleTabChange,
    });

    return (
        <div className="min-h-screen bg-app-bg text-app-text flex flex-col">
            <header className="border-b border-app-border bg-app-bg">
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="app-page-frame py-6"
                >
                    <PageHeader
                        icon={BookOpen}
                        title="Knowledge Base"
                        subtitle="Explore unified project documentation, code runbooks, and artifacts."
                    />
                </motion.div>
            </header>

            <main ref={swipeRef} className="flex-1 flex flex-col app-page-frame py-6 sm:space-y-10 lg:py-8 overflow-y-auto">
                <div className="max-w-7xl mx-auto w-full">
                    {!projectId && !isLoading ? (
                        <div className="flex flex-col items-center justify-center py-12 text-app-text-muted">
                            <BookOpen className="w-12 h-12 mb-4 opacity-50" />
                            <p className="font-medium">No project available</p>
                            <p className="text-sm mt-1">No active project found for your user.</p>
                        </div>
                    ) : (
                        <>
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1, type: 'spring', damping: 25, stiffness: 200 }}
                            >
                                <ArtifactFilters
                                    searchQuery={searchQuery}
                                    onSearchChange={handleSearchChange}
                                    activeTab={activeTab}
                                    onTabChange={handleTabChange}
                                    onRefresh={() => void fetchArtifacts()}
                                    isRefreshing={isLoading}
                                />
                            </motion.div>

                            <div className="flex items-center justify-between mt-8 mb-4">
                                <p className="text-sm font-medium text-app-text-muted">
                                    {filteredArtifacts.length} {filteredArtifacts.length === 1 ? 'result' : 'results'}
                                </p>
                                {hasActiveFilters && (
                                    <button
                                        onClick={handleClearFilters}
                                        data-testid="kb-clear-filters"
                                        className="text-sm font-medium text-app-brand hover:underline"
                                    >
                                        Clear filters
                                    </button>
                                )}
                            </div>

                            {fetchError && !isLoading && (
                                <div
                                    role="alert"
                                    aria-live="assertive"
                                    className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-app-danger-border bg-app-danger-bg p-4 text-app-danger-text"
                                    data-testid="kb-fetch-error"
                                >
                                    <div className="flex items-center gap-3">
                                        <AlertTriangle className="h-5 w-5 shrink-0" />
                                        <span className="text-sm font-medium">{fetchError}</span>
                                    </div>
                                    <button
                                        onClick={() => void fetchArtifacts()}
                                        data-testid="kb-retry-fetch"
                                        className="flex items-center gap-2 rounded-lg border border-app-danger-border px-3 py-1.5 text-sm font-medium hover:bg-app-surface-hover"
                                    >
                                        <RefreshCw className="h-4 w-4" />
                                        Retry
                                    </button>
                                </div>
                            )}

                            {isLoading ? (
                                <div className="flex justify-center p-12" aria-busy="true" aria-live="polite">
                                    <div className="w-8 h-8 border-4 border-app-brand border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            ) : fetchError ? null : (
                                // Only the list slides; the loading and error
                                // states above are not tabs and would otherwise
                                // animate on their way in too.
                                <SlidingTabPanel
                                    activeKey={activeTab}
                                    index={TABS.findIndex((tab) => tab.id === activeTab)}
                                >
                                    <ArtifactList
                                        artifacts={paginatedArtifacts}
                                        onSelect={setSelectedArtifactId}
                                    />
                                    {totalPages > 1 && (
                                        <Pagination
                                            currentPage={currentPage}
                                            totalPages={totalPages}
                                            onPageChange={(page) => {
                                                setCurrentPage(page);
                                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                            }}
                                            className="mt-8 mb-12"
                                        />
                                    )}
                                </SlidingTabPanel>
                            )}
                        </>
                    )}
                </div>

                {projectId && (
                    <ArtifactViewerDrawer
                        artifact={selectedArtifact}
                        onClose={() => setSelectedArtifactId(null)}
                        projectId={projectId}
                        canDelete={canDeleteUpload}
                        onDelete={() => {
                            setSelectedArtifactId(null);
                            void fetchArtifacts();
                        }}
                    />
                )}
            </main>
        </div>
    );
}
