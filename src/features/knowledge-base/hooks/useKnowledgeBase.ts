import { useState, useMemo, useCallback, useEffect } from "react";
import { NavigationType, useNavigationType } from "react-router-dom";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { knowledgeService } from "../../../services/knowledgeService";
import { queryKeys } from "../../../services/queryKeys";
import type {
  Artifact,
  ArtifactFacets,
  ArtifactPage,
  ArtifactType,
  KnowledgeListParams,
  SourceSystem,
  UploadFormat,
} from "../types";
import {
  DEFAULT_FORMAT_ORDER,
  DEFAULT_SOURCE_ORDER,
  FORMAT_LABELS,
  KNOWLEDGE_TABS,
  type KnowledgeTab,
  SOURCE_LABELS,
} from "../tabs";
import { DEFAULT_PAGE_SIZE, useKnowledgeBaseUrlState } from "./useKnowledgeBaseUrlState.ts";
import type { KnowledgeBaseUrlStateOptions } from "./useKnowledgeBaseUrlState.ts";

const NO_ARTIFACTS: Artifact[] = [];

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

/**
 * Paginated query loader, shared with route prefetch. The prefetch warms the *default* state
 * (page 1, default size, no filters); a filtered deep link simply fetches once on arrival.
 */
export function loadKnowledgeBasePage(
  projectId: string,
  params: KnowledgeListParams = { page: 1, size: DEFAULT_PAGE_SIZE },
): Promise<ArtifactPage> {
  return knowledgeService.getArtifactPage(projectId, params);
}

/** Facets query loader, shared with route prefetch. */
export function loadKnowledgeBaseFacets(
  projectId: string,
  params: KnowledgeListParams = {},
): Promise<ArtifactFacets> {
  return knowledgeService.getArtifactFacets(projectId, params);
}

/**
 * State + data layer for the Knowledge Base page.
 *
 * Owns artifact fetching, server-side pagination, and faceted search.
 * Filtering supports sources, artifact types, file format, and repository,
 * backed by PostgreSQL indexes and projection queries.
 *
 * Every filter, the page, the page size and the open artifact live in the URL
 * (see {@link useKnowledgeBaseUrlState}); this hook turns them into requests and
 * facet options. The one piece of local state is the search *input*, because the
 * router applies location changes inside a transition and a text field bound
 * straight to the URL would lag behind the keyboard.
 *
 * @param projectId The project to scope artifact fetching to. When null, no
 *   fetch is attempted and the page should render its empty state.
 * @param options Forwarded to {@link useKnowledgeBaseUrlState}; the page passes
 *   `projectSettled` so the initial project resolution does not clear a shared link.
 */
