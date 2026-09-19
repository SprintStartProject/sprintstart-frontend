import { useState, useMemo, useCallback, useDeferredValue } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { knowledgeService } from "../../../services/knowledgeService";
import { queryKeys } from "../../../services/queryKeys";
import type { Artifact, SourceSystem } from "../types";
import {
  DEFAULT_FORMAT_ORDER,
  DEFAULT_SOURCE_ORDER,
  FORMAT_LABELS,
  KNOWLEDGE_TABS,
  type KnowledgeTab,
  SOURCE_LABELS,
  isUpload,
  matchesFormat,
  type UploadFormat,
} from "../tabs";

const ITEMS_PER_PAGE = 20;
const NO_ARTIFACTS: Artifact[] = [];
const NO_SOURCES: ReadonlySet<SourceSystem> = new Set<SourceSystem>();

/** A single selectable option in a facet, with the count it would yield if added. */
export interface FacetOption<TValue extends string> {
  value: TValue;
  label: string;
  count: number;
}

/** An option for the top-level artifact type tabs in SegmentedTabs. */
export interface TabOption {
  value: KnowledgeTab;
  label: string;
  count: number;
}

/** The knowledge-base query's loader, shared with route prefetch so the two never drift apart. */
export function loadKnowledgeBaseArtifacts(projectId: string): Promise<Artifact[]> {
  return knowledgeService.getUnifiedArtifacts(projectId);
}

