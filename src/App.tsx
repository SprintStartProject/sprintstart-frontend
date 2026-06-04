import { AppRouter } from './router/AppRouter';
import { SideBar } from './components/layout/SideBar';
import { AuthProvider } from './context/AuthProvider';
import { useAuth } from './context/useAuth';

function AppContent() {
    const { status } = useAuth();

    // Show sidebar only if logged in (even if onboarding is needed)
    const showSidebar = status !== 'unauthenticated' && status !== 'loading';

    return (
        <div className="flex min-h-screen w-full bg-app-bg text-app-text">
            {showSidebar && <SideBar />}

            <main className="min-h-screen flex-1 bg-app-bg pt-[64px] lg:pt-0">
                <AppRouter />
            </main>
        </div>
    );
}

function App() {
    return (
        <AuthProvider>
            <AppContent />
        </AuthProvider>
    );
}

export default App;