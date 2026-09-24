import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";
import { knowledgeRequestService } from "./knowledgeRequestService";
import { insightsService } from "./faqService";
import { knowledgeGapService } from "./knowledgeGapService";
import { onboardingMetricsService } from "./onboardingMetricsService";
import { getTeamOverview } from "./teamManagementService";
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
    case "/blueprints":
      void import("../pages/BlueprintPathsPage");
      return;
    // Every PM section ships in the workspace's one chunk.
    case "/pm-dashboard":
    case "/team-management":
    case "/insights/faq":
    case "/insights/knowledge-gaps":
    case "/insights/onboarding":
    case "/insights/knowledge-requests":
      void import("../features/pm-area/PmWorkspace");
      return;
    case "/data-ingestion":
      void import("../pages/DataIngestionPage");
      return;
    case "/hire-setup":
      void import("../pages/HireSetupPage");
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

    case "/hire-setup":
      void queryClient.prefetchQuery({
        queryKey: queryKeys.starterWork.review(),
        queryFn: loadStarterWorkReviewQueue,
      });
      return;

    case "/pm-dashboard":
    case "/team-management":
      // Both lead with the project's roster; same key and call as `useTeamRoster`.
      void queryClient.prefetchQuery({
        queryKey: queryKeys.teamOverview.filtered(projectId),
        queryFn: () => getTeamOverview(undefined, undefined, projectId ? [projectId] : undefined),
      });
      return;

    case "/insights/faq":
      if (!projectId) return;
      void queryClient.prefetchQuery({
        queryKey: queryKeys.faq.groups(projectId),
        queryFn: () => insightsService.fetchFAQGroups(projectId),
      });
      return;

    case "/insights/knowledge-gaps":
      if (!projectId) return;
      void queryClient.prefetchQuery({
        queryKey: queryKeys.knowledgeGaps.overview(projectId),
        queryFn: () => knowledgeGapService.fetchKnowledgeGaps(projectId),
      });
      return;

    case "/insights/onboarding":
      if (!projectId) return;
      void queryClient.prefetchQuery({
        queryKey: queryKeys.onboardingMetrics.project(projectId),
        queryFn: () => onboardingMetricsService.fetchProjectMetrics(projectId),
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
