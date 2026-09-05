import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { onBuddyPageReady } from "../aiBuddyBus";
import { useBuddy } from "../hooks/useBuddy";
import { BuddyDock, DOCK_EXPAND_S, DOCK_REVEAL_S } from "./BuddyDock";
import { BuddyLauncher } from "./BuddyLauncher";

/** Where the full conversation lives. The dock grows into it rather than getting bigger. */
const BUDDY_PAGE = "/buddy";

/** How long to wait for `/buddy` to announce itself before uncovering it anyway, in ms. */
const HANDOFF_FALLBACK_MS = 1200;

/**
 * The always-on onboarding companion: the buddy in the corner of every page, and the window it
 * opens.
 *
 * Mounted once at the app root (see `App.tsx`) so it survives navigation and keeps one
 * conversation for the lifetime of the session — which is what "always-on" means, and the
 * reason it is not a per-page component. `useBuddy` warms the visit on mount for the same
 * reason: writing a greeting is the slow part of meeting the buddy, and doing it before the
 * click turns the click into the replay path.
 *
 * Hidden on `/buddy` itself. The launcher is an affordance for reaching the buddy from
 * somewhere else; on its own page it would offer what is already filling the screen, and the
 * dock would put a second composer over the first one for the same thread.
 *
 * The widget owns the navigation, so the launcher and the dock stay presentational components
 * handed callbacks — which is also what keeps them testable without a router.
 */
