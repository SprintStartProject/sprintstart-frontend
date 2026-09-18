import { useState, useMemo, useCallback, useDeferredValue } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { knowledgeService } from "../../../services/knowledgeService";
import { queryKeys } from "../../../services/queryKeys";
import type { Artifact, ArtifactType, SourceSystem } from "../types";
import {
  DEFAULT_FORMAT_ORDER,
  DEFAULT_SOURCE_ORDER,
  DEFAULT_TYPE_ORDER,
  FORMAT_LABELS,
  SOURCE_LABELS,
  TYPE_LABELS,
  isUpload,
  matchesFormat,
  type UploadFormat,
} from "../tabs";

const ITEMS_PER_PAGE = 20;
const NO_ARTIFACTS: Artifact[] = [];
const NO_SOURCES: ReadonlySet<SourceSystem> = new Set<SourceSystem>();
const NO_TYPES: ReadonlySet<ArtifactType> = new Set<ArtifactType>();

/** A single selectable option in a facet, with the count it would yield if added. */
export interface FacetOption<TValue extends string> {
  value: TValue;
  label: string;
  count: number;
}

/** How many options of each facet are currently selected. */
export interface FacetSelectionCounts {
  sources: number;
  types: number;
  format: number;
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

  const [selectedSources, setSelectedSources] = useState<ReadonlySet<SourceSystem>>(NO_SOURCES);
  const [selectedTypes, setSelectedTypes] = useState<ReadonlySet<ArtifactType>>(NO_TYPES);
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

  /**
   * Whether an artifact passes the facets.
   *
   * `skip` leaves one facet out, which is what a facet's own option counts need:
   * "3" next to GitHub means three artifacts match the search and everything else
   * the reader has chosen, not three that also satisfy the source facet they are
   * about to change.
   */
  const passesFacets = useCallback(
    (artifact: Artifact, skip?: "sources" | "types" | "format"): boolean => {
      if (
        skip !== "sources" &&
        selectedSources.size > 0 &&
        !selectedSources.has(artifact.sourceSystem)
      ) {
        return false;
      }
      if (skip !== "types" && selectedTypes.size > 0 && !selectedTypes.has(artifact.artifactType)) {
        return false;
      }
      if (
        skip !== "format" &&
        selectedFormat !== null &&
        !matchesFormat(artifact, selectedFormat)
      ) {
        return false;
      }
      return true;
    },
    [selectedSources, selectedTypes, selectedFormat],
  );

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
          passesFacets(artifact, "sources"),
      ).length,
    }));
  }, [artifacts, deferredSearchQuery, matchesSearch, passesFacets, selectedSources]);

  /**
   * The types the reader can actually reach right now — one entry per
   * `ArtifactType`, whatever connector carries it.
   *
   * A type is offered only while the sources, file format and search already
   * chosen can produce one: an option that is guaranteed to return nothing is
   * not a filter, it is a trap. Check Jira alone and the list is Jira's own
   * types, not every type in the project.
   *
   * A *selected* type is always kept, even after its count falls to zero, or the
   * reader could not uncheck the thing that emptied the list.
   *
   * Sources deliberately do not follow this rule. A connector is an entry point
   * ("is anything in Jira yet?") and stays listed with a count of 0; a type is a
   * refinement *within* the sources already chosen.
   */
  const typeOptions = useMemo<FacetOption<ArtifactType>[]>(() => {
    const reachable = artifacts.filter(
      (artifact) => matchesSearch(artifact, deferredSearchQuery) && passesFacets(artifact, "types"),
    );

    return DEFAULT_TYPE_ORDER.filter(
      (type) => selectedTypes.has(type) || reachable.some((a) => a.artifactType === type),
    ).map((type) => ({
      value: type,
      label: TYPE_LABELS[type],
      count: reachable.filter((artifact) => artifact.artifactType === type).length,
    }));
  }, [artifacts, deferredSearchQuery, matchesSearch, passesFacets, selectedTypes]);

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
        isUpload(artifact) &&
        matchesSearch(artifact, deferredSearchQuery) &&
        passesFacets(artifact, "format"),
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
  }, [
    artifacts,
    deferredSearchQuery,
    matchesSearch,
    passesFacets,
    selectedSources,
    selectedFormat,
  ]);

  // Paging resets when the project scope changes. This deliberately does not live
  // in `fetchArtifacts`: that function doubles as the Refresh handler, and hitting
  // Refresh on page 3 should leave the reader on page 3 rather than snapping back.
  const [pagedProjectId, setPagedProjectId] = useState(projectId);
  if (pagedProjectId !== projectId) {
    setPagedProjectId(projectId);
    setCurrentPage(1);
    setSelectedSources(NO_SOURCES);
    setSelectedTypes(NO_TYPES);
    setSelectedFormat(null);
  }

  const filteredArtifacts = useMemo(
    () =>
      artifacts.filter(
        (artifact) => matchesSearch(artifact, deferredSearchQuery) && passesFacets(artifact),
      ),
    [artifacts, deferredSearchQuery, matchesSearch, passesFacets],
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

  const toggleType = useCallback((type: ArtifactType) => {
    setSelectedTypes((current) => {
      const next = new Set(current);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
    setCurrentPage(1);
  }, []);

  const toggleFormat = useCallback((format: UploadFormat) => {
    setSelectedFormat((current) => (current === format ? null : format));
    setCurrentPage(1);
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearchQuery("");
    setSelectedSources(NO_SOURCES);
    setSelectedTypes(NO_TYPES);
    setSelectedFormat(null);
    setCurrentPage(1);
  }, []);

  const facetCounts = useMemo<FacetSelectionCounts>(
    () => ({
      sources: selectedSources.size,
      types: selectedTypes.size,
      format: selectedFormat === null ? 0 : 1,
    }),
    [selectedSources, selectedTypes, selectedFormat],
  );

  const hasActiveFilters =
    searchQuery !== "" ||
    facetCounts.sources > 0 ||
    facetCounts.types > 0 ||
    facetCounts.format > 0;

  return {
    artifacts,
    isLoading,
    fetchError,
    fetchArtifacts,
    searchQuery,
    sourceOptions,
    typeOptions,
    formatOptions,
    selectedSources,
    selectedTypes,
    selectedFormat,
    facetCounts,
    currentPage,
    totalPages,
    filteredArtifacts,
    paginatedArtifacts,
    handleSearchChange,
    toggleSource,
    toggleType,
    toggleFormat,
    setCurrentPage,
    handleClearFilters,
    hasActiveFilters,
  };
}
