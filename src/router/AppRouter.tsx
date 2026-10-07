import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { useProjectContext } from "../features/projects/useProjectContext";
import { canAccessRoute, getDefaultRoute, type AppRoute } from "../auth/accessPolicy";
import { PageShellSkeleton } from "../components/layout/PageShell";
import { PageTransition } from "../components/layout/PageTransition";
import { AuthGuard } from "./AuthGuard";
import { RouteErrorBoundary } from "./RouteErrorBoundary";
// Not lazy, unlike every other route below: `AuthGuard`'s Keycloak redirect chain (logout,
// the silent SSO check on boot) can land here through several full page reloads in a row,
// each needing this chunk again. `PageShellSkeleton` -- the shared `Suspense` fallback -- has
// no login-card shape to preview, so every one of those loads would flash its header/spinner
// right before this replaces it. Bundling it eagerly removes the wait Suspense would show.
import { LoginPage } from "../pages/LoginPage";

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

/**
 * `/chat/:id` → the conversation it names.
 *
 * The retired chat's ids live on as the ids of the conversations the backfill migrated: it
 * copied `chat.id` onto the buddy session it created, so an old "Keep this chat" card's link
 * still names a conversation that exists, and this opens it. Where no such conversation is
 * there to open — an environment the backfill never reached, a binned conversation —
 * `BuddyPage`'s own reconciler falls back to the bare page, because a stale link is not a
 * failed read.
 */
function ChatRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={id ? `/buddy/${id}` : "/buddy"} replace />;
}

/**
 * Every route of the app, inside one `AuthGuard`, one `RouteErrorBoundary` and one shared
 * `Suspense` fallback. The boundary is keyed by pathname: a page that failed to load or render
 * keeps the shell (the sidebar included) and can be left by navigating — the next route gets a
 * clean attempt, and the failure state is not carried across.
 *
 * Pages are lazy-loaded except `LoginPage` (see the comment on its import). One layout
 * route groups pages that share a header: `PmWorkspace` for the PM area. Routes a user
 * without access must not reach by URL are wrapped in `ManagerAreaGuard`; the others rely
 * on the sidebar not offering them. Which groups may open which route is defined in
 * `src/auth/accessPolicy.ts`.
 */
export function AppRouter() {
  const { pathname } = useLocation();

  return (
    <AuthGuard>
      <PageTransition>
        <RouteErrorBoundary key={pathname}>
          <Suspense fallback={<PageShellSkeleton />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/skill-wizard" element={<SkillWizardPage />} />
              <Route path="/" element={<DashboardPage />} />
              {/* The one conversation surface, and the address the dock's expand hands over —
              `/buddy/:id` is one conversation, named by id and read by the page itself. */}
              <Route path="/buddy" element={<BuddyPage />} />
              <Route path="/buddy/:id" element={<BuddyPage />} />
              {/* The retired chat. Both of its addresses land on the buddy rather than a 404, and
              `/chat/:id` keeps its id — the backfill that ran before the chat tables were
              dropped copied each chat's id onto the session it created (see `ChatRedirect`),
              so an old "Keep this chat" card still names a conversation that can open. A link
              whose id has no conversation behind it falls back to the bare page, never a 404. */}
              <Route path="/chat" element={<Navigate to="/buddy" replace />} />
              <Route path="/chat/:id" element={<ChatRedirect />} />
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
              in place of it: both ways in stay open. The buddy itself is its own page, `/buddy`. */}
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
        </RouteErrorBoundary>
      </PageTransition>
    </AuthGuard>
  );
}
