import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { BookOpen, AlertTriangle, RefreshCw } from "lucide-react";
import {
  ArtifactFilters,
  ArtifactList,
  ArtifactViewerDrawer,
} from "../features/knowledge-base/components";
import { KNOWLEDGE_TAB_ORDER, TABS, type KnowledgeTab } from "../features/knowledge-base/tabs";
import { SlidingTabPanel } from "../components/ui/SlidingTabPanel";
import { useSwipeableTabs } from "../hooks/useHorizontalWheelNavigation";
import { Pagination } from "../components/ui/Pagination";
import { Button } from "../components/ui/Button";
import { PageHeader } from "../components/layout/PageHeader";
import { useAuth } from "../context/useAuth";
import { PermissionGroup } from "../services/types";
import { useKnowledgeBase } from "../features/knowledge-base/hooks/useKnowledgeBase";
import { useProjectContext } from "../features/projects/useProjectContext";

/** Roles allowed to delete uploaded artifacts. Pattern A gate mirroring
 *  the backend `@PreAuthorize("hasRole('PM') or hasRole('ADMIN')")` — keeps
 *  destructive uploads deletion out of reach of plain USER accounts. */
const DELETE_ALLOWED_GROUPS: ReadonlySet<PermissionGroup> = new Set([
  PermissionGroup.PM,
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
  const { selectedProjectId, isLoading: isProjectLoading } = useProjectContext();
  const projectId = selectedProjectId || (profile?.projectIds?.[0] ?? null);

  const canDeleteUpload = profile !== null && DELETE_ALLOWED_GROUPS.has(profile.permissionGroup);

  const {
    artifacts,
    isLoading: isArtifactsLoading,
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

  const isLoading = isProjectLoading || isArtifactsLoading;

  /*
    `?artifact=<id>` says which document is open, and it is in the URL the whole time one is.

    It began as a one-way hand-off: the dashboard's knowledge-base card linked to it, the id seeded
    the drawer once, and the parameter was then stripped again so the drawer state stayed local.
    That was fine while the only thing that ever *sent* somebody here was a link somebody else had
    built — and wrong as soon as something wanted to describe where a reader currently *is*.

    The board's cards do. A note kept from a paragraph in a document records the page it came from
    so it can offer the way back, and with the parameter stripped every one of those trails pointed
    at `/knowledge-base` — the list, not the document, with the highlighted paragraph three clicks
    further in. The reader was returned to the room and left to find the page again.

    So the parameter now follows the drawer in both directions: opening a document puts it there,
    closing one takes it away. `replace` throughout, so reading four documents does not leave four
    entries in the back button. The original intent survives it — a URL captured after the drawer is
    closed carries no id, so coming back later still does not reopen a document somebody shut.
  */
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(() =>
    searchParams.get("artifact"),
  );
  const [prevProjectId, setPrevProjectId] = useState(projectId);

  useEffect(() => {
    // Compared before writing, because this effect's own write comes back to it as a new
    // `searchParams`: without the guard that is a loop rather than a synchronisation.
    if ((searchParams.get("artifact") ?? null) === selectedArtifactId) return;

    const next = new URLSearchParams(searchParams);
    if (selectedArtifactId) next.set("artifact", selectedArtifactId);
    else next.delete("artifact");

    setSearchParams(next, { replace: true });
  }, [selectedArtifactId, searchParams, setSearchParams]);

  // Reset active drawer selection whenever the project scope changes.
  if (prevProjectId !== projectId) {
    setPrevProjectId(projectId);
    setSelectedArtifactId(null);
  }

  const selectedArtifact = useMemo(
    () => artifacts.find((a) => a.id === selectedArtifactId) ?? null,
    [artifacts, selectedArtifactId],
  );

  // Two-finger swipe between the artifact-type tabs, for people who would
  // rather not aim at the bar.
  const swipeRef = useSwipeableTabs<KnowledgeTab, HTMLElement>({
    order: KNOWLEDGE_TAB_ORDER,
    value: activeTab,
    onChange: handleTabChange,
  });

  return (
    <div className="flex min-h-screen flex-col text-app-text">
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

      <main
        ref={swipeRef}
        className="app-page-frame flex flex-1 flex-col overflow-y-auto py-6 sm:space-y-10 lg:py-8"
      >
        <div className="mx-auto w-full max-w-7xl">
          {!projectId && !isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-app-text-muted">
              <BookOpen className="mb-4 h-12 w-12 opacity-50" />
              <p className="font-medium">No project available</p>
              <p className="mt-1 text-sm">No active project found for your user.</p>
            </div>
          ) : (
            <>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, type: "spring", damping: 25, stiffness: 200 }}
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

              <div className="mt-8 mb-4 flex items-center justify-between">
                <p className="text-sm font-medium text-app-text-muted">
                  {filteredArtifacts.length} {filteredArtifacts.length === 1 ? "result" : "results"}
                </p>
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearFilters}
                    data-testid="kb-clear-filters"
                  >
                    Clear filters
                  </Button>
                )}
              </div>

              {fetchError && !isLoading && (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-app-danger-border bg-app-danger-bg p-4 text-app-danger-text"
                  data-testid="kb-fetch-error"
                >
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 shrink-0" />
                    <span className="text-sm font-medium">{fetchError}</span>
                  </div>
                  <Button
                    variant="dangerSoft"
                    size="sm"
                    onClick={() => void fetchArtifacts()}
                    data-testid="kb-retry-fetch"
                    icon={<RefreshCw className="h-4 w-4" />}
                  >
                    Retry
                  </Button>
                </div>
              )}

              {isLoading ? (
                <div className="flex justify-center p-12" aria-busy="true" aria-live="polite">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-app-brand border-t-transparent"></div>
                </div>
              ) : fetchError ? null : (
                // Only the list slides; the loading and error
                // states above are not tabs and would otherwise
                // animate on their way in too.
                <SlidingTabPanel
                  activeKey={activeTab}
                  index={TABS.findIndex((tab) => tab.id === activeTab)}
                >
                  <ArtifactList artifacts={paginatedArtifacts} onSelect={setSelectedArtifactId} />
                  {totalPages > 1 && (
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={(page) => {
                        setCurrentPage(page);
                        window.scrollTo({ top: 0, behavior: "smooth" });
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
