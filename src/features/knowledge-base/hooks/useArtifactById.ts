import { useQuery } from "@tanstack/react-query";
import { knowledgeService } from "../../../services/knowledgeService";
import { queryKeys } from "../../../services/queryKeys";
import type { Artifact } from "../types";

/**
 * Loads a single artifact by its ID within a project scope.
 * Used as a fallback when an artifact is requested (e.g. from a deep link or search)
 * that is not currently present in the active page of artifacts.
 *
 * @param projectId UUID of the project.
 * @param artifactId UUID of the artifact to load.
 */
export function useArtifactById(projectId: string | null, artifactId: string | null) {
  return useQuery<Artifact | null>({
    queryKey: queryKeys.knowledgeBase.detail(projectId ?? "", artifactId ?? ""),
    queryFn: () => {
      if (!projectId || !artifactId) return null;
      return knowledgeService.getArtifactById(projectId, artifactId);
    },
    enabled: Boolean(projectId && artifactId),
    staleTime: 60_000,
  });
}