/**
 * State + data layer for the Knowledge Base page.
 *
 * Owns artifact fetching, client-side filtering and pagination. Filtering is
 * three independent facets — sources, artifact types, and (for uploads only)
 * file format — combined with AND across facets and OR within one; an empty
 * facet means "everything", which is what makes a clear-all the same operation
 * as never having filtered. UI-only state (which drawer is open, which modal is
 * open) stays in the page.
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
  const [selectedSources, setSelectedSources] = useState<ReadonlySet<SourceSystem>>(NO_SOURCES);
  const [selectedFormat, setSelectedFormat] = useState<UploadFormat | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Helper to match text search across title, sourceId, and sourceUrl
  const matchesSearch = useCallback((artifact: Artifact, query: string): boolean => {
    if (!query) return true;
    const searchableText = [artifact.title ?? "", artifact.sourceId, artifact.sourceUrl ?? ""]
      .join(" ")
      .toLowerCase();
    return searchableText.includes(query.toLowerCase());
  }, []);

  const passesTab = useCallback(
    (artifact: Artifact): boolean => {
      if (activeTab === "ALL") return true;
      return artifact.artifactType === activeTab;
    },
    [activeTab],
  );

  const passesSources = useCallback(
    (artifact: Artifact): boolean => {
      if (selectedSources.size === 0) return true;
      return selectedSources.has(artifact.sourceSystem);
    },
    [selectedSources],
  );

  const passesFormat = useCallback(
    (artifact: Artifact): boolean => {
      if (selectedFormat === null) return true;
      return matchesFormat(artifact, selectedFormat);
    },
    [selectedFormat],
  );

  /**
   * Top-level tabs for SegmentedTabs.
   *
   * Options are scoped to artifact types present in the project (plus "ALL" and
   * whatever tab is active, so an active tab never disappears). Each tab's count
   * reflects the current search, source selection, and format facet.
   */
  const tabOptions = useMemo<TabOption[]>(() => {
    const presentTypes = new Set(artifacts.map((artifact) => artifact.artifactType));
    const reachableTabs = KNOWLEDGE_TABS.filter(
      (tab) =>
        tab.id === "ALL" ||
        tab.id === activeTab ||
        (tab.type !== undefined && presentTypes.has(tab.type)),
    );

    return reachableTabs.map((tab) => ({
      value: tab.id,
      label: tab.label,
      count: artifacts.filter(
        (artifact) =>
          (tab.id === "ALL" || artifact.artifactType === tab.id) &&
          matchesSearch(artifact, deferredSearchQuery) &&
          passesSources(artifact) &&
          passesFormat(artifact),
      ).length,
    }));
  }, [artifacts, activeTab, deferredSearchQuery, matchesSearch, passesSources, passesFormat]);

  /** Sources present in the project (plus any selected one, so a filter is never invisible). */
  const sourceOptions = useMemo<FacetOption<SourceSystem>[]>(() => {
    const present = new Set(artifacts.map((artifact) => artifact.sourceSystem));
    return DEFAULT_SOURCE_ORDER.filter(
      (source) => present.has(source) || selectedSources.has(source),
    ).map((source) => ({
      value: source,
      label: SOURCE_LABELS[source],
      count: artifacts.filter(
        (artifact) =>
          artifact.sourceSystem === source &&
          matchesSearch(artifact, deferredSearchQuery) &&
          passesTab(artifact) &&
          passesFormat(artifact),
      ).length,
    }));
  }, [artifacts, deferredSearchQuery, matchesSearch, passesTab, passesFormat, selectedSources]);

  /**
   * File formats, offered only while Uploads is part of the source selection.
   *
   * Empty means "this facet does not apply right now", which is exactly the
   * condition the filter UI renders the section on — so the rule lives here once
   * instead of being re-derived by every caller.
   */
  const formatOptions = useMemo<FacetOption<UploadFormat>[]>(() => {
    if (!selectedSources.has("UPLOAD")) return [];

    const uploads = artifacts.filter(
      (artifact) =>
        isUpload(artifact) && matchesSearch(artifact, deferredSearchQuery) && passesTab(artifact),
    );

    // Same rule as the types: a format no upload in scope can produce is not
    // offered, but one the reader already chose stays so it can be unchosen.
    return DEFAULT_FORMAT_ORDER.filter(
      (format) => selectedFormat === format || uploads.some((a) => matchesFormat(a, format)),
    ).map((format) => ({
      value: format,
      label: FORMAT_LABELS[format],
      count: uploads.filter((artifact) => matchesFormat(artifact, format)).length,
    }));
  }, [artifacts, deferredSearchQuery, matchesSearch, passesTab, selectedSources, selectedFormat]);

  // Paging resets when the project scope changes. This deliberately does not live
  // in `fetchArtifacts`: that function doubles as the Refresh handler, and hitting
  // Refresh on page 3 should leave the reader on page 3 rather than snapping back.
  const [pagedProjectId, setPagedProjectId] = useState(projectId);
  if (pagedProjectId !== projectId) {
    setPagedProjectId(projectId);
    setCurrentPage(1);
    setActiveTab("ALL");
    setSelectedSources(NO_SOURCES);
    setSelectedFormat(null);
  }

  const filteredArtifacts = useMemo(
    () =>
      artifacts.filter(
        (artifact) =>
          matchesSearch(artifact, deferredSearchQuery) &&
          passesTab(artifact) &&
          passesSources(artifact) &&
          passesFormat(artifact),
      ),
    [artifacts, deferredSearchQuery, matchesSearch, passesTab, passesSources, passesFormat],
  );

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

  const toggleSource = useCallback(
    (source: SourceSystem) => {
      const isRemoving = selectedSources.has(source);

      setSelectedSources((current) => {
        const next = new Set(current);
        if (isRemoving) {
          next.delete(source);
        } else {
          next.add(source);
        }
        return next;
      });

      // The format facet only describes uploads. With Uploads deselected its
      // options are not rendered, so a surviving choice would be a filter the
      // reader can neither see nor clear.
      if (isRemoving && source === "UPLOAD") {
        setSelectedFormat(null);
      }

      setCurrentPage(1);
    },
    [selectedSources],
  );

  const toggleFormat = useCallback((format: UploadFormat) => {
    setSelectedFormat((current) => (current === format ? null : format));
    setCurrentPage(1);
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearchQuery("");
    setActiveTab("ALL");
    setSelectedSources(NO_SOURCES);
    setSelectedFormat(null);
    setCurrentPage(1);
  }, []);

  const hasActiveFilters =
    searchQuery !== "" ||
    activeTab !== "ALL" ||
    selectedSources.size > 0 ||
    selectedFormat !== null;

  return {
    artifacts,
    isLoading,
    fetchError,
    fetchArtifacts,
    searchQuery,
    activeTab,
    tabOptions,
    sourceOptions,
    formatOptions,
    selectedSources,
    selectedFormat,
    currentPage,
    totalPages,
    filteredArtifacts,
    paginatedArtifacts,
    handleSearchChange,
    handleTabChange,
    toggleSource,
    toggleFormat,
    setCurrentPage,
    handleClearFilters,
    hasActiveFilters,
  };
}