export function BuddyWidget() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const {
    messages,
    isThinking,
    isStreaming,
    activeTool,
    isOpen,
    toggleOpen,
    draft,
    setDraft,
    handleSubmit,
    confirmAction,
    dismissAction,
    suggestions,
    openError,
    retryOpen,
    closeDock,
    startFreshVisit,
  } = useBuddy();

  /**
   * Where the hand-off to `/buddy` has got to.
   *
   * `growing` — the window is swelling to cover the viewport; the route has not changed.
   * `covering` — it covers everything and the route change is under way behind it. It holds
   *   here, fully opaque, for as long as that takes.
   * `revealing` — the page has said it is on screen, so the window fades away and uncovers it.
   *
   * The middle phase is not decoration. Navigating too early flashes the buddy page into view
   * around a small window; unmounting at the end of the growth leaves a frame with nothing on
   * top. And the wait cannot be a fixed delay: React Router wraps navigation in
   * `React.startTransition`, so React keeps the *previous* page on screen until the new one is
   * ready to commit — a clock-driven reveal uncovered the page the hire was leaving. The page
   * itself says when it has arrived (`onBuddyPageReady`).
   */
  const [handoff, setHandoff] = useState<"idle" | "growing" | "covering" | "revealing">("idle");
  // Held here rather than in the dock, which unmounts every time it is closed — a row the hire
  // has already dismissed coming back on the next open is the dismissal not working.
  const [suggestionsHidden, setSuggestionsHidden] = useState(false);
  /**
   * The hand-off's pending timers, each held by name so it can be cancelled precisely.
   *
   * A bag of ids that was only emptied on unmount is what let the fallback below outlive the
   * hand-off it belonged to: the page announced itself, the sequence finished, and 1.2s later a
   * timer nobody had cancelled pushed the phase back to `revealing` and toggled the dock open
   * again. An app-root component never unmounts, so "cleared on unmount" is never.
   */
  const growTimer = useRef<number | null>(null);
  const fallbackTimer = useRef<number | null>(null);
  const revealTimer = useRef<number | null>(null);

  const clearHandoffTimers = useCallback(() => {
    [growTimer, fallbackTimer, revealTimer].forEach((timer) => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = null;
    });
  }, []);

  useEffect(() => clearHandoffTimers, [clearHandoffTimers]);

  const goToPage = useCallback(() => {
    // The draft rides along in history state; `useHandedOffDraft` applies it once on the page.
    void navigate(BUDDY_PAGE, { state: { draft } });
  }, [draft, navigate]);

  /**
   * Grows the open dock into the page — one gesture instead of a cut.
   *
   * From the launcher (double click, dock closed) there is nothing on screen to grow, so that
   * path just navigates. Timers sequence the phases rather than Framer Motion's
   * `onAnimationComplete`, which fires once per animated property and would race itself.
   */
  const openFull = useCallback(() => {
    if (!isOpen) {
      goToPage();
      return;
    }

    clearHandoffTimers();
    setHandoff("growing");

    growTimer.current = window.setTimeout(() => {
      growTimer.current = null;
      // The window covers the viewport by now, so the route can change behind it unseen.
      goToPage();
      setHandoff("covering");

      // Only if the page never announces itself — a render error, or a route that did not
      // resolve. Better a hand-off that finishes a beat late than a window stuck over the
      // whole app with no way out. Guarded on the phase like every other transition here, so
      // a stray firing can never restart a sequence that has already finished.
      fallbackTimer.current = window.setTimeout(() => {
        fallbackTimer.current = null;
        setHandoff((phase) => (phase === "covering" ? "revealing" : phase));
      }, HANDOFF_FALLBACK_MS);
    }, DOCK_EXPAND_S * 1000);
  }, [clearHandoffTimers, goToPage, isOpen]);

  // The page is on screen: stop standing in for it, and drop the fallback that was only there
  // in case this never came.
  useEffect(
    () =>
      onBuddyPageReady(() => {
        if (fallbackTimer.current !== null) {
          window.clearTimeout(fallbackTimer.current);
          fallbackTimer.current = null;
        }
        setHandoff((phase) => (phase === "covering" ? "revealing" : phase));
      }),
    [],
  );

  // ...and once it has faded away, put the dock itself away. Leaving it open would be a second
  // composer floating over the full-page one, for the same thread.
  useEffect(() => {
    if (handoff !== "revealing") return;

    revealTimer.current = window.setTimeout(
      () => {
        revealTimer.current = null;
        setHandoff("idle");
        // `closeDock`, never `toggleOpen`: by this point the dock may already have been closed
        // — Escape closes it, and it can be closed during the growth — and a toggle would then
        // open it again behind the page.
        closeDock();
      },
      (DOCK_REVEAL_S + 0.05) * 1000,
    );

    return () => {
      if (revealTimer.current === null) return;
      window.clearTimeout(revealTimer.current);
      revealTimer.current = null;
    };
  }, [handoff, closeDock]);

  // Normally the widget takes itself off `/buddy` — the launcher would offer the page you are
  // reading, and the dock would put a second composer over the first. During the hand-off it
  // has to stay: it *is* the transition, and unmounting it the instant the route changes is
  // precisely the flash this sequencing exists to remove.
  if (pathname === BUDDY_PAGE && handoff === "idle") return null;

  return (
    <>
      {/* Mounted only while open — see `BuddyDock` for why an off-screen fixed panel on every
                page in the app is not a free convenience. `AnimatePresence` is what still lets it
                animate on the way out. */}
      <AnimatePresence>
        {isOpen && (
          <BuddyDock
            key="buddy-dock"
            messages={messages}
            isThinking={isThinking}
            isStreaming={isStreaming}
            activeTool={activeTool}
            draft={draft}
            setDraft={setDraft}
            handleSubmit={handleSubmit}
            confirmAction={confirmAction}
            dismissAction={dismissAction}
            suggestions={suggestions}
            startFreshVisit={startFreshVisit}
            openError={openError}
            onRetryOpen={() => void retryOpen()}
            onClose={toggleOpen}
            onOpenFull={openFull}
            suggestionsHidden={suggestionsHidden}
            onHideSuggestions={() => setSuggestionsHidden(true)}
            isExpanding={handoff !== "idle"}
            isRevealing={handoff === "revealing"}
          />
        )}
      </AnimatePresence>

      {/* Out of the way while the dock is growing into the page: a button hovering over a
                full-screen expansion is the one thing that would give away that it is still a
                floating window. */}
      {handoff === "idle" && (
        <BuddyLauncher isOpen={isOpen} onToggle={toggleOpen} onOpenFull={openFull} />
      )}
    </>
  );
}
