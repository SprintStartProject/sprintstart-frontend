import { useState, useMemo, useCallback, useDeferredValue } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { knowledgeService } from "../../../services/knowledgeService";
import { queryKeys } from "../../../services/queryKeys";
import type { Artifact } from "../types";
import type { KnowledgeTab } from "../tabs";

const ITEMS_PER_PAGE = 20;
const NO_ARTIFACTS: Artifact[] = [];

/** The knowledge-base query's loader, shared with route prefetch so the two never drift apart. */
export function loadKnowledgeBaseArtifacts(projectId: string): Promise<Artifact[]> {
  return knowledgeService.getUnifiedArtifacts(projectId);
}

/**
 * State + data layer for the Knowledge Base page.
 *
 * Owns artifact fetching, client-side filtering (search + tab), and
 * pagination. UI-only state (which drawer is open, which modal is open) stays
 * in the page.
 *
 * @param projectId The project to scope artifact fetching to. When null, no
 *   fetch is attempted and the page should render its empty state.
 */
export function useKnowledgeBase(projectId: string | null) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.knowledgeBase.byProject(projectId ?? "");

  const {
    data,
    isLoading: isQueryLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => loadKnowledgeBaseArtifacts(projectId as string),
    enabled: projectId !== null,
  });

  const artifacts = projectId !== null ? (data ?? NO_ARTIFACTS) : NO_ARTIFACTS;
  const isLoading = projectId !== null && isQueryLoading;
  const fetchError = isError ? "Failed to load artifacts. Please try again." : null;

  // A newer fetch (Refresh clicked twice, or projectId changing mid-flight) is
  // meant to win over one already in flight; react-query only supersedes an
  // in-flight fetch on its own once the query has data, which the very first
  // load never does, so it is cancelled by hand first.
  const fetchArtifacts = useCallback(async () => {
    if (projectId === null) return;
    await queryClient.cancelQueries({ queryKey });
    await refetch();
  }, [projectId, queryClient, queryKey, refetch]);

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
