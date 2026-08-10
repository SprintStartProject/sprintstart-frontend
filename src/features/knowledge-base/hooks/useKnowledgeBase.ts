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

  const fetchArtifacts = useCallback(async () => {
    if (!projectId) return;
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
    // Defer to a microtask so setState calls happen outside the effect body
    // (avoids the cascading-render smell flagged by react-hooks/set-state-in-effect).
    void Promise.resolve().then(fetchArtifacts);
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
      }

      return matchesSearch && matchesTab;
    });
  }, [artifacts, deferredSearchQuery, activeTab]);

  const totalPages = Math.ceil(filteredArtifacts.length / ITEMS_PER_PAGE);

  const paginatedArtifacts = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredArtifacts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredArtifacts, currentPage]);

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
