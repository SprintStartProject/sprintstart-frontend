import { useState, useMemo, useCallback, useDeferredValue } from "react";
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

const ITEMS_PER_PAGE = 20;
const NO_ARTIFACTS: Artifact[] = [];
const NO_SOURCES: ReadonlySet<SourceSystem> = new Set<SourceSystem>();
const NO_REPOSITORIES: ReadonlySet<string> = new Set<string>();

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

/** Paginated query loader, shared with route prefetch. */
export function loadKnowledgeBasePage(
  projectId: string,
  params: KnowledgeListParams = { page: 1, size: ITEMS_PER_PAGE },
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
 * @param projectId The project to scope artifact fetching to. When null, no
 *   fetch is attempted and the page should render its empty state.
 */
export function useKnowledgeBase(projectId: string | null) {
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const [activeTab, setActiveTab] = useState<KnowledgeTab>("ALL");
  const [selectedSources, setSelectedSources] = useState<ReadonlySet<SourceSystem>>(NO_SOURCES);
  const [selectedFormat, setSelectedFormat] = useState<UploadFormat | null>(null);
  const [selectedRepositories, setSelectedRepositories] =
    useState<ReadonlySet<string>>(NO_REPOSITORIES);
  const [currentPage, setCurrentPage] = useState(1);

  // Paging and filters reset when the project scope changes.
  const [pagedProjectId, setPagedProjectId] = useState(projectId);
  if (pagedProjectId !== projectId) {
    setPagedProjectId(projectId);
    setCurrentPage(1);
    setActiveTab("ALL");
    setSelectedSources(NO_SOURCES);
    setSelectedFormat(null);
    setSelectedRepositories(NO_REPOSITORIES);
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

  const listParams: KnowledgeListParams = useMemo(
    () => ({
      page: currentPage,
      size: ITEMS_PER_PAGE,
      search: deferredSearchQuery.trim() || undefined,
      types: typesParam,
      sources: sourcesParam,
      repositories: repositoriesParam,
      format: selectedFormat ?? undefined,
    }),
    [currentPage, deferredSearchQuery, typesParam, sourcesParam, repositoriesParam, selectedFormat],
  );

  const facetsParams: KnowledgeListParams = useMemo(
    () => ({
      search: deferredSearchQuery.trim() || undefined,
      types: typesParam,
      sources: sourcesParam,
      repositories: repositoriesParam,
      format: selectedFormat ?? undefined,
    }),
    [deferredSearchQuery, typesParam, sourcesParam, repositoriesParam, selectedFormat],
  );

  const listQueryKey = queryKeys.knowledgeBase.list(projectId ?? "", listParams);
  const facetsQueryKey = queryKeys.knowledgeBase.facets(projectId ?? "", facetsParams);

  const {
    data: pageData,
    isLoading: isListLoading,
    isError: isListError,
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

  if (currentPage > totalPages && totalPages > 0) {
    setCurrentPage(totalPages);
  }

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

      if (isRemoving && source === "UPLOAD") {
        setSelectedFormat(null);
      }

      if (isRemoving && source === "GITHUB") {
        setSelectedRepositories(NO_REPOSITORIES);
      }

      setCurrentPage(1);
    },
    [selectedSources],
  );

  const toggleFormat = useCallback((format: UploadFormat) => {
    setSelectedFormat((current) => (current === format ? null : format));
    setCurrentPage(1);
  }, []);

  const toggleRepository = useCallback((repository: string) => {
    setSelectedRepositories((current) => {
      const next = new Set(current);
      if (next.has(repository)) {
        next.delete(repository);
      } else {
        next.add(repository);
      }
      return next;
    });
    setCurrentPage(1);
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearchQuery("");
    setActiveTab("ALL");
    setSelectedSources(NO_SOURCES);
    setSelectedFormat(null);
    setSelectedRepositories(NO_REPOSITORIES);
    setCurrentPage(1);
  }, []);

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
    handleSearchChange,
    handleTabChange,
    toggleSource,
    toggleFormat,
    toggleRepository,
    setCurrentPage,
    handleClearFilters,
    hasActiveFilters,
  };
}
