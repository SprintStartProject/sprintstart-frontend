import { Route, Routes } from 'react-router-dom';
import { ChatPage } from '../pages/ChatPage';
import { HomePage } from '../pages/HomePage';
import { KnowledgeBasePage } from '../pages/KnowledgeBasePage';
import { OnBoardingPage } from '../pages/OnBoardingPage';

export function AppRouter() {
    return (
        <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/onboarding" element={<OnBoardingPage />} />
            <Route path="/knowledge-base" element={<KnowledgeBasePage />} />
        </Routes>
    );
}