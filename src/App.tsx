import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./services/queryClient";
import { AppRouter } from "./router/AppRouter";
import { SideBar } from "./components/layout/SideBar";
import { AuthProvider } from "./context/AuthProvider";
import { ThemeProvider } from "./context/ThemeProvider";
import { ToastProvider } from "./context/ToastProvider";
import { FocusModeProvider } from "./context/FocusModeProvider";
import { useFocusMode } from "./context/useFocusMode";
import { ProjectProvider } from "./features/projects/ProjectProvider";
import { MomentsProvider, RocketPet, useMoments } from "./features/moments";
import { OnboardingJourneyProvider } from "./features/onboarding/generation/OnboardingJourneyProvider";
import { BuddyWidget } from "./features/buddy/components/BuddyWidget";
import { BuddyProvider } from "./features/buddy/BuddyProvider";
import { SelectionActions } from "./features/board/selection/SelectionActions";
import { CardMarksProvider } from "./features/board/marks/CardMarksProvider";
import { useAuth } from "./context/useAuth";
import { AuroraBackground } from "./components/layout/AuroraBackground";
import { MAIN_CONTENT_ID, requestMainContentFocus } from "./components/layout/mainFocus";
import { EggEffectsLayer } from "./features/easter-eggs/components/EggEffectsLayer";
import { MyKnowledgeGapsProvider } from "./features/knowledge-gaps/MyKnowledgeGapsProvider";
import { KnowledgeGapOwnerAnnouncement } from "./features/knowledge-gaps/components/KnowledgeGapOwnerAnnouncement";
import { useScrollRestoration } from "./hooks/useScrollRestoration";
import { useBuddyPathSync } from "./features/buddy/hooks/useBuddyPathSync";
import { GlobalShortcuts } from "./features/shortcuts";

