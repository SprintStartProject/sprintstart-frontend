import { useQuery } from "@tanstack/react-query";
import { knowledgeService } from "../../../services/knowledgeService";
import { queryKeys } from "../../../services/queryKeys";
import type { ArtifactAiStatus, ArtifactAiStatusResponse } from "../types";

/** How long a status is trusted before a remount refetches it. */
export const AI_STATUS_STALE_MS = 5 * 60 * 1000;

/** Poll interval while at least one artifact on the page is still being indexed. */
export const AI_STATUS_POLL_MS = 10 * 1000;

function isProcessing(data: ArtifactAiStatusResponse | undefined): boolean {
  return data?.items.some((item) => item.status === "PROCESSING") ?? false;
}

/** `null` when the AI was unavailable: its all-UNKNOWN answer says nothing about the artifacts. */
function toStatusMap(
  response: ArtifactAiStatusResponse,
): ReadonlyMap<string, ArtifactAiStatus> | null {
  return response.aiAvailable
    ? new Map(response.items.map((item) => [item.artifactId, item.status] as const))
    : null;
}

/**
 * AI index status for the artifacts on screen: one batched request per visible page, keyed on
 * the page's ids.
 *
 * - No request for an empty page or without a project.
 * - `retry: false` and a 5-minute stale time: the chip is a hint, it must never hammer the
 *   backend or the AI when either is struggling.
 * - Polls every 10 s only while some item is `PROCESSING`, and stops once none is.
 *
 * @param projectId Active project, or null before one is chosen.
 * @param artifactIds Ingestion ids of the visible page, in any stable order.
 * @returns Status per artifact id, or `null` when no chip may be drawn: the AI was unavailable
 *   (`aiAvailable: false`), the request failed, or it has not answered yet. Ids missing from the
 *   map (outside the project) get no chip either.
 */
export function useArtifactAiStatus(
  projectId: string | null | undefined,
  artifactIds: readonly string[],
): ReadonlyMap<string, ArtifactAiStatus> | null {
  const enabled = Boolean(projectId) && artifactIds.length > 0;
  const { data, isError } = useQuery({
    queryKey: queryKeys.knowledgeBase.aiStatus(projectId ?? "", artifactIds),
    queryFn: () => knowledgeService.getArtifactAiStatus(projectId ?? "", artifactIds),
    enabled,
    retry: false,
    staleTime: AI_STATUS_STALE_MS,
    refetchInterval: (query) => (isProcessing(query.state.data) ? AI_STATUS_POLL_MS : false),
    // Module-level, so React Query memoizes the map and memoized cards do not re-render.
    select: toStatusMap,
  });

  if (!enabled || isError || !data) return null;
  return data;
}
