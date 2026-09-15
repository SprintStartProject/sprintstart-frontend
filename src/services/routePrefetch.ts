import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";
import { knowledgeRequestService } from "./knowledgeRequestService";
import { loadBoard } from "../features/board/hooks/useBoard";
import { loadKnowledgeBaseArtifacts } from "../features/knowledge-base/hooks/useKnowledgeBase";
import { loadStarterWorkReviewQueue } from "../features/starter-work/hooks/useStarterWorkReview";

/**
 * Route → cache warm-up, fired from the sidebar on `pointerdown` (see `SidebarNavLink`).
 *
 * Every sidebar route warms its lazy page module. Routes with one dominant, migrated read
 * also warm that query; pages assembled from several widgets, or still owning their data by
 * hand, only prefetch their code.
 *
 * Each data entry pairs the `queryKey` its page's own hook uses with that hook's exported
 * loader function, so a revisit within the shared 30s `staleTime` finds the data already
 * warm and a change to a loader's transform can't silently drift out of sync with this list.
 * `prefetchQuery` itself is a no-op against data that is still fresh, so a pointerdown on the
 * already-active entry (or a second one before the first lands) costs nothing extra.
 */
function prefetchRouteModule(path: string): void {
  switch (path) {
    case "/":
      void import("../pages/DashboardPage");
      return;
    case "/board":
      void import("../pages/BoardPage");
      return;
    case "/chat":
      void import("../pages/ChatPage");
      return;
    case "/knowledge-base":
      void import("../pages/KnowledgeBasePage");
      return;
    case "/onboarding":
      void import("../pages/OnBoardingPage");
      return;
    case "/pm-dashboard":
      void import("../pages/PmDashboardPage");
      return;
    case "/data-ingestion":
      void import("../pages/DataIngestionPage");
      return;
    case "/arrival-steps":
      void import("../pages/ArrivalStepsPage");
      return;
    case "/starter-work":
      void import("../pages/StarterWorkPage");
      return;
    case "/insights/knowledge-requests":
      void import("../features/knowledge-request/components/KnowledgeRequestInboxPage");
      return;
    case "/admin":
      void import("../pages/AdminPage");
      return;
    default:
      return;
  }
}
export function prefetchRoute(
  queryClient: QueryClient,
  path: string,
  projectId: string | null,
): void {
  prefetchRouteModule(path);

  switch (path) {
    case "/knowledge-base":
      if (!projectId) return;
      void queryClient.prefetchQuery({
        queryKey: queryKeys.knowledgeBase.byProject(projectId),
        queryFn: () => loadKnowledgeBaseArtifacts(projectId),
      });
      return;

    case "/board":
      if (!projectId) return;
      void queryClient.prefetchQuery({
        queryKey: queryKeys.board.byProject(projectId),
        queryFn: () => loadBoard(projectId),
      });
      return;

    case "/starter-work":
      void queryClient.prefetchQuery({
        queryKey: queryKeys.starterWork.review(),
        queryFn: loadStarterWorkReviewQueue,
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
