import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";
import { knowledgeRequestService } from "./knowledgeRequestService";
import { insightsService } from "./faqService";
import { knowledgeGapService } from "./knowledgeGapService";
import { onboardingMetricsService } from "./onboardingMetricsService";
import { getTeamOverview } from "./teamManagementService";
import { loadBoard } from "../features/board/hooks/useBoard";
import {
  loadKnowledgeBasePage,
  loadKnowledgeBaseFacets,
} from "../features/knowledge-base/hooks/useKnowledgeBase";
import { DEFAULT_PAGE_SIZE } from "../features/knowledge-base/hooks/useKnowledgeBaseUrlState";
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
    case "/buddy":
      void import("../pages/BuddyPage");
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
/**
 * Warms the page module of `path` and, for routes with one dominant read, its main query.
 *
 * Project-scoped reads are skipped while `projectId` is `null`, since their query keys need
 * the project. Fire and forget: nothing is awaited, and a failed prefetch only means the page
 * loads its data itself.
 */
export function prefetchRoute(
  queryClient: QueryClient,
  path: string,
  projectId: string | null,
): void {
  prefetchRouteModule(path);

  switch (path) {
    case "/knowledge-base":
      if (!projectId) return;
      // The same first-page params the hook builds from an empty URL, so the
      // key matches — a hard-coded size would silently miss if the default moved.
      void queryClient.prefetchQuery({
        queryKey: queryKeys.knowledgeBase.list(projectId, { page: 1, size: DEFAULT_PAGE_SIZE }),
        queryFn: () => loadKnowledgeBasePage(projectId, { page: 1, size: DEFAULT_PAGE_SIZE }),
      });
      void queryClient.prefetchQuery({
        queryKey: queryKeys.knowledgeBase.facets(projectId, {}),
        queryFn: () => loadKnowledgeBaseFacets(projectId, {}),
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
