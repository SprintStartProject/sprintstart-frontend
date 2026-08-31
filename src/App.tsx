import { AppRouter } from "./router/AppRouter";
import { SideBar } from "./components/layout/SideBar";
import { AuthProvider } from "./context/AuthProvider";
import { ChatProvider } from "./context/ChatProvider";
import { ThemeProvider } from "./context/ThemeProvider";
import { ToastProvider } from "./context/ToastProvider";
import { ProjectProvider } from "./features/projects/ProjectProvider";
import { MomentsProvider, RocketPet, useMoments } from "./features/moments";
import { BuddyWidget } from "./features/buddy/components/BuddyWidget";
import { BuddyProvider } from "./features/buddy/BuddyProvider";
import { useAuth } from "./context/useAuth";
import { AuroraBackground } from "./components/layout/AuroraBackground";
import { EggEffectsLayer } from "./features/easter-eggs/components/EggEffectsLayer";

function AppContent() {
  const { status } = useAuth();
  const { showRocketPet } = useMoments();

  // Show sidebar only if logged in (even if onboarding is needed)
  const showSidebar = status !== "unauthenticated" && status !== "loading";

  return (
    // One buddy conversation above both surfaces that show it: the dock in the corner and the
    // `/buddy` page. Two instances is what made them disagree about what had been said.
    <BuddyProvider>
      <div className="flex min-h-screen w-full bg-app-bg text-app-text">
        <AuroraBackground />
        {showSidebar && <SideBar />}

        {/* `data-moment-stage`: the area the page-scoped moments (the
          onboarding launch and landing) cover, instead of the whole
          screen — see momentStage.ts in the moments feature. */}
        <main data-moment-stage className="relative min-h-screen min-w-0 flex-1 pt-[64px] lg:pt-0">
          <AppRouter />
        </main>

        {/* The buddy in the corner of every page, and the dock it opens. Mounted here
          rather than per-route so one conversation survives navigation — that is what
          "always-on" means, and it is why the widget owns the session rather than any
          page owning it. Signed-in only: it warms a visit on mount, which is a request
          nobody on the login screen has a session for. It takes itself off `/buddy`,
          where the page already is the buddy. */}
        {showSidebar && <BuddyWidget />}

        {/* Decorative easter egg; only for signed-in users, so it never
          sits on top of the login screen, and off unless turned on in
          Settings (see MomentsSection). */}
        {showSidebar && showRocketPet && <RocketPet />}

        {/* Whole-window egg effects (barrel roll, matrix rain), rendered
          once for the whole app. Any chat surface fires them through the
          bus (playEggEffect); this is where they actually draw. Not gated
          on showSidebar: a fired effect must always have its renderer. */}
        <EggEffectsLayer />
      </div>
    </BuddyProvider>
  );
}

function App() {
  // ProjectProvider sits inside AuthProvider: which projects are loaded
  // depends on the authenticated user's permission group.
  return (
    <ThemeProvider>
      {/* Outermost app-level provider (just inside theme, so cards pick up
          light/dark): toasts must be reachable from every page, signed in or
          not, and must outlive route changes. */}
      <ToastProvider>
        <AuthProvider>
          <ProjectProvider>
            <ChatProvider>
              {/* Inside AuthProvider: the launch sequence is triggered
                              by the user becoming authenticated. */}
              <MomentsProvider>
                <AppContent />
              </MomentsProvider>
            </ChatProvider>
          </ProjectProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
