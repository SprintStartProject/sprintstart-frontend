import { AppRouter } from './router/AppRouter';
import { SideBar } from './components/layout/SideBar';
import { AuthProvider } from './context/AuthProvider';
import { ChatProvider } from './context/ChatProvider';
import { ChatPreferencesProvider } from './context/ChatPreferencesProvider';
import { ThemeProvider } from './context/ThemeProvider';
import { ProjectProvider } from './features/projects/ProjectProvider';
import { MomentsProvider, RocketPet } from './features/moments';
import { useAuth } from './context/useAuth';

function AppContent() {
    const { status } = useAuth();

    // Show sidebar only if logged in (even if onboarding is needed)
    const showSidebar = status !== 'unauthenticated' && status !== 'loading';

    return (
        <div className="flex min-h-screen w-full bg-app-bg text-app-text">
            {showSidebar && <SideBar />}

            <main className="min-h-screen min-w-0 flex-1 bg-app-bg pt-[64px] lg:pt-0">
                <AppRouter />
            </main>

            {/* Decorative easter egg; only for signed-in users, so it never
                sits on top of the login screen. */}
            {showSidebar && <RocketPet />}
        </div>
    );
}

function App() {
    // ProjectProvider sits inside AuthProvider: which projects are loaded
    // depends on the authenticated user's permission group.
    return (
        <ThemeProvider>
            <AuthProvider>
                <ProjectProvider>
                    <ChatProvider>
                        <ChatPreferencesProvider>
                            {/* Inside AuthProvider: the launch sequence is triggered
                                by the user becoming authenticated. */}
                            <MomentsProvider>
                                <AppContent />
                            </MomentsProvider>
                        </ChatPreferencesProvider>
                    </ChatProvider>
                </ProjectProvider>
            </AuthProvider>
        </ThemeProvider>
    );
}

export default App;