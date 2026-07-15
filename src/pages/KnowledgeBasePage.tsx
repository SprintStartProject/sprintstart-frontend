import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Plus } from 'lucide-react';
import { knowledgeService } from '../services/knowledgeService';
import { ArtifactFilters, ArtifactList, ArtifactViewerDrawer, UploadArtifactModal } from '../features/knowledge-base/components';
import type { KnowledgeTab } from '../features/knowledge-base/components';
import { Pagination } from '../components/ui/Pagination';
import type { Artifact } from '../features/knowledge-base/types';
import { PageHeader } from '../components/layout/PageHeader';
import { useAuth } from '../context/useAuth';

/**
 * Unified Knowledge Base view for project resources.
 *
 * Bound to the `/knowledge-base` route (accessible to all permission groups).
 * Displays all artifacts (uploads, github, etc.) in a filtered grid, with a side
 * drawer for viewing raw content and AI summaries. Artifacts are fetched via
 * `knowledgeService.getUnifiedArtifacts`, scoped to the user's first project id.
 *
 * @remarks Known limitation: only `profile.projectIds[0]` is used. Users with
 * multiple projects currently see artifacts for the first one only.
 */
export function KnowledgeBasePage() {
    const { profile } = useAuth();
    // TODO: support project switching — currently only the first project is scoped.
    const projectId = profile?.projectIds?.[0] ?? null;

    const [artifacts, setArtifacts] = useState<Artifact[]>([]);
    // Initial loading only when a project is available; the effect's finally block
    // flips this back to false after the first fetch completes or fails.
    const [isLoading, setIsLoading] = useState(projectId !== null);

    // Filter State
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<KnowledgeTab>('ALL');

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 20;

    // Viewer State
    const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null);

    // Upload State
    const [isUploadScreenOpen, setIsUploadScreenOpen] = useState(false);

    /**
     * Loads the initial batch of unified artifacts from the backend.
     * Depends on the authenticated user's projectId to fetch the correct project scope.
     */
    useEffect(() => {
        if (!projectId) return;

        let isMounted = true;

        knowledgeService.getUnifiedArtifacts(projectId)
            .then(data => {
                if (isMounted) setArtifacts(data);
            })
            .catch(error => {
                console.error("Failed to load artifacts", error);
            })
            .finally(() => {
                if (isMounted) setIsLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [projectId]);

    // Derived Filtered List
    const filteredArtifacts = useMemo(() => {
        return artifacts.filter(artifact => {
            const searchableText = [
                artifact.title ?? '',
                artifact.sourceId,
                artifact.sourceUrl ?? '',
            ].join(' ').toLowerCase();

            const matchesSearch = !searchQuery || searchableText.includes(searchQuery.toLowerCase());
            
            // Tab mapping logic
            let matchesTab = false;
            switch (activeTab) {
                case 'ALL':
                    matchesTab = true;
                    break;
                case 'UPLOADS':
                    matchesTab = artifact.sourceSystem === 'UPLOAD';
                    break;
                case 'PR':
                    matchesTab = artifact.artifactType === 'PULL_REQUEST';
                    break;
                case 'ISSUES':
                    matchesTab = artifact.artifactType === 'ISSUE';
                    break;
                case 'FILES':
                    matchesTab = artifact.sourceSystem === 'GITHUB' && artifact.artifactType === 'FILE';
                    break;
                case 'COMMITS':
                    matchesTab = artifact.artifactType === 'COMMIT';
                    break;
            }

            return matchesSearch && matchesTab;
        });
    }, [artifacts, searchQuery, activeTab]);


    const totalPages = Math.ceil(filteredArtifacts.length / ITEMS_PER_PAGE);
    
    const paginatedArtifacts = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredArtifacts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredArtifacts, currentPage]);

    const selectedArtifact = useMemo(() =>
        artifacts.find(a => a.id === selectedArtifactId) || null,
    [artifacts, selectedArtifactId]);

    const handleClearFilters = () => {
        setSearchQuery('');
        setActiveTab('ALL');
    };

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

            <main className="flex-1 flex flex-col app-page-frame py-6 sm:space-y-10 lg:py-8 overflow-y-auto">
                <div className="max-w-7xl mx-auto w-full">
                    {!projectId && !isLoading ? (
                        <div className="flex flex-col items-center justify-center py-12 text-app-text-muted">
                            <BookOpen className="w-12 h-12 mb-4 opacity-50" />
                            <p className="font-medium">No project available</p>
                            <p className="text-sm mt-1">No active project found for your user.</p>
                        </div>
                    ) : (
                        <>
                            {/* Filters */}
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1, type: 'spring', damping: 25, stiffness: 200 }}
                            >
                                <ArtifactFilters
                                    searchQuery={searchQuery}
                                    onSearchChange={(query) => {
                                        setSearchQuery(query);
                                        setCurrentPage(1);
                                    }}
                                    activeTab={activeTab}
                                    onTabChange={(tab) => {
                                        setActiveTab(tab);
                                        setCurrentPage(1);
                                    }}
                                />
                            </motion.div>

                            {/* Results Count & Clear */}
                            <div className="flex items-center justify-between mt-8 mb-4">
                                <p className="text-sm font-medium text-app-text-muted">
                                    {filteredArtifacts.length} {filteredArtifacts.length === 1 ? 'result' : 'results'}
                                </p>
                                {(searchQuery || activeTab !== 'ALL') && (
                                    <button
                                        onClick={handleClearFilters}
                                        className="text-sm font-medium text-app-brand hover:underline"
                                    >
                                        Clear filters
                                    </button>
                                )}
                            </div>

                            {/* Main List */}
                            {isLoading ? (
                                <div className="flex justify-center p-12">
                                    <div className="w-8 h-8 border-4 border-app-brand border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            ) : (
                                <>
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
                                </>
                            )}
                        </>
                    )}
                </div>

                {/* Upload Action Button */}
                {projectId && (
                    <motion.button
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setIsUploadScreenOpen(true)}
                        className="fixed bottom-8 right-8 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-app-brand text-white shadow-lg shadow-app-brand/25 transition-colors hover:bg-app-brand-hover focus:outline-none focus:ring-2 focus:ring-app-brand focus:ring-offset-2 focus:ring-offset-app-bg"
                        aria-label="Upload new artifact"
                    >
                        <Plus className="h-6 w-6" />
                    </motion.button>
                )}

                {/* Upload Modal */}
                {projectId && (
                    <UploadArtifactModal
                        isOpen={isUploadScreenOpen}
                        onClose={() => setIsUploadScreenOpen(false)}
                        projectId={projectId}
                    />
                )}

                {/* Viewer Drawer */}
                {projectId && (
                    <ArtifactViewerDrawer
                        artifact={selectedArtifact}
                        onClose={() => setSelectedArtifactId(null)}
                        projectId={projectId}
                    />
                )}
            </main>
        </div>
    );
}
