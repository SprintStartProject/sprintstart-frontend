import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { starterWorkService } from "../../../services/starterWorkService";
import { queryKeys } from "../../../services/queryKeys";
import type { StarterWorkCandidate, StarterWorkTask } from "../types";
import type { PoolFlightRect } from "../components/poolFlight";

function toMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/**
 * Does this issue match what somebody typed?
 *
 * Over the title, the labels and the source id, because those are the three things a PM knows an
 * issue by — its name, what the project calls it, and its number. Not the excerpt: matching body
 * text would surface rows whose reason for matching is off-screen.
 */
function matches(candidate: StarterWorkCandidate, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return true;
  return (
    candidate.title.toLowerCase().includes(needle) ||
    candidate.sourceId.toLowerCase().includes(needle) ||
    candidate.labels.some((label) => label.toLowerCase().includes(needle))
  );
}

const NO_CANDIDATES: StarterWorkCandidate[] = [];

/**
 * Owns the browsable list of a project's open corpus issues and putting one in the pool.
 *
 * Searching and the assigned filter are client-side over a list already in hand — the backend
 * sends every open issue once, and a search that costs a round trip is one people stop using.
 *
 * The assigned filter defaults to off, and hides only a definite `true`. `hasAssignee` is
 * three-valued: null means SprintStart does not know (it does not ingest GitHub assignees), and
 * hiding those would empty the list for every GitHub project. Issues already pooled or removed are
 * never hidden at all — they are shown marked, because an issue missing from the list leaves a
 * reader unable to tell "filtered" from "not ingested".
 *
 * @param projectId The project whose corpus to browse; nothing loads while it is empty.
 * @param onPromoted Called with the created task, so the page can confirm where it went.
 */
export function useCorpusIssueBrowser(
  projectId: string,
  onPromoted: (task: StarterWorkTask, origin?: PoolFlightRect) => Promise<void> | void,
) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.starterWork.corpusIssues(projectId);

  const {
    data,
    isLoading,
    isError,
    error: queryError,
  } = useQuery({
    queryKey,
    queryFn: () => starterWorkService.fetchCandidates(projectId),
    enabled: Boolean(projectId),
  });

  const [query, setQuery] = useState("");
  const [showAssigned, setShowAssigned] = useState(false);
  const [promotingSourceId, setPromotingSourceId] = useState<string | null>(null);
  // The promote failure below lives here rather than in the query's own error, since it is about
  // one action, not about the list — a failed promote should not blank out rows already on screen.
  const [promoteError, setPromoteError] = useState<string | null>(null);

  // Keyed by project id, so rows loaded for a project that is no longer selected are never shown.
  const candidates = projectId ? (data ?? NO_CANDIDATES) : NO_CANDIDATES;

  // A fresh, successful load (a project switch, or react-query's own background
  // revalidation) supersedes a stale promote failure the same way it used to
  // when both lived in one shared error slot. Deferred to a microtask so this
  // setState call doesn't run synchronously in the effect body (React's
  // cascading-render guard).
  useEffect(() => {
    void Promise.resolve().then(() => setPromoteError(null));
  }, [data]);

  /** How many issues the assigned filter is holding back, so its absence is never silent. */
  const assignedCount = useMemo(
    () => candidates.filter((candidate) => candidate.hasAssignee === true).length,
    [candidates],
  );

  const visible = useMemo(
    () =>
      candidates.filter(
        (candidate) =>
          (showAssigned || candidate.hasAssignee !== true) && matches(candidate, query),
      ),
    [candidates, showAssigned, query],
  );

  // Resolves an id against the whole loaded list, not the filtered `visible` one, so an open detail
  // drawer survives search-as-you-type: typing a character that no longer matches the open issue
  // narrows the list without pulling the issue the reader is looking at out from under them. Its
  // pool state still comes from the live list, so an add reflects the moment the drawer sees it.
  const resolveCandidate = useCallback(
    (sourceId: string) => candidates.find((candidate) => candidate.sourceId === sourceId) ?? null,
    [candidates],
  );

  const promote = useCallback(
    async (sourceId: string, origin?: PoolFlightRect): Promise<boolean> => {
      setPromotingSourceId(sourceId);
      setPromoteError(null);
      try {
        const task = await starterWorkService.promoteCandidate({ sourceId });
        // The server has just told us where this issue stands, so the row is corrected in
        // place rather than refetching the whole list to learn one field.
        queryClient.setQueryData(queryKey, (prev: StarterWorkCandidate[] | undefined) =>
          prev?.map((candidate) =>
            candidate.sourceId === sourceId
              ? { ...candidate, poolState: "IN_POOL" as const }
              : candidate,
          ),
        );
        await onPromoted(task, origin);
        return true;
      } catch (err) {
        setPromoteError(toMessage(err, "Could not add this issue to the pool."));
        return false;
      } finally {
        setPromotingSourceId(null);
      }
    },
    [onPromoted, queryClient, queryKey],
  );

  return {
    candidates: visible,
    resolveCandidate,
    totalCount: candidates.length,
    assignedCount,
    isLoading: Boolean(projectId) && isLoading,
    error:
      promoteError ??
      (isError ? toMessage(queryError, "Could not load the project’s issues.") : null),
    query,
    setQuery,
    showAssigned,
    setShowAssigned,
    promotingSourceId,
    promote,
  };
}
