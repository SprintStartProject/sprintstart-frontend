import { useEffect, useMemo, useState } from "react";
import type { RunStatusFilter } from "../../features/data-ingestion/components/RunHistoryFilters.tsx";
import {
  DEFAULT_RUN_FILTER,
  buildRunQuery,
  isRunFilterActive,
  type RunFilterState,
  type RunSourceFilterOption,
} from "./ingestionRules";

/** The run history's status and source filters, the page it is on, and the query they make. */
export function useRunFilter(selectedProjectId: string) {
  const [filter, setFilter] = useState<RunFilterState>(DEFAULT_RUN_FILTER);
  const [pageNumber, setPageNumber] = useState(1);

  // Scoping by project is what keeps runs from other projects' repositories out of the list; the
  // backend resolves the project to its connected repositories.
  const query = useMemo(
    () => buildRunQuery(filter, pageNumber, selectedProjectId),
    [filter, pageNumber, selectedProjectId],
  );

  return {
    filter,
    pageNumber,
    setPageNumber,
    query,
    isActive: isRunFilterActive(filter),
    setStatus: (status: RunStatusFilter) => {
      setFilter((current) => ({ ...current, status }));
      setPageNumber(1);
    },
    setSource: (sourceValue: string, options: RunSourceFilterOption[]) => {
      const option = options.find((candidate) => candidate.value === sourceValue);
      setFilter((current) => ({
        ...current,
        sourceValue,
        sourceSystem: option?.sourceSystem ?? null,
      }));
      setPageNumber(1);
    },
    reset: () => {
      setFilter(DEFAULT_RUN_FILTER);
      setPageNumber(1);
    },
  };
}

/**
 * The viewed page can fall out of range while the view is open (a filter narrowing the result
 * set, runs being removed). Steps back to the last page instead of showing an empty table; this
 * re-runs the query.
 */
export function useClampedRunPage(
  totalPages: number | undefined,
  isPlaceholder: boolean,
  pageNumber: number,
  setPageNumber: (page: number) => void,
) {
  useEffect(() => {
    if (totalPages === undefined || isPlaceholder) return;

    if (totalPages >= 1 && pageNumber > totalPages) {
      void Promise.resolve().then(() => setPageNumber(totalPages));
    }
  }, [isPlaceholder, totalPages, pageNumber, setPageNumber]);
}
