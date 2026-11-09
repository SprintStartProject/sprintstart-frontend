import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NavigateFunction } from "react-router-dom";
import { blueprintService, type BlueprintScope } from "../../services/blueprintService.ts";
import type { BlueprintPath } from "./types.ts";
import { withGraphNodes } from "./withGraphNodes.ts";

/** What the route, the signed-in user and the selected project say about this page. */
export interface PathScopeInput {
  pathId: string | undefined;
  /** The `scope` query parameter. */
  scopeParam: string | null;
  permissionGroup: string | undefined;
  selectedProjectId: string;
  isProjectLoading: boolean;
}

/**
 * Which blueprint this page is about and in what scope.
 *
 * The path belongs to the selected project, or to the global scope with `?scope=global`, which
 * only an `ADMIN` gets.
 */
export function usePathScope(input: PathScopeInput) {
  const { pathId, scopeParam, permissionGroup, selectedProjectId, isProjectLoading } = input;
  const isGlobal = scopeParam === "global" && permissionGroup === "ADMIN";
  const scope = useMemo<BlueprintScope>(
    () => (isGlobal ? { kind: "global" } : { kind: "project", projectId: selectedProjectId }),
    [isGlobal, selectedProjectId],
  );

  return {
    pathId,
    isGlobal,
    scope,
    listPath: isGlobal ? "/blueprints?scope=global" : "/blueprints",
    selectedProjectId,
    isProjectLoading,
  };
}

export type PathScope = ReturnType<typeof usePathScope>;

/**
 * Loads the path together with its graph, and merges the two.
 *
 * The two requests are one fact. `GET /paths/{id}` returns phases without `graphX`, `graphY` or
 * `blockerIds` — `GetBlueprintPhaseResponse` simply has no such fields, while the nested *step*
 * response does — so a path loaded on its own describes every phase as never placed, and the
 * canvas drawn from it is empty. That is what made the graph vanish after "Edit as draft" (which
 * navigates to the new draft's id) and after Publish (which replaces the path with a fresh DTO),
 * and why a reload appeared to fix it: a reload starts in list mode, and the graph was fetched
 * again on the way back.
 *
 * Merging here rather than at each call site means no caller can forget.
 *
 * TODO(backend): the three fields on the nested phase response would remove the second request
 * entirely.
 */
function usePathRequest(pathId: string | undefined, scope: BlueprintScope) {
  const [path, setPath] = useState<BlueprintPath | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPath = useCallback(
    async (showLoading = true) => {
      if (!pathId) return;
      if (showLoading) setIsLoading(true);
      setError(null);
      try {
        const [nextPath, graph] = await Promise.all([
          blueprintService.getPath(scope, pathId),
          blueprintService.getGraph(scope, pathId),
        ]);
        setPath(withGraphNodes(nextPath, graph.nodes));
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Blueprint path could not be loaded.");
      } finally {
        if (showLoading) setIsLoading(false);
      }
    },
    [scope, pathId],
  );

  return { path, setPath, isLoading, error, setError, loadPath };
}

/**
 * Loads the path once the project is known, and leaves for the list when the project it belongs
 * to is not the selected one any more.
 */
export function usePathLoader(scope: PathScope, navigate: NavigateFunction) {
  const request = usePathRequest(scope.pathId, scope.scope);
  const { loadPath } = request;
  const { isGlobal, isProjectLoading, selectedProjectId } = scope;
  const projectIdAtMount = useRef<string | null>(null);

  useEffect(() => {
    if (!isGlobal) {
      if (isProjectLoading) return;
      if (!selectedProjectId) {
        void navigate("/blueprints", { replace: true });
        return;
      }
      if (projectIdAtMount.current === null) {
        projectIdAtMount.current = selectedProjectId;
      } else if (projectIdAtMount.current !== selectedProjectId) {
        projectIdAtMount.current = selectedProjectId;
        void navigate("/blueprints", { replace: true });
        return;
      }
    }
    void loadPath();
  }, [isGlobal, isProjectLoading, loadPath, navigate, selectedProjectId]);

  return request;
}
