import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { useProjectContext } from '../features/projects/useProjectContext';
import { canAccessRoute, getDefaultRoute, type AppRoute } from '../auth/accessPolicy';
import { ChatPage } from '../pages/ChatPage';
import { DashboardPage } from '../pages/DashboardPage.tsx';
import { KnowledgeBasePage } from '../pages/KnowledgeBasePage.tsx';
import { DataIngestionPage } from '../pages/DataIngestionPage.tsx';
import { OnBoardingPage } from '../pages/OnBoardingPage';
import { OnBoardingItemPage } from '../features/onboarding/components/OnBoardingItemPage';
import { LoginPage } from '../pages/LoginPage';
import { AuthGuard } from './AuthGuard';
import { SkillWizardPage } from '../pages/SkillWizardPage';
import { TeamManagementPage } from '../pages/TeamManagementPage.tsx';
import { TeamMemberDetailPage } from '../pages/TeamMemberDetailPage.tsx';
import { PmDashboardPage } from '../pages/PmDashboardPage.tsx';
import { AdminPage } from '../pages/AdminPage.tsx';
import { SettingsPage } from '../pages/SettingsPage.tsx';
import { FaqPage } from '../features/faq/components/FaqPage.tsx';
import { FaqDetailPage } from '../features/faq/components/FaqDetailPage.tsx';
import { KnowledgeGapsPage } from '../features/knowledge-gaps/components/KnowledgeGapsPage.tsx';
import { KnowledgeGapsDetailPage } from '../features/knowledge-gaps/components/KnowledgeGapsDetailPage.tsx';
import { NotFoundPage } from '../pages/NotFoundPage.tsx';

/**
 * Blocks direct navigation to a manager-scoped route when the user may not
 * access it — most notably a PM who only has member access to the selected
 * project reaching `/pm-dashboard` or `/data-ingestion` by URL, which the
 * sidebar merely hides. Waits for the project context to load before deciding
 * so a managing PM is never bounced on the transient empty state during initial
 * load.
 */
function ManagerAreaGuard({
    route,
    children,
}: {
    route: AppRoute;
    children: ReactNode;
}) {
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
                <Route path="/chat" element={<ChatPage />} />
                <Route path="/chat/:id" element={<ChatPage />} />
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
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/profile" element={<Navigate to="/settings" replace />} />
                <Route path="*" element={<NotFoundPage />} />
            </Routes>
        </AuthGuard>
    );
}