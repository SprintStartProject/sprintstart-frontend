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
const OnBoardingItemPage = lazy(() =>
  import("../features/onboarding/components/OnBoardingItemPage").then((module) => ({
    default: module.OnBoardingItemPage,
  })),
);
const SkillWizardPage = lazy(() =>
  import("../pages/SkillWizardPage").then((module) => ({ default: module.SkillWizardPage })),
);
const PmWorkspace = lazy(() =>
  import("../features/pm-area/PmWorkspace.tsx").then((module) => ({
    default: module.PmWorkspace,
  })),
);
const AdminPage = lazy(() =>
  import("../pages/AdminPage.tsx").then((module) => ({ default: module.AdminPage })),
);
const SettingsPage = lazy(() =>
  import("../pages/SettingsPage.tsx").then((module) => ({ default: module.SettingsPage })),
);
const BuddyPage = lazy(() =>
  import("../pages/BuddyPage").then((module) => ({ default: module.BuddyPage })),
);
const BoardPage = lazy(() =>
  import("../pages/BoardPage.tsx").then((module) => ({ default: module.BoardPage })),
);
const ArrivalStepsPage = lazy(() =>
  import("../pages/ArrivalStepsPage").then((module) => ({ default: module.ArrivalStepsPage })),
);
const StarterWorkPage = lazy(() =>
  import("../pages/StarterWorkPage").then((module) => ({ default: module.StarterWorkPage })),
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
            <Route path="/knowledge-base" element={<KnowledgeBasePage />} />
            <Route path="/onboarding/:stepId" element={<OnBoardingItemPage />} />
            <Route
              path="/data-ingestion"
              element={
                <ManagerAreaGuard route="/data-ingestion">
                  <DataIngestionPage />
                </ManagerAreaGuard>
              }
            />
            {/* The whole PM area is one layout route, like the assistant above: one header and
              one tab bar that stay mounted while the sections slide underneath. The children
              carry no elements -- `PmWorkspace` picks the section from the URL -- they are here
              so every old address still matches. Guarded once for all of them: the access
              policy gives every one of these routes the same groups and the same
              manage-the-selected-project rule. */}
            <Route
              element={
                <ManagerAreaGuard route="/pm-dashboard">
                  <PmWorkspace />
                </ManagerAreaGuard>
              }
            >
              <Route path="/pm-dashboard" />
              <Route path="/team-management" />
              <Route path="/team/:userId" />
              <Route path="/insights/knowledge-requests" />
              <Route path="/insights/onboarding" />
              <Route path="/insights/faq/:groupId?" />
              <Route path="/insights/knowledge-gaps/:gapId?" />
            </Route>
            <Route path="/admin" element={<AdminPage />} />
            {/* The surfaces the buddy's tools serve. Added beside the onboarding path above, not
              in place of it: both ways in stay open. The buddy itself now sits with the chat,
              under `AssistantShell`. */}
            <Route path="/board" element={<BoardPage />} />
            {/* Guarded, because the access policy says they are PM/HR/ADMIN-only and the sidebar
              merely hides them -- which leaves the URL. Both pages already gate their *actions*
              by role, but a hire who typed the path still got the page and a column of failed
              requests, and the policy claimed otherwise. */}
            <Route
              path="/arrival-steps"
              element={
                <ManagerAreaGuard route="/arrival-steps">
                  <ArrivalStepsPage />
                </ManagerAreaGuard>
              }
            />
            <Route
              path="/starter-work"
              element={
                <ManagerAreaGuard route="/starter-work">
                  <StarterWorkPage />
                </ManagerAreaGuard>
              }
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
