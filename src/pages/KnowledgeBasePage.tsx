import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { BookOpen, AlertTriangle, RefreshCw } from "lucide-react";
import {
  ArtifactFilters,
  ArtifactList,
  ArtifactViewerDrawer,
} from "../features/knowledge-base/components";
import { Pagination } from "../components/ui/Pagination";
import { Button } from "../components/ui/Button";
import { centralSpringToken } from "../styles/tokens";
import { PageHeader } from "../components/layout/PageHeader";
import { useAuth } from "../context/useAuth";
import { PermissionGroup } from "../services/types";
import { useKnowledgeBase } from "../features/knowledge-base/hooks/useKnowledgeBase";
import { useArtifactById } from "../features/knowledge-base/hooks/useArtifactById";
import { useProjectContext } from "../features/projects/useProjectContext";
import { useDelayedFlag } from "../hooks/useDelayedFlag";
import { SkeletonBlock, SkeletonGroup, SkeletonLine } from "../components/ui/Skeleton";

/** Placeholder for one `ArtifactCard`, matching its icon box, title/badge row and meta row. */
function ArtifactCardSkeleton() {
  return (
    <div className="rounded-xl border border-app-border bg-app-surface p-4">
      <div className="flex items-start gap-4">
        <SkeletonBlock className="h-9 w-9 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <SkeletonLine className="w-1/3" />
            <SkeletonLine className="h-4 w-12" />
          </div>
          <SkeletonLine className="mt-2 w-1/2" />
        </div>
      </div>
    </div>
  );
}

function ArtifactListSkeleton() {
  return (
    <SkeletonGroup label="Loading artifacts" className="space-y-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <ArtifactCardSkeleton key={index} />
      ))}
    </SkeletonGroup>
  );
}

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
 * drawer for viewing raw content and AI summaries. Artifacts arrive one page at
 * a time from `knowledgeService.getArtifactPage`, with the facet counts beside
 * them from `knowledgeService.getArtifactFacets`, scoped to the globally
 * selected project.
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
    tabOptions,
    sourceOptions,
    formatOptions,
    repositoryOptions,
    selectedSources,
    selectedFormat,
    selectedRepositories,
    currentPage,
    totalPages,
    totalElements,
    handleSearchChange,
    handleTabChange,
    toggleSource,
    toggleFormat,
    toggleRepository,
    setCurrentPage,
    handleClearFilters,
    hasActiveFilters,
    selectedArtifactId,
    setSelectedArtifactId,
  } = useKnowledgeBase(projectId, { projectSettled: !isProjectLoading });

  const isLoading = isProjectLoading || isArtifactsLoading;
  const showLoadingSkeleton = useDelayedFlag(isLoading);

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
    The URL itself is now owned by `useKnowledgeBase` (every filter lives there too, and two
    writers of one query string overwrite each other), which also drops `?artifact=` on a switch
    between two settled projects - the id of project A's document means nothing in project B.
  */

  const isSelectedInPage = useMemo(
    () => artifacts.some((a) => a.id === selectedArtifactId),
    [artifacts, selectedArtifactId],
  );

  const { data: fetchedArtifact } = useArtifactById(
    projectId,
    selectedArtifactId && !isSelectedInPage ? selectedArtifactId : null,
  );

  const selectedArtifact = useMemo(
    () =>
      artifacts.find((a) => a.id === selectedArtifactId) ??
      (fetchedArtifact?.id === selectedArtifactId ? fetchedArtifact : null),
    [artifacts, selectedArtifactId, fetchedArtifact],
  );

  const prefersReducedMotion = useReducedMotion();

  /*
    The list re-enters when the *facets* change, so switching GitHub -> Jira reads as a different
    answer arriving rather than the same rows mutating in place. Search is deliberately not part of
    the key: every keystroke would remount the list and replay the fade under the reader's cursor.

    This replaced a `SlidingTabPanel` that slid the content sideways by the index of the active
    connector. There is no index any more -- a multi-select selection has no direction, and a slide
    chosen from a set's iteration order would move left on a change the reader reads as forward.
  */
  const facetKey = `${activeTab}|${[...selectedSources].sort().join(",")}|${selectedFormat ?? ""}|${[...selectedRepositories].sort().join(",")}`;

  return (
    <div className="flex min-h-screen flex-col text-app-text">
      <header className="border-b border-app-border bg-app-bg">
        <div className="app-page-frame py-6">
          <PageHeader
            icon={BookOpen}
            title="Knowledge Base"
            subtitle="Explore unified project documentation, code runbooks, and artifacts."
          />
        </div>
      </header>

      <main
        // Unlike Access Management, nothing above this page caps its height (the wrapper
        // and App's own <main> are both `min-h-screen`), so `overflow-y-auto` never actually
        // engages -- the document scrolls. No `SCROLL_CONTAINER_ATTRIBUTE` here for that
        // reason: marking this element would point scroll restoration and the dialog scroll
        // lock at something whose `scrollTop` never moves, both silently doing nothing.
        className="app-page-frame flex flex-1 flex-col py-6 sm:space-y-10 lg:py-8"
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
                  tabOptions={tabOptions}
                  sourceOptions={sourceOptions}
                  formatOptions={formatOptions}
                  selectedSources={selectedSources}
                  selectedFormat={selectedFormat}
                  onToggleSource={toggleSource}
                  onToggleFormat={toggleFormat}
                  repositoryOptions={repositoryOptions}
                  selectedRepositories={selectedRepositories}
                  onToggleRepository={toggleRepository}
                  resultCount={totalElements}
                  hasActiveFilters={hasActiveFilters}
                  onClearFilters={handleClearFilters}
                  onRefresh={() => void fetchArtifacts()}
                  isRefreshing={isLoading}
                />
              </motion.div>

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

              {showLoadingSkeleton ? (
                <ArtifactListSkeleton />
              ) : isLoading ? null : fetchError ? null : (
                // Only the list fades; the loading and error states above are not facets and would
                // otherwise animate on their way in too.
                <motion.div
                  key={facetKey}
                  initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={prefersReducedMotion ? { duration: 0 } : centralSpringToken}
                >
                  <ArtifactList artifacts={artifacts} onSelect={setSelectedArtifactId} />
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
                </motion.div>
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
