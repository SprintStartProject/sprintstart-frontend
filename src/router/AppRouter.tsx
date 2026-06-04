import { Route, Routes } from 'react-router-dom';
import { ChatbotPage } from '../pages/ChatbotPage';
import { DashboardPage } from '../pages/DashboardPage.tsx';
import { DataIngestionPage } from '../pages/DataIngestionPage';
import { OnBoardingPage } from '../pages/OnBoardingPage';
import { OnBoardingItemPage } from '../pages/OnBoardingItemPage';
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
                <Route path="/chat" element={<ChatbotPage />} />
                <Route path="/chat/:id" element={<ChatbotPage />} />
                <Route path="/onboarding" element={<OnBoardingPage />} />
                <Route path="/knowledge-base" element={<DataIngestionPage />} />
                <Route path="/onboarding/:stepId" element={<OnBoardingItemPage />} />
            </Routes>
        </AuthGuard>
    );
}