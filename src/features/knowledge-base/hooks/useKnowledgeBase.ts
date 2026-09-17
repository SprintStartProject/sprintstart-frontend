import { useState, useMemo, useCallback, useDeferredValue } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { knowledgeService } from "../../../services/knowledgeService";
import { queryKeys } from "../../../services/queryKeys";
import type { Artifact } from "../types";
import { CONNECTOR_SUBFILTERS, DEFAULT_CONNECTOR_ORDER, type ConnectorTab } from "../tabs";

const ITEMS_PER_PAGE = 20;
const NO_ARTIFACTS: Artifact[] = [];

/** The knowledge-base query's loader, shared with route prefetch so the two never drift apart. */
export function loadKnowledgeBaseArtifacts(projectId: string): Promise<Artifact[]> {
  return knowledgeService.getUnifiedArtifacts(projectId);
}

/**
 * State + data layer for the Knowledge Base page.
 *
 * Owns artifact fetching, client-side two-tier filtering (search + connector + underfilter),
 * and pagination. UI-only state (which drawer is open, which modal is open) stays
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

  const [activeConnector, setActiveConnector] = useState<ConnectorTab>("ALL");
  const [activeSubfilter, setActiveSubfilter] = useState<string>("ALL");

  const [currentPage, setCurrentPage] = useState(1);

  // Available connectors dynamically derived from loaded artifacts
  const availableConnectors = useMemo<ConnectorTab[]>(() => {
    const systems = new Set<string>(artifacts.map((a) => a.sourceSystem));
    return DEFAULT_CONNECTOR_ORDER.filter(
      (c) => c === "ALL" || c === activeConnector || systems.has(c),
    );
  }, [artifacts, activeConnector]);

  // Helper to match text search across title, sourceId, and sourceUrl
  const matchesSearch = useCallback((artifact: Artifact, query: string): boolean => {
    if (!query) return true;
    const searchableText = [artifact.title ?? "", artifact.sourceId, artifact.sourceUrl ?? ""]
      .join(" ")
      .toLowerCase();
    return searchableText.includes(query.toLowerCase());
  }, []);

  // Connector counts taking the current search query into account
  const connectorCounts = useMemo<Record<ConnectorTab, number>>(() => {
    const counts: Record<ConnectorTab, number> = {
      ALL: 0,
      GITHUB: 0,
      JIRA: 0,
      CONFLUENCE: 0,
      UPLOAD: 0,
    };
    for (const artifact of artifacts) {
      if (matchesSearch(artifact, deferredSearchQuery)) {
        counts.ALL += 1;
        if (artifact.sourceSystem && artifact.sourceSystem in counts) {
          counts[artifact.sourceSystem] += 1;
        }
      }
    }
    return counts;
  }, [artifacts, deferredSearchQuery, matchesSearch]);

  // Subfilter options and dynamic counts for the currently active connector
  const subfilterOptions = useMemo(() => {
    const definitions = CONNECTOR_SUBFILTERS[activeConnector] ?? CONNECTOR_SUBFILTERS.ALL;
    const connectorArtifacts = artifacts.filter(
      (a) =>
        (activeConnector === "ALL" || a.sourceSystem === activeConnector) &&
        matchesSearch(a, deferredSearchQuery),
    );

    return definitions.map((def) => {
      const count =
        def.id === "ALL"
          ? connectorArtifacts.length
          : connectorArtifacts.filter((a) => def.matches(a)).length;
      return {
        id: def.id,
        label: def.label,
        count,
      };
    });
  }, [artifacts, activeConnector, deferredSearchQuery, matchesSearch]);

  // Paging and filter state resets when the project scope changes.
  const [pagedProjectId, setPagedProjectId] = useState(projectId);
  if (pagedProjectId !== projectId) {
    setPagedProjectId(projectId);
    setCurrentPage(1);
    setActiveConnector("ALL");
    setActiveSubfilter("ALL");
  }

  const filteredArtifacts = useMemo(() => {
    const definitions = CONNECTOR_SUBFILTERS[activeConnector] ?? CONNECTOR_SUBFILTERS.ALL;
    const currentSubfilterDef =
      definitions.find((d) => d.id === activeSubfilter) ??
      CONNECTOR_SUBFILTERS.ALL.find((d) => d.id === activeSubfilter);

    return artifacts.filter((artifact) => {
      const searchMatch = matchesSearch(artifact, deferredSearchQuery);
      if (!searchMatch) return false;

      const connectorMatch = activeConnector === "ALL" || artifact.sourceSystem === activeConnector;
      if (!connectorMatch) return false;

      if (!currentSubfilterDef || currentSubfilterDef.id === "ALL") {
        return true;
      }

      return currentSubfilterDef.matches(artifact);
    });
  }, [artifacts, activeConnector, activeSubfilter, deferredSearchQuery, matchesSearch]);

  const totalPages = Math.max(1, Math.ceil(filteredArtifacts.length / ITEMS_PER_PAGE));

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

  const handleConnectorChange = useCallback((connector: ConnectorTab) => {
    const target = (connector as string) === "UPLOADS" ? "UPLOAD" : connector;
    setActiveConnector(target);
    setActiveSubfilter("ALL");
    setCurrentPage(1);
  }, []);

  const handleSubfilterChange = useCallback((subfilter: string) => {
    setActiveSubfilter(subfilter);
    setCurrentPage(1);
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearchQuery("");
    setActiveConnector("ALL");
    setActiveSubfilter("ALL");
    setCurrentPage(1);
  }, []);

  // Backward-compatibility handler for legacy flat tab changes
  const handleTabChange = useCallback((tab: string) => {
    setCurrentPage(1);
    switch (tab) {
      case "ALL":
        setActiveConnector("ALL");
        setActiveSubfilter("ALL");
        break;
      case "UPLOADS":
      case "UPLOAD":
        setActiveConnector("UPLOAD");
        setActiveSubfilter("ALL");
        break;
      case "GITHUB":
      case "JIRA":
      case "CONFLUENCE":
        setActiveConnector(tab);
        setActiveSubfilter("ALL");
        break;
      case "PR":
      case "ISSUES":
      case "FILES":
      case "COMMITS":
      case "ORGANIZATIONS":
      case "PAGE":
      case "DOCS":
      case "PDF":
      case "MARKDOWN":
        setActiveConnector("ALL");
        setActiveSubfilter(tab);
        break;
      default:
        setActiveConnector("ALL");
        setActiveSubfilter("ALL");
    }
  }, []);

  const hasActiveFilters =
    searchQuery !== "" || activeConnector !== "ALL" || activeSubfilter !== "ALL";

  // Backward-compatibility alias reflecting active tab
  const activeTab = useMemo(() => {
    if (activeSubfilter !== "ALL") {
      return activeSubfilter;
    }
    if (activeConnector === "UPLOAD") {
      return "UPLOADS";
    }
    return activeConnector;
  }, [activeConnector, activeSubfilter]);

  return {
    artifacts,
    isLoading,
    fetchError,
    fetchArtifacts,
    searchQuery,
    activeConnector,
    activeSubfilter,
    availableConnectors,
    connectorCounts,
    subfilterOptions,
    activeTab,
    currentPage,
    totalPages,
    filteredArtifacts,
    paginatedArtifacts,
    handleSearchChange,
    handleConnectorChange,
    handleSubfilterChange,
    handleTabChange,
    setCurrentPage,
    handleClearFilters,
    hasActiveFilters,
  };
}
