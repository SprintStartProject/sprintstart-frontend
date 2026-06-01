import { Route, Routes } from 'react-router-dom';
import { ChatPage } from '../pages/ChatPage';
import { DashboardPage } from '../pages/DashboardPage.tsx';
import { KnowledgeBasePage } from '../pages/KnowledgeBasePage';
import { OnBoardingPage } from '../pages/OnBoardingPage';
import { LoginPage } from '../pages/LoginPage';
import { AuthGuard } from './AuthGuard';
import { SelectionWizardPage } from '../pages/SelectionWizardPage';

export function AppRouter() {
    return (
        <AuthGuard>
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/selection-wizard" element={<SelectionWizardPage />} />
                <Route path="/" element={<DashboardPage />} />
                <Route path="/chat" element={<ChatPage />} />
                <Route path="/onboarding" element={<OnBoardingPage />} />
                <Route path="/knowledge-base" element={<KnowledgeBasePage />} />
            </Routes>
        </AuthGuard>
    );
}