function AppContent() {
  const { status } = useAuth();
  const { showRocketPet } = useMoments();
  const { isFocused } = useFocusMode();
  useScrollRestoration();
  useBuddyPathSync();

  // Hands keyboard focus to the new page after a route change, so the next Tab starts in the page
  // and not on the sidebar link that was just pressed. Not on the first load: the browser starts
  // at the top of the document, which is where the skip link is.
  const { pathname } = useLocation();
  const previousPathname = useRef(pathname);
  useEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    requestMainContentFocus();
  }, [pathname]);

  // Signed in at all — the shell is drawn for anyone past the login screen, onboarding included.
  // `signingOut` stays out on purpose: it is the boot script's "this load is a logout return"
  // flag settling back toward unauthenticated (see `AuthContext`'s `AuthStatus`), and the shell
  // must not flash back in while that resolves.
  const signedIn = status === "authenticated";

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
  // (The pattern and its three rules are named once in `CODING_STANDARDS.md` § 3.)
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
        {/* First stop for a keyboard: lets it jump over the whole sidebar to the page (WCAG 2.4.1).
            Parked above the viewport until focused. Only with the sidebar, so only when signed in. Focuses the
            target in script instead of following the hash, which would add #main-content to
            every URL. */}
        {signedIn && (
          <a
            href={`#${MAIN_CONTENT_ID}`}
            onClick={(event) => {
              event.preventDefault();
              const main = document.getElementById(MAIN_CONTENT_ID);
              main?.focus();
              main?.scrollIntoView({ block: "start" });
            }}
            className="fixed top-3 left-3 z-[210] -translate-y-24 rounded-xl bg-app-brand px-4 py-2 text-sm font-semibold text-white shadow-app-brand-lift focus:translate-y-0"
          >
            Skip to main content
          </a>
        )}

        <AuroraBackground />
        {signedIn && (
          // `contents` while the shell is whole: the wrapper has no box at all, so the sidebar is
          // the same direct flex child of the page it has always been. It only becomes a box in
          // focus mode, and only from `lg` up — below that there is no hovering to reveal anything
          // with, and the sidebar's own mobile header is the way back.
          //
          // The box carries the sidebar's width itself. Everything inside it is `fixed`, so without
          // one it is zero wide, and `-translate-x-full` of nothing moves nothing: the sidebar
          // stayed where it was, on top of a page that had already taken its margin back.
          <div
            className={
              isFocused
                ? `contents lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:block lg:w-[var(--app-sidebar-desktop-width,var(--app-sidebar-width))] lg:transition-transform lg:duration-300 lg:ease-out ${peeking ? "lg:translate-x-0" : "lg:-translate-x-full"}`
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
        <div
          data-moment-stage
          className={`app-sidebar-eases relative min-h-screen min-w-0 flex-1 pt-[64px] lg:pt-0 ${
            // The sidebar is `fixed` from `lg` up (see SideBar), so it is out of
            // flow and the page has to leave its width free itself. In focus mode
            // it slides away over the content, so the margin goes with it. Its
            // width can be changed and folded, so it is read from the variable
            // the sidebar keeps, falling back to the default before it has run.
            signedIn && !isFocused
              ? "lg:ml-[var(--app-sidebar-desktop-width,var(--app-sidebar-width))]"
              : ""
          }`}
        >
          <AppRouter />
        </div>

        {/* The buddy in the corner of every page, and the dock it opens. Mounted here
          rather than per-route so one conversation survives navigation — that is what
          "always-on" means, and it is why the widget owns the session rather than any
          page owning it. Signed-in only: it warms a visit on mount, which is a request
          nobody on the login screen has a session for. It takes itself off `/buddy`,
          where the page already is the buddy. */}
        {showBuddyDock && <BuddyWidget />}

        {/* The keyboard, app-wide: the destination chords and `?` open a listener here rather
          than per page, because a shortcut that only works on the page you are already on is
          not a shortcut. Signed-in only — the login screen has nothing to jump between, and
          the help lists destinations a signed-out visitor has no access to. */}
        {signedIn && <GlobalShortcuts />}

        {/* Offers to keep whatever the hire has highlighted, from any page. Mounted here for the
          same reason the buddy is: what is worth keeping is almost never found on the board.

          Gated on `signedIn` rather than on `showBuddyDock`, which is the one place this parts
          company with the dock. The dock goes in focus mode because it hovers over a surface
          somebody asked to be alone with, and it hovers there whether or not they are doing
          anything. This toolbar only exists while there is a selection — it is attached to the
          text the hire just made, not to the corner of the screen — so taking it away in focus
          mode would remove the answer to a question they had only just asked. */}
        {signedIn && <SelectionActions />}

        {/* Says so, once, when a component has been put in this user's name. App-wide rather
          than on the dashboard: being handed work should reach you where you are, not wait
          until you happen to go and look. */}
        {signedIn && <KnowledgeGapOwnerAnnouncement />}

        {/* Decorative easter egg; only for signed-in users, so it never
          sits on top of the login screen, and off unless turned on in
          Settings (see AppearanceSection). */}
        {signedIn && showRocketPet && <RocketPet />}

        {/* Whole-window egg effects (barrel roll, matrix rain), rendered
          once for the whole app. Any chat surface fires them through the
          bus (playEggEffect); this is where they actually draw. Not gated
          on signedIn: a fired effect must always have its renderer. */}
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
      {/* Outermost data provider, just inside theme: every provider below reads or
          writes through the query cache, including AuthProvider on logout. */}
      <QueryClientProvider client={queryClient}>
        {/* Toasts must be reachable from every page, signed in or not, and must
            outlive route changes. */}
        <ToastProvider>
          <AuthProvider>
            <ProjectProvider>
              {/* Inside ProjectProvider: what a user owns is asked per selected project, and
                    above the router so the owner announcement can appear on any page. */}
              <MyKnowledgeGapsProvider>
                {/* Inside AuthProvider: the launch sequence is triggered
                                by the user becoming authenticated. */}
                <MomentsProvider>
                  {/* Inside the router's providers and outside the router itself: the shell has to
                        read the flag a page sets, and both live under this. */}
                  <FocusModeProvider>
                    {/* Inside ProjectProvider, which it reads the project id from, and outside the
                          router, because the toolbar that makes a highlight is mounted out here too —
                          the board page under it lends its cards in. */}
                    <CardMarksProvider>
                      {/* Inside the project and toast providers it reads from; above the routes,
                            so a path being built keeps building while the user changes routes. */}
                      <OnboardingJourneyProvider>
                        <AppContent />
                      </OnboardingJourneyProvider>
                    </CardMarksProvider>
                  </FocusModeProvider>
                </MomentsProvider>
              </MyKnowledgeGapsProvider>
            </ProjectProvider>
          </AuthProvider>
        </ToastProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
