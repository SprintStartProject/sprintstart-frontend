import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { useProjectContext } from "../features/projects/useProjectContext";
import { canAccessRoute, getDefaultRoute, type AppRoute } from "../auth/accessPolicy";
import { AssistantShell } from "../components/layout/AssistantShell";
import { PageShellSkeleton } from "../components/layout/PageShell";
import { PageTransition } from "../components/layout/PageTransition";
import { AuthGuard } from "./AuthGuard";
// Not lazy, unlike every other route below: `AuthGuard`'s Keycloak redirect chain (logout,
// the silent SSO check on boot) can land here through several full page reloads in a row,
// each needing this chunk again. `PageShellSkeleton` -- the shared `Suspense` fallback -- has
// no login-card shape to preview, so every one of those loads would flash its header/spinner
// right before this replaces it. Bundling it eagerly removes the wait Suspense would show.
import { LoginPage } from "../pages/LoginPage";

const ChatPage = lazy(() =>
  import("../pages/ChatPage").then((module) => ({ default: module.ChatPage })),
);
const DashboardPage = lazy(() =>
  import("../pages/DashboardPage.tsx").then((module) => ({ default: module.DashboardPage })),
);
const KnowledgeBasePage = lazy(() =>
  import("../pages/KnowledgeBasePage.tsx").then((module) => ({
    default: module.KnowledgeBasePage,
  })),
);
const DataIngestionPage = lazy(() =>
  import("../pages/DataIngestionPage.tsx").then((module) => ({
    default: module.DataIngestionPage,
  })),
);
const OnBoardingPage = lazy(() =>
  import("../pages/OnBoardingPage").then((module) => ({ default: module.OnBoardingPage })),
);
const BlueprintPathsPage = lazy(() =>
  import("../pages/BlueprintPathsPage.tsx").then((module) => ({
    default: module.BlueprintPathsPage,
  })),
);
const BlueprintPathDetailPage = lazy(() =>
  import("../pages/BlueprintPathDetailPage.tsx").then((module) => ({
    default: module.BlueprintPathDetailPage,
  })),
);
const SkillWizardPage = lazy(() =>
  import("../pages/SkillWizardPage").then((module) => ({ default: module.SkillWizardPage })),
);
const TeamManagementPage = lazy(() =>
  import("../pages/TeamManagementPage.tsx").then((module) => ({
    default: module.TeamManagementPage,
  })),
);
const TeamMemberDetailPage = lazy(() =>
  import("../pages/TeamMemberDetailPage.tsx").then((module) => ({
    default: module.TeamMemberDetailPage,
  })),
);
const PmDashboardPage = lazy(() =>
  import("../pages/PmDashboardPage.tsx").then((module) => ({
    default: module.PmDashboardPage,
  })),
);
const AdminPage = lazy(() =>
  import("../pages/AdminPage.tsx").then((module) => ({ default: module.AdminPage })),
);
const SettingsPage = lazy(() =>
  import("../pages/SettingsPage.tsx").then((module) => ({ default: module.SettingsPage })),
);
const FaqPage = lazy(() =>
  import("../features/faq/components/FaqPage.tsx").then((module) => ({
    default: module.FaqPage,
  })),
);
const FaqDetailPage = lazy(() =>
  import("../features/faq/components/FaqDetailPage.tsx").then((module) => ({
    default: module.FaqDetailPage,
  })),
);
const KnowledgeGapsPage = lazy(() =>
  import("../features/knowledge-gaps/components/KnowledgeGapsPage.tsx").then((module) => ({
    default: module.KnowledgeGapsPage,
  })),
);
const KnowledgeGapsDetailPage = lazy(() =>
  import("../features/knowledge-gaps/components/KnowledgeGapsDetailPage.tsx").then((module) => ({
    default: module.KnowledgeGapsDetailPage,
  })),
);
const KnowledgeRequestInboxPage = lazy(() =>
  import("../features/knowledge-request/components/KnowledgeRequestInboxPage.tsx").then(
    (module) => ({ default: module.KnowledgeRequestInboxPage }),
  ),
);
const OnboardingMetricsPage = lazy(() =>
  import("../features/onboarding-metrics/components/OnboardingMetricsPage.tsx").then((module) => ({
    default: module.OnboardingMetricsPage,
  })),
);
const BuddyPage = lazy(() =>
  import("../pages/BuddyPage").then((module) => ({ default: module.BuddyPage })),
);
const BoardPage = lazy(() =>
  import("../pages/BoardPage.tsx").then((module) => ({ default: module.BoardPage })),
);
const HireSetupPage = lazy(() =>
  import("../pages/HireSetupPage").then((module) => ({ default: module.HireSetupPage })),
);
const NotFoundPage = lazy(() =>
  import("../pages/NotFoundPage.tsx").then((module) => ({ default: module.NotFoundPage })),
);

