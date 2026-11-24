import { useCallback, useState } from "react";
import { getIngestionSourceStatuses } from "../../../../services/ingestionService.ts";
import type { SourceSystem } from "../../types.ts";
import { connectedIndex } from "./discoveryRules";

type ConnectedRepositories = {
  /** "owner/name" (lowercased) -> repository id, for every repo connected anywhere. */
  idsByFullName: Map<string, string>;
  /** The subset already belonging to the current project. */
  projectFullNames: Set<string>;
  load: () => Promise<void>;
};

/**
 * Discovery only reports *that* a repo is already a source, not its id or which projects it belongs
 * to. The per-repo status endpoint supplies both, so an already-ingested repo can be linked to this
 * project instead of being blocked.
 */
export function useConnectedRepositories(
  sourceSystem: SourceSystem,
  projectId: string | null,
): ConnectedRepositories {
  const [idsByFullName, setIdsByFullName] = useState<Map<string, string>>(new Map());
  const [projectFullNames, setProjectFullNames] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const [allConnected, connectedToProject] = await Promise.all([
        getIngestionSourceStatuses(),
        projectId ? getIngestionSourceStatuses(projectId) : Promise.resolve([]),
      ]);
      const index = connectedIndex(allConnected, connectedToProject, sourceSystem);

      setIdsByFullName(index.idsByFullName);
      setProjectFullNames(index.projectFullNames);
    } catch {
      // Degrades gracefully: without ids, already-connected repos stay
      // unselectable rather than offering an action that would fail.
      setIdsByFullName(new Map());
      setProjectFullNames(new Set());
    }
  }, [sourceSystem, projectId]);

  return { idsByFullName, projectFullNames, load };
}
