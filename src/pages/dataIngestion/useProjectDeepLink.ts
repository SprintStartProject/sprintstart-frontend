import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * The project is chosen globally in the sidebar switcher. The `?projectId=` search param is still
 * honoured so deep links from the admin view land on the right project: it writes into the global
 * selection, which holds the value unpublished until the loaded project list confirms it (or
 * drops it when that list says the project is not reachable).
 *
 * Consuming it, and then dropping the parameter, is what makes the switcher usable afterwards:
 * while the parameter stayed in the URL, every switch was immediately overwritten, because this
 * effect re-ran on the resulting mismatch and forced the deep-linked project back.
 */
export function useProjectDeepLink(
  selectedProjectId: string,
  setSelectedProjectId: (projectId: string) => void,
) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedProjectId = searchParams.get("projectId") ?? "";

  useEffect(() => {
    if (!requestedProjectId) return;

    void Promise.resolve().then(() => {
      if (requestedProjectId !== selectedProjectId) {
        setSelectedProjectId(requestedProjectId);
      }

      const next = new URLSearchParams(searchParams);
      next.delete("projectId");
      setSearchParams(next, { replace: true });
    });
  }, [requestedProjectId, searchParams, selectedProjectId, setSearchParams, setSelectedProjectId]);
}
