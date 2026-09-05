import { useState } from "react";
import { AppRouter } from "./router/AppRouter";
import { SideBar } from "./components/layout/SideBar";
import { AuthProvider } from "./context/AuthProvider";
import { ChatProvider } from "./context/ChatProvider";
import { ThemeProvider } from "./context/ThemeProvider";
import { ToastProvider } from "./context/ToastProvider";
import { FocusModeProvider } from "./context/FocusModeProvider";
import { useFocusMode } from "./context/useFocusMode";
import { ProjectProvider } from "./features/projects/ProjectProvider";
import { MomentsProvider, RocketPet, useMoments } from "./features/moments";
import { BuddyWidget } from "./features/buddy/components/BuddyWidget";
import { BuddyProvider } from "./features/buddy/BuddyProvider";
import { useAuth } from "./context/useAuth";
import { AuroraBackground } from "./components/layout/AuroraBackground";

function AppContent() {
  const { status } = useAuth();
  const { showRocketPet } = useMoments();
  const { isFocused } = useFocusMode();

  // Signed in at all — the shell is drawn for anyone past the login screen, onboarding included.
  const signedIn = status !== "unauthenticated" && status !== "loading";

  // A page in focus mode has asked for the whole screen, and the dock is the one piece of the shell
  // that cannot step aside politely: it floats *over* the content, and a surface somebody asked to
  // be alone with is not the place for something hovering in the corner. The sidebar slides off the
  // edge instead of unmounting (see `peeking`); the dock simply goes.
  const showBuddyDock = signedIn && !isFocused;

  /**
   * Whether the sidebar is peeking out over a focused page.
   *
   * The sidebar is not unmounted in focus mode, only slid off the left edge, so that it is still
   * there to tab into and still animates in and out of one position rather than appearing from
   * nothing. A four-pixel strip down the edge brings it back, which is the gesture people already
   * have for a hidden dock; leaving the sidebar itself puts it away again.
   */
  const [peeking, setPeeking] = useState(false);

  // Put away whenever focus mode is entered or left, so a page that was expanded while the sidebar
  // happened to be out does not open with it already there, waiting for a mouse that never went
  // near it to leave. Reset during render rather than in an effect: it is a correction to state
  // that is already wrong for this render, not a synchronisation with anything outside React.
  const [peekMode, setPeekMode] = useState(isFocused);
  if (peekMode !== isFocused) {
    setPeekMode(isFocused);
    setPeeking(false);
  }

  return (
    // One buddy conversation above both surfaces that show it: the dock in the corner and the
    // `/buddy` page. Two instances is what made them disagree about what had been said.
    <BuddyProvider>
      <div className="flex min-h-screen w-full bg-app-bg text-app-text">
        <AuroraBackground />
        {signedIn && (
          // `contents` while the shell is whole: the wrapper has no box at all, so the sidebar is
          // the same direct flex child of the page it has always been. It only becomes a box in
          // focus mode, and only from `lg` up — below that there is no hovering to reveal anything
          // with, and the sidebar's own mobile header is the way back.
          <div
            className={
              isFocused
                ? `contents lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:block lg:transition-transform lg:duration-300 lg:ease-out ${peeking ? "lg:translate-x-0" : "lg:-translate-x-full"}`
                : "contents"
            }
            onMouseLeave={() => {
              if (isFocused) setPeeking(false);
            }}
            // Tabbing into the sidebar brings it out, which is the whole reason it stays mounted:
            // hover is not a way in for everybody, and a navigation that can be focused but not
            // seen is worse than one that is not there.
            onFocus={() => {
              if (isFocused) setPeeking(true);
            }}
            onBlur={() => {
              if (isFocused) setPeeking(false);
            }}
          >
            <SideBar />
          </div>
        )}

        {/* The edge that brings it back. Under the sidebar's own layer, so moving onto the sidebar
            never counts as leaving the strip and the two cannot flicker against each other. */}
        {signedIn && isFocused && (
          <div
            aria-hidden="true"
            onMouseEnter={() => setPeeking(true)}
            className="fixed inset-y-0 left-0 z-40 hidden w-4 lg:block"
          />
        )}

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
        {showBuddyDock && <BuddyWidget />}

        {/* Decorative easter egg; only for signed-in users, so it never
          sits on top of the login screen, and off unless turned on in
          Settings (see MomentsSection). */}
        {signedIn && showRocketPet && <RocketPet />}
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
                {/* Inside the router's providers and outside the router itself: the shell has to
                    read the flag a page sets, and both live under this. */}
                <FocusModeProvider>
                  <AppContent />
                </FocusModeProvider>
              </MomentsProvider>
            </ChatProvider>
          </ProjectProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
