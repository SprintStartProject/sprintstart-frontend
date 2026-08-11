import { AppRouter } from "./router/AppRouter";
import { SideBar } from "./components/layout/SideBar";
import { AuthProvider } from "./context/AuthProvider";
import { ChatProvider } from "./context/ChatProvider";
import { ChatPreferencesProvider } from "./context/ChatPreferencesProvider";
import { ThemeProvider } from "./context/ThemeProvider";
import { ProjectProvider } from "./features/projects/ProjectProvider";
import { MomentsProvider, RocketPet, useMoments } from "./features/moments";
import { useAuth } from "./context/useAuth";
import { AuroraBackground } from "./components/layout/AuroraBackground";

function AppContent() {
  const { status } = useAuth();
  const { showRocketPet } = useMoments();

  // Show sidebar only if logged in (even if onboarding is needed)
  const showSidebar = status !== "unauthenticated" && status !== "loading";

  return (
    <div className="flex min-h-screen w-full bg-app-bg text-app-text">
      <AuroraBackground />
      {showSidebar && <SideBar />}

      {/* `data-moment-stage`: the area the page-scoped moments (the
          onboarding launch and landing) cover, instead of the whole
          screen — see momentStage.ts in the moments feature. */}
      <main
        data-moment-stage
        className="relative min-h-screen min-w-0 flex-1 pt-[64px] lg:pt-0"
      >
        <AppRouter />
      </main>

      {/* Decorative easter egg; only for signed-in users, so it never
          sits on top of the login screen, and off unless turned on in
          Settings (see MomentsSection). */}
      {showSidebar && showRocketPet && <RocketPet />}
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