/**
 * Blocks direct navigation to a manager-scoped route when the user may not
 * access it — most notably a PM who only has member access to the selected
 * project reaching `/pm-dashboard` or `/data-ingestion` by URL, which the
 * sidebar merely hides. Waits for the project context to load before deciding
 * so a managing PM is never bounced on the transient empty state during initial
 * load.
 */
function ManagerAreaGuard({ route, children }: { route: AppRoute; children: ReactNode }) {
  const { profile } = useAuth();
  const { canManageSelected, isLoading } = useProjectContext();

  if (isLoading) {
    return <PageShellSkeleton />;
  }

  if (!canAccessRoute(profile, route, canManageSelected)) {
    return <Navigate to={getDefaultRoute(profile)} replace />;
  }

  return <>{children}</>;
}

export function AppRouter() {
  return (
    <AuthGuard>
      <PageTransition>
        <Suspense fallback={<PageShellSkeleton />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/skill-wizard" element={<SkillWizardPage />} />
            <Route path="/" element={<DashboardPage />} />
            {/* One layout route for both halves of the assistant, so the shared header survives
              the crossing and the panel underneath can slide instead of cut. Their URLs are
              unchanged — `/buddy` is still `/buddy`; only who draws the header moved. */}
            <Route element={<AssistantShell />}>
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/chat/:id" element={<ChatPage />} />
              <Route path="/buddy" element={<BuddyPage />} />
            </Route>
            <Route path="/onboarding" element={<OnBoardingPage />} />
            {/* Guarded for the same reason as `/hire-setup` below: the policy calls authoring
              PM/HR/ADMIN-only and the sidebar merely hides it, which leaves the URL. Both
              addresses share one policy entry -- `routePrefixes` maps `/blueprints/` onto it. */}
            <Route
              path="/blueprints"
              element={
                <ManagerAreaGuard route="/blueprints">
                  <BlueprintPathsPage />
                </ManagerAreaGuard>
              }
            />
            <Route
              path="/blueprints/:pathId"
              element={
                <ManagerAreaGuard route="/blueprints">
                  <BlueprintPathDetailPage />
                </ManagerAreaGuard>
              }
            />
            <Route path="/knowledge-base" element={<KnowledgeBasePage />} />
            {/* The old address of a step page: opens the path with that step unfolded. */}
            <Route path="/onboarding/:stepId" element={<OnBoardingPage />} />
            <Route
              path="/data-ingestion"
              element={
                <ManagerAreaGuard route="/data-ingestion">
                  <DataIngestionPage />
                </ManagerAreaGuard>
              }
            />
            <Route path="/team-management" element={<TeamManagementPage />} />
            <Route path="/team/:userId" element={<TeamMemberDetailPage />} />
            <Route
              path="/pm-dashboard"
              element={
                <ManagerAreaGuard route="/pm-dashboard">
                  <PmDashboardPage />
                </ManagerAreaGuard>
              }
            />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/insights/faq" element={<FaqPage />} />
            <Route path="/insights/faq/:groupId" element={<FaqDetailPage />} />
            <Route path="/insights/knowledge-gaps" element={<KnowledgeGapsPage />} />
            <Route path="/insights/knowledge-gaps/:gapId" element={<KnowledgeGapsDetailPage />} />
            <Route
              path="/insights/knowledge-requests"
              element={
                <ManagerAreaGuard route="/insights/knowledge-requests">
                  <KnowledgeRequestInboxPage />
                </ManagerAreaGuard>
              }
            />
            <Route
              path="/insights/onboarding"
              element={
                <ManagerAreaGuard route="/insights/onboarding">
                  <OnboardingMetricsPage />
                </ManagerAreaGuard>
              }
            />
            {/* The surfaces the buddy's tools serve. Added beside the onboarding path above, not
              in place of it: both ways in stay open. The buddy itself now sits with the chat,
              under `AssistantShell`. */}
            <Route path="/board" element={<BoardPage />} />
            {/* Guarded, because the access policy says it is PM/HR/ADMIN-only and the sidebar
              merely hides it -- which leaves the URL. The page already gates its *actions* by
              role, but a hire who typed the path still got the page and a column of failed
              requests, and the policy claimed otherwise. */}
            <Route
              path="/hire-setup"
              element={
                <ManagerAreaGuard route="/hire-setup">
                  <HireSetupPage />
                </ManagerAreaGuard>
              }
            />
            {/* The former standalone pages, now tabs of `/hire-setup`. Kept as redirects so old
              links and bookmarks still land somewhere useful. */}
            <Route
              path="/arrival-steps"
              element={<Navigate to="/hire-setup?tab=arrival" replace />}
            />
            <Route
              path="/starter-work"
              element={<Navigate to="/hire-setup?tab=starter" replace />}
            />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/profile" element={<Navigate to="/settings" replace />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </PageTransition>
    </AuthGuard>
  );
}