export function useKnowledgeBase(
  projectId: string | null,
  options: KnowledgeBaseUrlStateOptions = {},
) {
  const queryClient = useQueryClient();
  const navigationType = useNavigationType();

  const {
    state: urlState,
    scopeProjectId,
    setTab,
    setSearch,
    toggleSource,
    toggleFormat,
    toggleRepository,
    setPage,
    setSize,
    clearFilters,
    setArtifactId,
  } = useKnowledgeBaseUrlState(projectId, options);

  const {
    tab: activeTab,
    sources: selectedSources,
    format: selectedFormat,
    repositories: selectedRepositories,
    page: requestedPage,
    size: pageSize,
  } = urlState;

  /*
    The search input's own copy of `?q=`. It follows the URL only when the URL changed for a reason
    other than this input: Back/Forward (a POP navigation) or a project switch. Every other change
    of `?q=` was written *from* this state, so adopting it back could only ever be a stale echo -
    one that, arriving a transition late, would eat the characters typed in between.
  */
  const [searchQuery, setSearchQuery] = useState(urlState.search);
  const [syncedSearch, setSyncedSearch] = useState(urlState.search);
  const [searchScope, setSearchScope] = useState(scopeProjectId);
  if (searchScope !== scopeProjectId) {
    setSearchScope(scopeProjectId);
    setSyncedSearch(urlState.search);
    setSearchQuery(urlState.search);
  } else if (syncedSearch !== urlState.search) {
    setSyncedSearch(urlState.search);
    if (navigationType === NavigationType.Pop) setSearchQuery(urlState.search);
  }

  const typesParam: ArtifactType[] | undefined = useMemo(() => {
    if (activeTab === "ALL") return undefined;
    return [activeTab];
  }, [activeTab]);

  const sourcesParam: SourceSystem[] | undefined = useMemo(() => {
    if (selectedSources.size === 0) return undefined;
    return Array.from(selectedSources);
  }, [selectedSources]);

  const repositoriesParam: string[] | undefined = useMemo(() => {
    if (selectedRepositories.size === 0) return undefined;
    return Array.from(selectedRepositories);
  }, [selectedRepositories]);

  const searchParam = urlState.search.trim() || undefined;

  const listParams: KnowledgeListParams = useMemo(
    () => ({
      page: requestedPage,
      size: pageSize,
      search: searchParam,
      types: typesParam,
      sources: sourcesParam,
      repositories: repositoriesParam,
      format: selectedFormat ?? undefined,
    }),
    [
      requestedPage,
      pageSize,
      searchParam,
      typesParam,
      sourcesParam,
      repositoriesParam,
      selectedFormat,
    ],
  );

  const facetsParams: KnowledgeListParams = useMemo(
    () => ({
      search: searchParam,
      types: typesParam,
      sources: sourcesParam,
      repositories: repositoriesParam,
      format: selectedFormat ?? undefined,
    }),
    [searchParam, typesParam, sourcesParam, repositoriesParam, selectedFormat],
  );

  const listQueryKey = queryKeys.knowledgeBase.list(projectId ?? "", listParams);
  const facetsQueryKey = queryKeys.knowledgeBase.facets(projectId ?? "", facetsParams);

  const {
    data: pageData,
    isLoading: isListLoading,
    isError: isListError,
    isPlaceholderData,
    refetch: refetchList,
  } = useQuery({
    queryKey: listQueryKey,
    queryFn: () => knowledgeService.getArtifactPage(projectId as string, listParams),
    enabled: projectId !== null,
    placeholderData: keepPreviousData,
  });

  const {
    data: facetsData,
    isLoading: isFacetsLoading,
    isError: isFacetsError,
    refetch: refetchFacets,
  } = useQuery({
    queryKey: facetsQueryKey,
    queryFn: () => knowledgeService.getArtifactFacets(projectId as string, facetsParams),
    enabled: projectId !== null,
    placeholderData: keepPreviousData,
  });

  const artifacts = projectId !== null ? (pageData?.items ?? NO_ARTIFACTS) : NO_ARTIFACTS;
  const isLoading = projectId !== null && (isListLoading || isFacetsLoading);
  const fetchError =
    isListError || isFacetsError ? "Failed to load artifacts. Please try again." : null;

  const pageMeta = pageData?.page;
  const totalPages = Math.max(1, pageMeta?.totalPages ?? 1);
  const totalElements = pageMeta?.totalElements ?? artifacts.length;

  /*
    A `?page=` past the end (a stale link, a result set that shrank) is pulled back into range.
    The render already reports the clamped page; the URL is corrected afterwards with a `replace`,
    because navigating during render is not allowed. Only an answer for *this* query can prove the
    page is out of range - placeholder data still describes the previous one, and clamping against
    it would, say, drag a Back navigation to page 3 down to the previous filter's single page.
  */
  const isPageOutOfRange =
    pageData !== undefined && !isPlaceholderData && requestedPage > totalPages;
  const currentPage = isPageOutOfRange ? totalPages : requestedPage;

  useEffect(() => {
    if (isPageOutOfRange) setPage(totalPages, "replace");
  }, [isPageOutOfRange, totalPages, setPage]);

  const fetchArtifacts = useCallback(async () => {
    if (projectId === null) return;
    await queryClient.cancelQueries({ queryKey: queryKeys.knowledgeBase.project(projectId) });
    await Promise.all([refetchList(), refetchFacets()]);
  }, [projectId, queryClient, refetchList, refetchFacets]);

  const tabCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of facetsData?.types ?? []) {
      map.set(t.value, t.count);
    }
    return map;
  }, [facetsData?.types]);

  const tabOptions = useMemo<TabOption[]>(() => {
    const totalAll = (facetsData?.types ?? []).reduce((acc, curr) => acc + curr.count, 0);
    return KNOWLEDGE_TABS.filter(
      (tab) => tab.id === "ALL" || tab.id === activeTab || (tabCounts.get(tab.id) ?? 0) > 0,
    ).map((tab) => ({
      value: tab.id,
      label: tab.label,
      count: tab.id === "ALL" ? totalAll : (tabCounts.get(tab.id) ?? 0),
    }));
  }, [activeTab, facetsData?.types, tabCounts]);

  const sourceCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of facetsData?.sources ?? []) {
      map.set(s.value, s.count);
    }
    return map;
  }, [facetsData?.sources]);

  const sourceOptions = useMemo<FacetOption<SourceSystem>[]>(() => {
    return DEFAULT_SOURCE_ORDER.filter(
      (source) => sourceCounts.has(source) || selectedSources.has(source),
    ).map((source) => ({
      value: source,
      label: SOURCE_LABELS[source],
      count: sourceCounts.get(source) ?? 0,
    }));
  }, [selectedSources, sourceCounts]);

  const formatCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const f of facetsData?.formats ?? []) {
      map.set(f.value, f.count);
    }
    return map;
  }, [facetsData?.formats]);

  const formatOptions = useMemo<FacetOption<UploadFormat>[]>(() => {
    if (!selectedSources.has("UPLOAD")) return [];
    return DEFAULT_FORMAT_ORDER.filter(
      (format) => selectedFormat === format || (formatCounts.get(format) ?? 0) > 0,
    ).map((format) => ({
      value: format,
      label: FORMAT_LABELS[format],
      count: formatCounts.get(format) ?? 0,
    }));
  }, [selectedSources, selectedFormat, formatCounts]);

  const repoCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of facetsData?.repositories ?? []) {
      map.set(r.value, r.count);
    }
    return map;
  }, [facetsData?.repositories]);

  const repositoryOptions = useMemo<FacetOption<string>[]>(() => {
    if (!selectedSources.has("GITHUB")) return [];
    const repos = (facetsData?.repositories ?? []).map((r) => r.value);
    const offered = Array.from(new Set([...repos, ...selectedRepositories])).sort((a, b) =>
      a.localeCompare(b),
    );
    return offered.map((repository) => ({
      value: repository,
      label: repository,
      count: repoCounts.get(repository) ?? 0,
    }));
  }, [selectedSources, selectedRepositories, facetsData?.repositories, repoCounts]);

  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchQuery(query);
      setSearch(query);
    },
    [setSearch],
  );

  const handleTabChange = useCallback((tab: KnowledgeTab) => setTab(tab), [setTab]);

  const setCurrentPage = useCallback((page: number) => setPage(page), [setPage]);

  const handleClearFilters = useCallback(() => {
    setSearchQuery("");
    clearFilters();
  }, [clearFilters]);

  const hasActiveFilters =
    searchQuery !== "" ||
    activeTab !== "ALL" ||
    selectedSources.size > 0 ||
    selectedFormat !== null ||
    selectedRepositories.size > 0;

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
    repositoryOptions,
    selectedSources,
    selectedFormat,
    selectedRepositories,
    currentPage,
    totalPages,
    totalElements,
    pageSize,
    handleSearchChange,
    handleTabChange,
    toggleSource,
    toggleFormat,
    toggleRepository,
    setCurrentPage,
    setPageSize: setSize,
    handleClearFilters,
    hasActiveFilters,
    /** The artifact open in the viewer drawer (`?artifact=`), or null. */
    selectedArtifactId: urlState.artifactId,
    /** Opens or closes the viewer drawer; `replace`s `?artifact=` so reading leaves no history. */
    setSelectedArtifactId: setArtifactId,
  };
}
