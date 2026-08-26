import { useState, useEffect, useMemo, useCallback, useRef, useDeferredValue } from "react";
import { knowledgeService } from "../../../services/knowledgeService";
import type { Artifact } from "../types";
import type { KnowledgeTab } from "../components/ArtifactFilters";

const ITEMS_PER_PAGE = 20;

/**
 * State + data layer for the Knowledge Base page.
 *
 * Owns artifact fetching (with a generation guard so a stale response can't
 * overwrite a newer one), client-side filtering (search + tab), and pagination.
 * UI-only state (which drawer is open, which modal is open) stays in the page.
 *
 * @param projectId The project to scope artifact fetching to. When null, no
 *   fetch is attempted and the page should render its empty state.
 */
export function useKnowledgeBase(projectId: string | null) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  // Initial loading only when a project is available; the effect's finally block
  // flips this back to false after the first fetch completes or fails.
  const [isLoading, setIsLoading] = useState(projectId !== null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Generation counter so a slow in-flight fetch can't overwrite a newer one
  // (e.g. when the user clicks Refresh twice, or projectId changes mid-flight).
  const fetchGenerationRef = useRef(0);

  const [searchQuery, setSearchQuery] = useState("");
  // Deferred so rapid typing doesn't re-filter the whole list on every keystroke;
  // React batches the filter to a lower-priority render.
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [activeTab, setActiveTab] = useState<KnowledgeTab>("ALL");

  const [currentPage, setCurrentPage] = useState(1);

  // Paging resets when the project scope changes. This deliberately does not live
  // in `fetchArtifacts`: that function doubles as the Refresh handler, and hitting
  // Refresh on page 3 should leave the reader on page 3 rather than snapping back.
  const [pagedProjectId, setPagedProjectId] = useState(projectId);
  if (pagedProjectId !== projectId) {
    setPagedProjectId(projectId);
    setCurrentPage(1);
  }

  const fetchArtifacts = useCallback(async () => {
    if (!projectId) {
      setArtifacts([]);
      setIsLoading(false);
      setFetchError(null);
      return;
    }
    const generation = ++fetchGenerationRef.current;
    setIsLoading(true);
    setFetchError(null);
    try {
      const data = await knowledgeService.getUnifiedArtifacts(projectId);
      if (generation !== fetchGenerationRef.current) return;
      setArtifacts(data);
    } catch (error) {
      if (generation !== fetchGenerationRef.current) return;
      console.error("Failed to load artifacts", error);
      setFetchError("Failed to load artifacts. Please try again.");
    } finally {
      if (generation === fetchGenerationRef.current) {
        setIsLoading(false);
      }
    }
  }, [projectId]);

  /**
   * Loads the initial batch of unified artifacts from the backend.
   * Depends on the authenticated user's projectId to fetch the correct project scope.
   */
  useEffect(() => {
    // Deferred to a microtask so synchronous setState calls at the top of
    // fetchArtifacts do not run inside the effect body and cascade a render.
    void Promise.resolve().then(() => fetchArtifacts());
  }, [fetchArtifacts]);

  const filteredArtifacts = useMemo(() => {
    return artifacts.filter((artifact) => {
      const searchableText = [artifact.title ?? "", artifact.sourceId, artifact.sourceUrl ?? ""]
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !deferredSearchQuery || searchableText.includes(deferredSearchQuery.toLowerCase());

      let matchesTab = false;
      switch (activeTab) {
        case "ALL":
          matchesTab = true;
          break;
        case "UPLOADS":
          matchesTab = artifact.sourceSystem === "UPLOAD";
          break;
        case "PR":
          matchesTab = artifact.artifactType === "PULL_REQUEST";
          break;
        case "ISSUES":
          matchesTab = artifact.artifactType === "ISSUE";
          break;
        case "FILES":
          matchesTab = artifact.sourceSystem === "GITHUB" && artifact.artifactType === "FILE";
          break;
        case "COMMITS":
          matchesTab = artifact.artifactType === "COMMIT";
          break;
        case "ORGANIZATIONS":
          matchesTab = artifact.artifactType === "ORG_METADATA";
          break;
      }

      return matchesSearch && matchesTab;
    });
  }, [artifacts, deferredSearchQuery, activeTab]);

  const totalPages = Math.max(1, Math.ceil(filteredArtifacts.length / ITEMS_PER_PAGE));

  // Pull the page back into range when the result set shrinks -- deleting the last
  // artifact on a page, or a filter narrowing while the reader is deep in the list.
  // Without this the control keeps advertising a page the list no longer has, while
  // the clamped slice below quietly shows a different one.
  if (currentPage > totalPages) {
    setCurrentPage(totalPages);
  }

  const paginatedArtifacts = useMemo(() => {
    const safePage = Math.min(currentPage, totalPages);
    const startIndex = (safePage - 1) * ITEMS_PER_PAGE;
    return filteredArtifacts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredArtifacts, currentPage, totalPages]);

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  }, []);

  const handleTabChange = useCallback((tab: KnowledgeTab) => {
    setActiveTab(tab);
    setCurrentPage(1);
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearchQuery("");
    setActiveTab("ALL");
  }, []);

  const hasActiveFilters = searchQuery !== "" || activeTab !== "ALL";

  return {
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
  };
}
