import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";
import { boardService } from "./boardService";
import { knowledgeService } from "./knowledgeService";
import { knowledgeRequestService } from "./knowledgeRequestService";
import { starterWorkService } from "./starterWorkService";

/**
 * Route → cache warm-up, fired from the sidebar on `pointerdown` (see `SidebarNavLink`).
 *
 * Only routes with one dominant, already-migrated read register here. A page assembled
 * from several independent widget queries (the two dashboards) has no single key worth
 * racing ahead of, and a page that still owns its data by hand (Data Ingestion,
 * OnBoarding, Arrival Steps) has nothing here to prefetch into in the first place.
 *
 * Each entry mirrors the `queryKey`/`queryFn` pair its page's own hook already runs, so a
 * revisit within the shared 30s `staleTime` finds the data already warm. `prefetchQuery`
 * itself is a no-op against data that is still fresh, so a pointerdown on the already-active
 * entry (or a second one before the first lands) costs nothing extra.
 */
export function prefetchRoute(
  queryClient: QueryClient,
  path: string,
  projectId: string | null,
): void {
  switch (path) {
    case "/knowledge-base":
      if (!projectId) return;
      void queryClient.prefetchQuery({
        queryKey: queryKeys.knowledgeBase.byProject(projectId),
        queryFn: () => knowledgeService.getUnifiedArtifacts(projectId),
      });
      return;

    case "/board":
      if (!projectId) return;
      void queryClient.prefetchQuery({
        queryKey: queryKeys.board.byProject(projectId),
        queryFn: () => boardService.fetchBoard(projectId),
      });
      return;

    case "/starter-work":
      void queryClient.prefetchQuery({
        queryKey: queryKeys.starterWork.review(),
        queryFn: () => starterWorkService.fetchUnreviewed().then((proposed) => proposed.tasks),
      });
      return;

    case "/insights/knowledge-requests":
      if (!projectId) return;
      void queryClient.prefetchQuery({
        queryKey: queryKeys.knowledgeRequest.open(projectId),
        queryFn: () => knowledgeRequestService.listOpen(projectId),
      });
      return;

    default:
      return;
  }
}
