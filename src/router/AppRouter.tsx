import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { useProjectContext } from "../features/projects/useProjectContext";
import { canAccessRoute, getDefaultRoute, type AppRoute } from "../auth/accessPolicy";
import { ChatPage } from "../pages/ChatPage";
import { AssistantShell } from "../components/layout/AssistantShell";
import { DashboardPage } from "../pages/DashboardPage.tsx";
import { KnowledgeBasePage } from "../pages/KnowledgeBasePage.tsx";
import { DataIngestionPage } from "../pages/DataIngestionPage.tsx";
import { OnBoardingPage } from "../pages/OnBoardingPage";
import { OnBoardingItemPage } from "../features/onboarding/components/OnBoardingItemPage";
import { LoginPage } from "../pages/LoginPage";
import { AuthGuard } from "./AuthGuard";
import { SkillWizardPage } from "../pages/SkillWizardPage";
import { TeamManagementPage } from "../pages/TeamManagementPage.tsx";
import { TeamMemberDetailPage } from "../pages/TeamMemberDetailPage.tsx";
import { PmDashboardPage } from "../pages/PmDashboardPage.tsx";
import { AdminPage } from "../pages/AdminPage.tsx";
import { SettingsPage } from "../pages/SettingsPage.tsx";
import { FaqPage } from "../features/faq/components/FaqPage.tsx";
import { FaqDetailPage } from "../features/faq/components/FaqDetailPage.tsx";
import { KnowledgeGapsPage } from "../features/knowledge-gaps/components/KnowledgeGapsPage.tsx";
import { KnowledgeGapsDetailPage } from "../features/knowledge-gaps/components/KnowledgeGapsDetailPage.tsx";
import { KnowledgeRequestInboxPage } from "../features/knowledge-request/components/KnowledgeRequestInboxPage.tsx";
import { OnboardingMetricsPage } from "../features/onboarding-metrics/components/OnboardingMetricsPage.tsx";
import { BuddyPage } from "../pages/BuddyPage";
import { BoardPage } from "../pages/BoardPage.tsx";
import { ArrivalStepsPage } from "../pages/ArrivalStepsPage";
import { StarterWorkPage } from "../pages/StarterWorkPage";
import { NotFoundPage } from "../pages/NotFoundPage.tsx";

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
    return (
      <div className="flex h-screen w-full items-center justify-center bg-app-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-app-brand border-t-transparent" />
      </div>
    );
  }

  if (!canAccessRoute(profile, route, canManageSelected)) {
    return <Navigate to={getDefaultRoute(profile)} replace />;
  }

  return <>{children}</>;
}

export function AppRouter() {
  return (
    <AuthGuard>
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
    </AuthGuard>
  );
}
