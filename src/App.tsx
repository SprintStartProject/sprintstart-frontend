import { Route, Routes } from 'react-router-dom';
import { SideBar } from './components/layout/SideBar';
import { ChatPage } from './pages/ChatPage';
import { HomePage } from './pages/HomePage';
import { KnowledgeBasePage } from './pages/KnowledgeBasePage';
import { OnBoardingPage } from './pages/OnBoardingPage';

function App() {
  return (
      <div className="flex min-h-screen w-full bg-gray-950">
        <SideBar />

        <main className="min-h-screen flex-1 bg-gray-950">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/onboarding" element={<OnBoardingPage />} />
            <Route path="/knowledge-base" element={<KnowledgeBasePage />} />
          </Routes>
        </main>
      </div>
  );
}

export default App;