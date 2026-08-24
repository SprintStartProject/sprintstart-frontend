import { useCallback, useEffect, useMemo, useState } from "react";
import { starterWorkService } from "../../../services/starterWorkService";
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
  // Held with the project they belong to, so switching project is a *derivation* rather than an
  // effect that clears state -- one less place for the list and the selection to disagree, and
  // no synchronous setState in an effect body (React 19 lint).
  const [loaded, setLoaded] = useState<{ projectId: string; items: StarterWorkCandidate[] }>({
    projectId: "",
    items: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showAssigned, setShowAssigned] = useState(false);
  const [promotingSourceId, setPromotingSourceId] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    void (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const items = await starterWorkService.fetchCandidates(projectId);
        if (!cancelled) setLoaded({ projectId, items });
      } catch (err) {
        if (!cancelled) setError(toMessage(err, "Could not load the project’s issues."));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Rows loaded for a project that is no longer selected are not this project's rows. Memoised
  // because the empty branch would otherwise be a new array each render, re-running everything
  // derived from it.
  const candidates = useMemo(
    () => (loaded.projectId === projectId ? loaded.items : []),
    [loaded, projectId],
  );

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
      setError(null);
      try {
        const task = await starterWorkService.promoteCandidate({ sourceId });
        // The server has just told us where this issue stands, so the row is corrected in
        // place rather than refetching the whole list to learn one field.
        setLoaded((prev) => ({
          ...prev,
          items: prev.items.map((candidate) =>
            candidate.sourceId === sourceId
              ? { ...candidate, poolState: "IN_POOL" as const }
              : candidate,
          ),
        }));
        await onPromoted(task, origin);
        return true;
      } catch (err) {
        setError(toMessage(err, "Could not add this issue to the pool."));
        return false;
      } finally {
        setPromotingSourceId(null);
      }
    },
    [onPromoted],
  );

  return {
    candidates: visible,
    resolveCandidate,
    totalCount: candidates.length,
    assignedCount,
    isLoading,
    error,
    query,
    setQuery,
    showAssigned,
    setShowAssigned,
    promotingSourceId,
    promote,
  };
}
